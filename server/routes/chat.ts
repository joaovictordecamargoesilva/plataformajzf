import express, { Request, Response } from 'express';
import {} from '../types';
import { GoogleGenAI, Chat } from '@google/genai';

const router = express.Router();

const model = "gemini-2.5-flash";

const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("A variável de ambiente API_KEY do Google Gemini não está configurada para o chat.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

const chatSessions = new Map<number, Chat>();

async function getOrCreateChatSession(userId: number): Promise<Chat> {
    if (chatSessions.has(userId)) {
        return chatSessions.get(userId)!;
    }

    if (!ai) {
        throw new Error("A API do Gemini não foi inicializada. Verifique a API_KEY.");
    }

    const systemInstruction = `
        Você é um "Simulador de Negócios" da plataforma JZF Contabilidade. Sua missão é ajudar os clientes a tomar decisões estratégicas, simulando cenários e calculando impactos.

        **SEU PROCESSO DEVE SER:**
        1.  **Receber o Cenário Inicial:** O usuário dirá o que quer simular (ex: "E se eu aumentar o preço do meu produto?").
        2.  **Fazer Perguntas Essenciais:** NUNCA responda diretamente. Sua primeira resposta DEVE SER SEMPRE uma série de perguntas para coletar dados essenciais que faltam. Seja curioso e investigativo. As perguntas devem ser claras e numeradas.
        3.  **Analisar e Apresentar a Simulação:** Depois que o usuário responder, use os dados para criar uma simulação detalhada. Apresente a resposta usando Markdown, com os seguintes cabeçalhos:
            - **## Cenário Simulado:** (Resuma o que está sendo testado).
            - **## Dados Considerados:** (Liste os dados que você usou, tanto os fornecidos pelo usuário quanto premissas que você assumiu).
            - **## Análise e Raciocínio:** (Explique passo a passo como chegou à conclusão. Mostre os cálculos).
            - **## Potenciais Riscos:** (Liste os pontos negativos ou desafios do cenário).
            - **## Recomendações:** (Dê conselhos práticos baseados na simulação).
        4.  **Manter a Conversa:** Permaneça no personagem e continue a conversa, permitindo que o usuário ajuste os parâmetros ou explore novos cenários.
        `;

    const chat = ai.chats.create({
      model,
      config: { systemInstruction },
    });

    chatSessions.set(userId, chat);
    return chat;
}

const initHandler = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        await getOrCreateChatSession(userId); 
        res.json({
            initialMessage: 'Olá! Sou seu assistente de simulações. Descreva um cenário de negócio que você gostaria de explorar. Por exemplo: "O que acontece se eu contratar um novo funcionário?"'
        });
    } catch (error: any) {
        console.error("Error initializing chat:", error.message);
        res.status(503).json({ message: error.message });
    }
};

const messageHandler = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message content is required.' });
        }

        const chatSession = await getOrCreateChatSession(userId);
        
        const response = await chatSession.sendMessage({ message });
        res.json({ reply: response.text });

    } catch (error: any) {
        console.error('Error sending message to Gemini:', error.message);
        const errorMessage = (error.message && error.message.includes("API_KEY")) 
            ? error.message
            : 'Falha ao obter uma resposta do assistente de IA.';
        const errorStatus = (error.message && error.message.includes("API_KEY")) ? 503 : 500;
        res.status(errorStatus).json({ error: errorMessage });
    }
};

router.post('/init', initHandler);
router.post('/message', messageHandler);

export { router as chatRouter };