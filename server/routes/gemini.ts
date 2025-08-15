


import { Router, Request, Response } from 'express';
import '../types';
import { GoogleGenAI, Type } from '@google/genai';
import { Client } from '../types';

const router = Router();
const model = "gemini-2.5-flash";

const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("A variável de ambiente API_KEY do Google Gemini não está configurada no servidor.");
}

// Initialize the client once, at the top level.
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const handleApiError = (res: Response, error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    let errorMessage = `Erro inesperado em ${context}.`;
    let errorStatus = 500;

    if (!apiKey || (error.message && error.message.includes("API_KEY"))) {
        errorMessage = "A variável de ambiente API_KEY do Google Gemini não está configurada no servidor.";
        errorStatus = 503; // Service Unavailable
    } else if (error instanceof SyntaxError || (error.message && error.message.includes("JSON"))) {
        errorMessage = "A resposta da IA não estava em um formato JSON válido. Por favor, tente novamente.";
        errorStatus = 502; // Bad Gateway
    } else {
        errorMessage = error.message || errorMessage;
    }

    res.status(errorStatus).json({ message: errorMessage });
};


router.post('/cnpj-lookup', async (req: Request, res: Response) => {
    if (!ai) {
        return res.status(503).json({ message: "A API do Gemini não foi inicializada. Verifique a API_KEY." });
    }
    try {
        const { cnpj } = req.body;
        const prompt = `
        Você é um assistente especialista em dados cadastrais de empresas brasileiras. Sua tarefa é buscar informações públicas sobre um CNPJ usando sua ferramenta de busca e retornar os dados em um formato JSON específico.
        Para o CNPJ: "${cnpj}"
        1.  **AÇÃO PRIMÁRIA:** Use a ferramenta de busca para encontrar os dados cadastrais públicos e oficiais deste CNPJ. Dê prioridade a fontes governamentais (Receita Federal) ou agregadores de dados confiáveis.
        2.  **EXTRAÇÃO DE DADOS:** Extraia as seguintes informações da sua busca:
            *   Razão Social ("company")
            *   Nome Fantasia
            *   CNAE Principal (apenas o código)
            *   Descrição da Atividade Principal
            *   E-mail de contato público ("email")
            *   Telefone de contato público ("phone")
        3.  **DERIVAÇÃO DE DADOS:** Com base nos dados extraídos, crie os seguintes campos:
            *   \`name\`: Use o Nome Fantasia. Se não houver, use a Razão Social.
            *   \`cnaes\`: Deve ser um array contendo uma única string com o código do CNAE Principal.
            *   \`businessDescription\`: Use a Descrição da Atividade Principal encontrada.
            *   \`username\`: Crie um nome de usuário simples, em minúsculas, sem espaços ou caracteres especiais, a partir do Nome Fantasia (ex: "Acme LTDA" -> "acme").
            *   \`taxRegime\`: Por padrão, defina como "Simples Nacional".
        4.  **FORMATAÇÃO DA SAÍDA:** Retorne **APENAS E SOMENTE** um objeto JSON contendo os campos extraídos e derivados.
        5.  **TRATAMENTO DE ERRO:** Se a busca não retornar resultados ou se o CNPJ for claramente inválido, retorne um objeto JSON com uma chave "error" contendo a mensagem de erro. Se a busca for bem-sucedida, retorne a chave "error" como uma string vazia ("").
        
        Não inclua nenhuma explicação, texto, ou caracteres de formatação (como markdown) fora do objeto JSON final.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { tools: [{googleSearch: {}}] },
        });

        const resultText = response.text?.trim().replace(/```json|```/g, '') || '{}';
        const result = JSON.parse(resultText);
        
        if (result.error && result.error.length > 0) {
            return res.status(400).json({ message: result.error });
        }
        res.json(result);

    } catch (error: any) {
        handleApiError(res, error, "/cnpj-lookup");
    }
});

router.post('/analyze-quick-send', async (req: Request, res: Response) => {
    if (!ai) {
        return res.status(503).json({ message: "A API do Gemini não foi inicializada. Verifique a API_KEY." });
    }
    try {
        const { fileContentBase64, mimeType, userDescription } = req.body;
        const filePart = { inlineData: { data: fileContentBase64.split(',')[1], mimeType } };
        const promptText = `
        Analise o documento (imagem ou PDF de um recibo, nota fiscal ou comprovante) e a descrição do usuário. 
        Descrição do usuário: "${userDescription}".
        Sua tarefa é extrair as seguintes informações e retornar um objeto JSON:
        - suggestedName: Um nome curto e descritivo para o documento (ex: "Recibo Posto Shell", "NF-e Amazon").
        - suggestedClassification: Uma categoria para o documento (ex: "Combustível", "Material de Escritório", "Refeição").
        - extractedDate: A data do documento no formato ISO (YYYY-MM-DD). Se não encontrar, retorne null.
        - extractedTotal: O valor total do documento como um número. Se não encontrar, retorne null.
        Retorne APENAS o objeto JSON. Não inclua markdown ou qualquer outro texto explicativo fora do JSON.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: { parts: [filePart, { text: promptText }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        suggestedName: { type: Type.STRING },
                        suggestedClassification: { type: Type.STRING },
                        extractedDate: { type: Type.STRING, nullable: true },
                        extractedTotal: { type: Type.NUMBER, nullable: true },
                    },
                },
            },
        });
        
        const result = JSON.parse(response.text || '{}');
        res.json(result);
    } catch (error: any) {
        handleApiError(res, error, "/analyze-quick-send");
    }
});

