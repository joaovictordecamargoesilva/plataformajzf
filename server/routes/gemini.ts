import express, { Request, Response } from 'express';
import {} from '../types';
import { GoogleGenAI, Type, Part } from '@google/genai';
import { Client } from '../types';

const router = express.Router();
const model = "gemini-2.5-flash";

const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("A variável de ambiente API_KEY do Google Gemini não está configurada no servidor.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Interfaces para tipar a resposta da BrasilAPI
interface BrasilApiCnpjResponse {
    cnpj: string;
    razao_social: string;
    nome_fantasia: string | null;
    email: string | null;
    ddd_telefone_1: string | null;
    cnae_fiscal: number;
    cnae_fiscal_descricao: string;
    cnaes_secundarios: { codigo: number; descricao: string }[];
    descricao_situacao_cadastral: string;
    data_inicio_atividade: string;
}

interface BrasilApiErrorResponse {
    message?: string;
}


const handleApiError = (res: Response, error: any, context: string) => {
    console.error(`Error in ${context}:`, error);
    let errorMessage = `Erro inesperado em ${context}.`;
    let errorStatus = 500;

    if (!apiKey || (error.message && error.message.includes("API_KEY"))) {
        errorMessage = "A API do Gemini não foi inicializada. Verifique a API_KEY do servidor.";
        errorStatus = 503;
    } else {
        errorMessage = error.message || errorMessage;
    }

    res.status(errorStatus).json({ message: errorMessage });
};

const cleanJsonString = (rawText: string): string => {
    let cleaned = rawText.trim();
    if (cleaned.startsWith('```json')) {
        cleaned = cleaned.substring(7, cleaned.length - 3).trim();
    } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.substring(3, cleaned.length - 3).trim();
    }
    return cleaned;
};

const cnpjLookup = async (req: Request, res: Response) => {
    try {
        const { cnpj } = req.body;
        const cleanCnpj = String(cnpj).replace(/\D/g, '');

        if (cleanCnpj.length !== 14) {
            return res.status(400).json({ message: 'CNPJ inválido. Por favor, digite 14 números.' });
        }

        const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.212 Safari/537.36'
            }
        });
        
        if (!response.ok) {
            const errorData = (await response.json().catch(() => ({}))) as BrasilApiErrorResponse;
            const errorMessage = errorData.message || `CNPJ não encontrado ou serviço de busca indisponível. (${response.status})`;
            return res.status(response.status).json({ message: errorMessage });
        }
        
        const data = (await response.json()) as BrasilApiCnpjResponse;

        const allCnaes = [data.cnae_fiscal];
        if (data.cnaes_secundarios && data.cnaes_secundarios.length > 0) {
            allCnaes.push(...data.cnaes_secundarios.map((c: { codigo: number }) => c.codigo));
        }

        const result = {
            company: data.razao_social,
            name: data.nome_fantasia || data.razao_social,
            email: data.email,
            phone: `${data.ddd_telefone_1 || ''}`,
            cnaes: allCnaes,
            businessDescription: data.cnae_fiscal_descricao,
            situacaoCadastral: data.descricao_situacao_cadastral,
            dataAbertura: data.data_inicio_atividade,
            cnpj: data.cnpj, // Return the formatted CNPJ from the API
            username: data.razao_social?.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || `user${Date.now()}`
        };
        
        res.json(result);

    } catch (error: any) {
        console.error("Error in /cnpj-lookup:", error);
        res.status(500).json({ message: 'Erro interno ao consultar o CNPJ. Tente novamente.' });
    }
};

const analyzeQuickSend = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    
    try {
        const { fileContentBase64, mimeType, userDescription } = req.body;
        const filePart = { inlineData: { data: fileContentBase64.split(',')[1], mimeType } };
        const promptText = `Analise o documento e a descrição: "${userDescription || 'Nenhuma'}". Retorne um JSON com: suggestedName, suggestedClassification, extractedDate (AAAA-MM-DD), extractedTotal (número).`;
        
        const schema = {
            type: Type.OBJECT,
            properties: {
                suggestedName: { type: Type.STRING },
                suggestedClassification: { type: Type.STRING },
                extractedDate: { type: Type.STRING },
                extractedTotal: { type: Type.NUMBER },
            },
            required: ['suggestedName', 'suggestedClassification', 'extractedDate', 'extractedTotal']
        };

        const response = await ai.models.generateContent({
            model,
            contents: { parts: [{ text: promptText }, filePart] },
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });

        res.json(JSON.parse(response.text || '{}'));
    } catch (error) {
        handleApiError(res, error, "/analyze-quick-send");
    }
};

