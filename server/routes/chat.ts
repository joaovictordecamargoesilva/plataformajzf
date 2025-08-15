


import { Router, Request, Response } from 'express';
import '../types';
import { GoogleGenAI, Chat } from '@google/genai';

const router = Router();

const model = "gemini-2.5-flash";

// Initialize the client once, at the top level.
const apiKey = process.env.API_KEY;
if (!apiKey) {
    console.error("A variável de ambiente API_KEY do Google Gemini não está configurada para o chat.");
}
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// In-memory store for user chat sessions. In a real production app, you might use Redis or another store.
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
        2.  **Fazer Perguntas Essenciais:** Nem sempre o usuário dará todos os dados. Você **DEVE** fazer perguntas para obter os números necessários para a simulação. Pergunte sobre:
            *   Custos variáveis e fixos.
            *   Preço atual e margem de lucro.
            *   Volume de vendas atual.
            *   Estimativas de mudança (ex: "Qual o novo preço?", "Quantas vendas a menos você acha que faria?").
        3.  **Executar a Simulação:** Com os dados em mãos, calcule o impacto. Mostre o cenário "ANTES" e "DEPOIS".
        4.  **Apresentar Resultados Claros:** Use formatação (negrito, listas) para apresentar os resultados de forma clara. Mostre o impacto no faturamento, no lucro bruto e na margem de lucro.
        5.  **Dar um Conselho Final:** Com base nos resultados, dê uma breve recomendação ou insight. (ex: "Parece que o aumento de preço, mesmo com uma pequena queda nas vendas, seria lucrativo.").
        6.  **Manter o Foco:** Não desvie para outros assuntos. Seu único objetivo é simular cenários de negócio. Seja sempre cordial, profissional e didático.
    `;

    const chat = ai.chats.create({
      model,
      config: {
        systemInstruction,
      },
    });

    chatSessions.set(userId, chat);
    return chat;
}

// Route to initialize a chat session
router.post('/init', async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        // Clear any previous session for the user
        if (chatSessions.has(userId)) {
            chatSessions.delete(userId);
        }
        await getOrCreateChatSession(userId);
        const initialMessage = "Olá! Sou seu assistente de simulações. Que cenário de negócio você gostaria de explorar hoje? Por exemplo: 'E se eu contratar um novo funcionário?' ou 'Qual o impacto de aumentar o preço do meu serviço em 10%?'";
        res.json({ initialMessage });
    } catch (error: any) {
        console.error("Chat init error:", error);
        res.status(500).json({ message: error.message || 'Falha ao iniciar o chat.' });
    }
});

// Route to send a message to the chat
router.post('/message', async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { message } = req.body;
        if (!message) {
            return res.status(400).json({ message: 'A mensagem não pode ser vazia.' });
        }

        const chat = await getOrCreateChatSession(userId);
        const response = await chat.sendMessage({ message });
        
        res.json({ reply: response.text });

    } catch (error: any) {
        console.error("Chat message error:", error);
        res.status(500).json({ message: error.message || 'Falha ao processar a mensagem.' });
    }
});


export default router;