router.post('/analyze-timesheet', async (req: Request, res: Response) => {
    if (!ai) { return res.status(503).json({ message: "A API do Gemini não foi inicializada." }); }
    try {
        const { fileContentBase64, mimeType, employee, month, year } = req.body;
        const filePart = { inlineData: { data: fileContentBase64.split(',')[1], mimeType } };
        const prompt = `
        Analise a imagem ou PDF de um cartão de ponto para o funcionário ${employee.name} no mês ${month}/${year}. Extraia os totais de horas e dias e retorne um JSON.
        - totalOvertimeHours50: Total de horas extras com 50%.
        - totalOvertimeHours100: Total de horas extras com 100% (domingos/feriados).
        - totalNightlyHours: Total de horas de adicional noturno.
        - totalLatenessMinutes: Total de minutos de atraso.
        - totalAbsencesDays: Total de dias de falta (não justificadas).
        - aiAnalysisNotes: Uma breve nota sobre a análise, como "Valores extraídos com sucesso." ou "Atrasos e horas extras identificados.".
        Retorne APENAS o JSON.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: { parts: [filePart, { text: prompt }] },
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        totalOvertimeHours50: { type: Type.NUMBER },
                        totalOvertimeHours100: { type: Type.NUMBER },
                        totalNightlyHours: { type: Type.NUMBER },
                        totalLatenessMinutes: { type: Type.NUMBER },
                        totalAbsencesDays: { type: Type.NUMBER },
                        aiAnalysisNotes: { type: Type.STRING },
                    }
                }
            }
        });
        const result = JSON.parse(response.text || '{}');
        res.json(result);
    } catch (error) {
        handleApiError(res, error, "/analyze-timesheet");
    }
});

router.post('/find-opportunities', async (req: Request, res: Response) => {
    if (!ai) { return res.status(503).json({ message: "A API do Gemini não foi inicializada." }); }
    try {
        const { client } = req.body as { client: Client };
        const prompt = `
            Busque por oportunidades financeiras recentes (últimos 30 dias) para uma empresa no Brasil com o seguinte perfil:
            - Ramo: ${client.businessProfile.description}
            - CNAEs: ${client.businessProfile.cnaes.join(', ')}
            - Palavras-chave: ${client.businessProfile.keywords.join(', ')}
            - Regime: ${client.taxRegime}
            Busque por:
            1.  Incentivos Fiscais (federais, estaduais, municipais)
            2.  Editais e Licitações públicas relevantes
            Retorne um array de objetos JSON, cada um com: type, title, description, source (URL), submissionDeadline (ISO string, se aplicável).
            Se nada for encontrado, retorne um array vazio.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            type: { type: Type.STRING, enum: ['Incentivo Fiscal', 'Edital/Licitação', 'Outro'] },
                            title: { type: Type.STRING },
                            description: { type: Type.STRING },
                            source: { type: Type.STRING },
                            submissionDeadline: { type: Type.STRING, nullable: true },
                        }
                    }
                }
            },
        });
        const result = JSON.parse(response.text || '[]');
        res.json(result);
    } catch (error) {
        handleApiError(res, error, "/find-opportunities");
    }
});

router.post('/check-compliance', async (req: Request, res: Response) => {
    if (!ai) { return res.status(503).json({ message: "A API do Gemini não foi inicializada." }); }
    try {
        const { client } = req.body as { client: Client };
        const prompt = `
            Verifique pendências fiscais, tributárias e de certidões para a empresa ${client.company}.
            Use a busca para encontrar informações em portais públicos (ex: Receita Federal, Sintegra, tribunais de justiça).
            Procure por:
            - Pendências de CND federal, estadual, municipal.
            - Inscrição estadual irregular.
            - Débitos em aberto.
            Retorne um array de objetos JSON, cada um com: title, status ('OK', 'Atenção', 'Pendência', 'Informativo'), summary, sourceUrl.
            - 'OK': Nenhuma pendência encontrada na verificação.
            - 'Atenção': Um item que merece revisão, mas não é uma pendência crítica (ex: CND prestes a vencer).
            - 'Pendência': Um débito, irregularidade ou CND positiva encontrada.
            - 'Informativo': Uma informação relevante que não é uma pendência (ex: uma nova regulamentação aplicável).
            Se nada for encontrado, retorne um array vazio.
        `;
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            status: { type: Type.STRING, enum: ['OK', 'Atenção', 'Pendência', 'Informativo'] },
                            summary: { type: Type.STRING },
                            sourceUrl: { type: Type.STRING },
                        }
                    }
                }
            },
        });
        const result = JSON.parse(response.text || '[]');
        res.json(result);
    } catch (error) {
        handleApiError(res, error, "/check-compliance");
    }
});


router.post('/chatbot', async (req: Request, res: Response) => {
    if (!ai) { return res.status(503).json({ message: "A API do Gemini não foi inicializada." }); }
    try {
        const { message, context } = req.body;
        const prompt = `
            Você é um assistente de contabilidade para a plataforma JZF. Seja amigável e direto.
            Contexto atual do usuário (se houver): ${context}
            Pergunta do usuário: "${message}"
            Responda à pergunta do usuário com base no contexto. Se a resposta não estiver no contexto, diga que você não tem essa informação mas pode ajudar com outras questões.
            Não invente informações.
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
        });

        res.json({ reply: response.text });
    } catch (error) {
        handleApiError(res, error, "/chatbot");
    }
});


export default router;