const analyzeTimeSheet = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    try {
        const { fileContentBase64, mimeType, employee, month, year } = req.body;
        const filePart = { inlineData: { data: fileContentBase64.split(',')[1], mimeType } };
        const promptText = `
          Analise esta folha de ponto para o funcionário ${employee.name} (salário: R$${employee.salary}) referente a ${month}/${year}.
          Extraia os seguintes valores e retorne um JSON:
          - totalOvertimeHours50: Total de horas extras a 50%.
          - totalOvertimeHours100: Total de horas extras a 100%.
          - totalNightlyHours: Total de horas de adicional noturno.
          - totalLatenessMinutes: Total de minutos de atraso.
          - totalAbsencesDays: Total de dias de falta.
          - aiAnalysisNotes: Uma breve nota sobre qualquer observação relevante (ex: "Excesso de horas extras").
          Se um valor não for encontrado, retorne 0.
        `;
        
         const schema = {
            type: Type.OBJECT,
            properties: {
                totalOvertimeHours50: { type: Type.NUMBER },
                totalOvertimeHours100: { type: Type.NUMBER },
                totalNightlyHours: { type: Type.NUMBER },
                totalLatenessMinutes: { type: Type.NUMBER },
                totalAbsencesDays: { type: Type.NUMBER },
                aiAnalysisNotes: { type: Type.STRING },
            },
            required: ['totalOvertimeHours50', 'totalOvertimeHours100', 'totalNightlyHours', 'totalLatenessMinutes', 'totalAbsencesDays', 'aiAnalysisNotes']
        };
        
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [{ text: promptText }, filePart] },
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });
        
        res.json(JSON.parse(response.text || '{}'));
    } catch (error) {
         handleApiError(res, error, "/analyze-timesheet");
    }
};

const analyzeBulkTimeSheet = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    try {
        const { fileContentBase64, mimeType, clientId, month, year } = req.body;

        const employees = await req.prisma.employee.findMany({
            where: { clientId: Number(clientId), status: 'Ativo' },
        });

        if (employees.length === 0) {
            return res.status(400).json({ message: 'Nenhum funcionário ativo cadastrado para este cliente.' });
        }

        const employeeNames = employees.map((e: any) => e.name);

        const filePart = { inlineData: { data: fileContentBase64.split(',')[1], mimeType } };
        const promptText = `
          Sua tarefa é analisar um documento de folha de ponto contendo registros de múltiplos funcionários para o mês ${month}/${year}.
          A empresa possui os seguintes funcionários cadastrados: [${employeeNames.join(', ')}].

          Para CADA funcionário que você identificar no documento, faça o seguinte:
          1. Encontre o nome correspondente na lista de funcionários cadastrados. Seja flexível com pequenas variações nos nomes.
          2. Extraia TODAS as informações a seguir. Se uma informação não for encontrada, retorne o valor padrão (0 para números, [] para listas).
          
          Retorne sua análise como um ARRAY de objetos JSON, um para cada funcionário encontrado. O JSON deve seguir este schema ESTRITO. Não inclua markdown ou texto explicativo na resposta.
        `;
        
         const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    employeeName: { type: Type.STRING, description: "O nome exato do funcionário cadastrado que corresponde ao registro no documento." },
                    absences: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lista das datas das faltas (ex: ['15/04/2024', '16/04/2024'])." },
                    dsrValue: { type: Type.NUMBER, description: "O valor do Descanso Semanal Remunerado." },
                    overtime50Hours: { type: Type.NUMBER, description: "Total de horas extras a 50%." },
                    overtime60Hours: { type: Type.NUMBER, description: "Total de horas extras a 60%." },
                    overtime100Hours: { type: Type.NUMBER, description: "Total de horas extras a 100%." },
                    medicalPlanDiscount: { type: Type.NUMBER, description: "Valor do desconto do convênio médico." },
                    pharmacyPlanDiscount: { type: Type.NUMBER, description: "Valor do desconto do convênio farmácia." },
                    otherDiscounts: { type: Type.NUMBER, description: "Soma de outros descontos não especificados." },
                    cashierDifference: { type: Type.NUMBER, description: "Valor de quebra de caixa." },
                    aiAnalysisNotes: { type: Type.STRING, description: "Uma breve nota sobre qualquer observação relevante." },
                },
                required: [
                    'employeeName', 'absences', 'dsrValue', 'overtime50Hours', 'overtime60Hours', 'overtime100Hours',
                    'medicalPlanDiscount', 'pharmacyPlanDiscount', 'otherDiscounts', 'cashierDifference', 'aiAnalysisNotes'
                ]
            }
        };
        
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [{ text: promptText }, filePart] },
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });
        
        const results = JSON.parse(response.text || '[]');
        
        // Match results with existing employees
        const finalData = results.map((item: any) => {
            const matchedEmployee = employees.find((e: any) => e.name.toLowerCase() === item.employeeName.toLowerCase());
            return {
                ...item,
                employeeId: matchedEmployee?.id,
                isRegistered: !!matchedEmployee,
            };
        });

        res.json(finalData);

    } catch (error) {
         handleApiError(res, error, "/analyze-bulk-timesheet");
    }
};


