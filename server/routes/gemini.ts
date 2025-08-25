import '../types';
import { type Request, type Response, Router } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import { Client } from '../types';

const router = Router();
const model = "gemini-2.5-flash";

const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("A variável de ambiente API_KEY do Google Gemini não está configurada no servidor.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

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


const cnpjLookup = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    
    try {
        const { cnpj } = req.body;
        const prompt = `Para o CNPJ: "${cnpj}", busque os dados cadastrais públicos e retorne APENAS um objeto JSON com os campos: name, company, email, phone, cnaes (array de string), taxRegime, businessDescription, username. Em caso de erro, retorne um JSON com a chave "error".`;
    
        const schema = {
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                company: { type: Type.STRING },
                email: { type: Type.STRING },
                phone: { type: Type.STRING },
                cnaes: { type: Type.ARRAY, items: { type: Type.STRING } },
                taxRegime: { type: Type.STRING },
                businessDescription: { type: Type.STRING },
                username: { type: Type.STRING },
                error: { type: Type.STRING, optional: true },
            }
        };

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: schema, tools: [{googleSearch: {}}] },
        });

        const result = JSON.parse(response.text ?? '{}');
        if (result.error) return res.status(400).json({ message: result.error });
        res.json(result);

    } catch (error: any) {
        handleApiError(res, error, "/cnpj-lookup");
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
            contents: { parts: [filePart, { text: promptText }] },
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });
        res.json(JSON.parse(response.text ?? '{}'));
    } catch (error: any) {
        handleApiError(res, error, "/analyze-quick-send");
    }
};

const analyzeTimesheet = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });

    try {
        const { fileContentBase64, mimeType, employee, month, year } = req.body;
        const filePart = { inlineData: { data: fileContentBase64.split(',')[1], mimeType } };
        const promptText = `Analise o cartão de ponto para ${employee.name} (salário: R$ ${employee.salary.toFixed(2)}) referente a ${month}/${year}. Extraia e retorne um JSON com: totalOvertimeHours50, totalOvertimeHours100, totalNightlyHours, totalLatenessMinutes, totalAbsencesDays, dsrValue (calculado), e aiAnalysisNotes.`;

        const schema = { type: Type.OBJECT, properties: {
                totalOvertimeHours50: { type: Type.NUMBER },
                totalOvertimeHours100: { type: Type.NUMBER },
                totalNightlyHours: { type: Type.NUMBER },
                totalLatenessMinutes: { type: Type.NUMBER },
                totalAbsencesDays: { type: Type.NUMBER },
                dsrValue: { type: Type.NUMBER },
                aiAnalysisNotes: { type: Type.STRING },
        }, required: ['totalOvertimeHours50', 'totalOvertimeHours100', 'totalNightlyHours', 'totalLatenessMinutes', 'totalAbsencesDays', 'dsrValue', 'aiAnalysisNotes'] };
        
        const response = await ai.models.generateContent({
            model,
            contents: { parts: [filePart, { text: promptText }] },
            config: { responseMimeType: 'application/json', responseSchema: schema },
        });
        res.json(JSON.parse(response.text ?? '{}'));
    } catch (error: any) {
        handleApiError(res, error, "/analyze-timesheet");
    }
};

const findOpportunities = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });

    try {
        const { client } = req.body as { client: Client };
        const prompt = `Busque oportunidades (incentivos fiscais, licitações) para a empresa ${client.company} (CNAEs: ${client.cnaes.join(', ')}). Retorne um array de objetos JSON com type, title, description, source, e submissionDeadline (AAAA-MM-DD). Se nada, retorne [].`;
        const schema = {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING }, source: { type: Type.STRING }, submissionDeadline: { type: Type.STRING, optional: true },
              },
              required: ['type', 'title', 'description', 'source']
            },
        };
        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: schema, tools: [{googleSearch: {}}] },
        });
        res.json(JSON.parse(response.text?.trim() ?? '[]'));
    } catch (error: any) {
        handleApiError(res, error, "/find-opportunities");
    }
};

const checkCompliance = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    try {
        const { client } = req.body as { client: Client };
        const prompt = `Verifique a conformidade (pendências fiscais, CNDs) para a empresa ${client.company}. Retorne um array de objetos JSON com title, status ('OK', 'Atencao', 'Pendencia', 'Informativo'), summary, e sourceUrl. Se tudo OK, retorne um item com status 'OK'.`;
        const schema = {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING }, status: { type: Type.STRING }, summary: { type: Type.STRING }, sourceUrl: { type: Type.STRING },
                },
                required: ['title', 'status', 'summary', 'sourceUrl']
            },
        };

        const response = await ai.models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json', responseSchema: schema, tools: [{googleSearch: {}}] },
        });
        res.json(JSON.parse(response.text?.trim() ?? '[]'));
    } catch (error: any) {
        handleApiError(res, error, "/check-compliance");
    }
};


const chatbotHandler = async (req: Request, res: Response) => {
    if (!ai) return res.status(503).json({ message: "A API do Gemini não foi inicializada." });
    
    try {
        const { message, context } = req.body;
        const user = req.user!;
        const systemInstruction = `Você é o "Assistente JZF" de uma plataforma de contabilidade. Seja amigável e conciso. O usuário é ${user.name}. Contexto atual: ${context || 'Nenhum'}. Responda em texto simples.`;
        
        const response = await ai.models.generateContent({
            model: model,
            contents: message,
            config: { systemInstruction },
        });
        res.json({ reply: response.text });
    } catch (error: any) {
        handleApiError(res, error, "/chatbot");
    }
};

router.post('/cnpj-lookup', cnpjLookup);
router.post('/analyze-quick-send', analyzeQuickSend);
router.post('/analyze-timesheet', analyzeTimesheet);
router.post('/find-opportunities', findOpportunities);
router.post('/check-compliance', checkCompliance);
router.post('/chatbot', chatbotHandler);

export { router as geminiRouter };