const findFinancialOpportunities = async (req: Request, res: Response) => {
     if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    try {
        const { client } = req.body as { client: Client };
        const prompt = `
            Para uma empresa com as seguintes características:
            - Ramo: ${client.businessDescription}
            - Palavras-chave: ${client.keywords.join(', ')}
            - Regime Tributário: ${client.taxRegime}
            - CNAEs: ${client.cnaes.join(', ')}
            Busque na web por oportunidades financeiras recentes (últimos 30 dias) no Brasil, como incentivos fiscais, editais de licitação, ou programas de fomento.
            Retorne ESTRITAMENTE e APENAS um objeto JSON válido contendo uma lista de até 5 oportunidades. Cada oportunidade deve ter os campos: "type" ('IncentivoFiscal', 'EditalLicitacao' ou 'Outro'), "title", "description", "source" (URL), e opcionalmente "submissionDeadline" (data AAAA-MM-DD). Não inclua nenhuma formatação de texto ou markdown como \`\`\`json. Se nada for encontrado, retorne uma lista vazia [].
        `;
        
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { tools: [{googleSearch: {}}] },
        });
        
        const jsonString = cleanJsonString(response.text ?? '');
        res.json(JSON.parse(jsonString || '[]'));
    } catch (error) {
        handleApiError(res, error, "/find-opportunities");
    }
};

const checkCompliance = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    try {
        const { client } = req.body as { client: Client };
        const prompt = `
            Aja como um especialista sênior em conformidade fiscal e regulatória no Brasil, com mais de 20 anos de experiência. Sua missão é proteger o cliente contra multas e problemas legais.
            Realize uma busca aprofundada e minuciosa na web, focando EXCLUSIVAMENTE em portais governamentais oficiais e de alta confiabilidade (sites da Receita Federal, Secretarias da Fazenda Estaduais, portais de prefeituras, diários oficiais, e-CAC, Sintegra, etc.) por qualquer tipo de pendência, atualização legal, ou obrigação recente (últimos 60 dias) que se aplique a uma empresa com as seguintes características:
            - Ramo de Atividade: "${client.businessDescription}"
            - Regime Tributário: ${client.taxRegime}
            - CNAEs: ${client.cnaes.join(', ')}

            Sua verificação DEVE cobrir, no mínimo:
            - Status da inscrição (Situação Cadastral) do CNPJ.
            - Pendências de Certidões Negativas de Débito (CNDs) em todas as esferas (Federal, Estadual, Municipal).
            - Status de enquadramento no Simples Nacional (se aplicável) e possíveis débitos.
            - Obrigações acessórias importantes (ex: DCTF, ECF, eSocial) com prazos recentes ou futuros.
            - Mudanças recentes na legislação tributária que impactem diretamente o setor da empresa.

            Retorne ESTRITAMENTE e APENAS um objeto JSON válido contendo uma lista de até 5 itens encontrados. Cada item deve ter os campos: "title" (string), "status" (um de 'OK', 'Atencao', 'Pendencia', 'Informativo'), "summary" (string, um resumo claro, objetivo e acionável do achado), e "sourceUrl" (string, o link DIRETO E ESPECÍFICO para a fonte da informação, não uma página de busca). Não inclua nenhuma formatação de texto ou markdown como \`\`\`json. Se absolutamente nada for encontrado após uma busca diligente, retorne uma lista vazia [].
        `;

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { tools: [{googleSearch: {}}] },
        });
        
        const jsonString = cleanJsonString(response.text ?? '');
        res.json(JSON.parse(jsonString || '[]'));
    } catch (error) {
        handleApiError(res, error, "/check-compliance");
    }
};

const chatbot = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    
    try {
        const { message, context, file } = req.body;
        
        let prompt = `
            Você é um assistente de contabilidade da JZF. Responda a pergunta do usuário de forma clara e objetiva.
            Pergunta do usuário: "${message}"
        `;
        if (file) {
            prompt += `
O usuário também anexou um arquivo para análise. Use o conteúdo do arquivo como contexto principal para sua resposta.`
        }
        prompt += `
Contexto adicional do sistema (use se for relevante): "${context || 'Nenhum'}"`;
        
        
        const parts: Part[] = [{ text: prompt }];

        if (file && file.content && file.mimeType) {
            parts.push({
                inlineData: {
                    data: file.content,
                    mimeType: file.mimeType,
                }
            });
        }
        
        const response = await ai.models.generateContent({
            model,
            contents: { parts }
        });

        res.json({ reply: response.text });
        
    } catch (error) {
        handleApiError(res, error, "/chatbot");
    }
};

router.post('/cnpj-lookup', cnpjLookup);
router.post('/analyze-quick-send', analyzeQuickSend);
router.post('/analyze-timesheet', analyzeTimeSheet);
router.post('/analyze-bulk-timesheet', analyzeBulkTimeSheet);
router.post('/find-opportunities', findFinancialOpportunities);
router.post('/check-compliance', checkCompliance);
router.post('/chatbot', chatbot);

export { router as geminiRouter };