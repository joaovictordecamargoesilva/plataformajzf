import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './Icon';
import { sendBotMessage } from '../services/api';
import { User, Task, Document, Invoice } from '../types';

interface Message {
  sender: 'user' | 'bot';
  text: string;
}

interface ChatbotProps {
  currentUser: User | null;
  tasks: Task[];
  documents: Document[];
  invoices: Invoice[];
  activeClientId: number | null;
}

const fileToBase64 = (file: File): Promise<{content: string, mimeType: string}> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({ content: (reader.result as string).split(',')[1], mimeType: file.type });
      reader.onerror = error => reject(error);
    });
};

const Chatbot: React.FC<ChatbotProps> = ({ currentUser, tasks, documents, invoices, activeClientId }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [initialMessageSet, setInitialMessageSet] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  
  useEffect(() => {
    if (isOpen && !initialMessageSet) {
      let proactiveMessage = 'Olá! Sou o assistente virtual da JZF. Como posso ajudar?';
      
      if (currentUser?.role === 'Cliente' && activeClientId) {
        // Prioritize pending recurring tasks
        const pendingRecurringTask = tasks.find(t => 
          t.clientId === activeClientId && 
          t.isRecurring && 
          t.status === 'Pendente'
        );
        
        if (pendingRecurringTask) {
          proactiveMessage = `Olá, ${currentUser.name}. Notei que a tarefa mensal "${pendingRecurringTask.description}" está pendente. Posso te ajudar com isso ou esclarecer alguma dúvida?`;
        } else {
          // Check for documents requested by the office
          const pendingDocRequest = documents.find(d => 
            d.clientId === activeClientId && 
            d.source === 'escritorio' && 
            d.status === 'Pendente'
          );
          if (pendingDocRequest) {
            proactiveMessage = `Olá, ${currentUser.name}. Vi que o escritório solicitou o documento "${pendingDocRequest.requestText || pendingDocRequest.name}". Precisa de ajuda para encontrar ou enviar este documento?`;
          }
        }
      }

      setMessages([{ sender: 'bot', text: proactiveMessage }]);
      setInitialMessageSet(true);

    } else if (!isOpen && initialMessageSet) {
        // Reset when closed so it can be triggered again next time
        setInitialMessageSet(false);
        setMessages([]);
        setAttachedFile(null);
    }
  }, [isOpen, currentUser, tasks, documents, initialMessageSet, activeClientId]);


  const handleSendMessage = useCallback(async () => {
    if ((userInput.trim() === '' && !attachedFile) || isLoading || !currentUser || activeClientId === null) return;

    const newMessages: Message[] = [...messages, { sender: 'user', text: userInput }];
    setMessages(newMessages);
    const currentInput = userInput;
    const currentFile = attachedFile;
    setUserInput('');
    setAttachedFile(null);
    setIsLoading(true);

    let context = '';
    const lowerCaseInput = currentInput.toLowerCase();

    if (lowerCaseInput.includes('fatura') || lowerCaseInput.includes('cobrança') || lowerCaseInput.includes('boleto')) {
        const userInvoices = invoices
            .filter(inv => inv.clientId === activeClientId)
            .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());
        if (userInvoices.length > 0) {
            const lastInvoice = userInvoices[0];
            context += `Última fatura do usuário: Descrição='${lastInvoice.description}', Valor=R$${lastInvoice.amount.toFixed(2)}, Vencimento='${new Date(lastInvoice.dueDate).toLocaleDateString('pt-BR')}', Status='${lastInvoice.status}'.`;
        }
    }

    if (lowerCaseInput.includes('tarefa') || lowerCaseInput.includes('pendência')) {
        const pendingTasks = tasks.filter(t => t.clientId === activeClientId && t.status === 'Pendente');
        if (pendingTasks.length > 0) {
            context += ` Tarefas pendentes do usuário: ${pendingTasks.map(t => `"${t.description}"`).join(', ')}.`;
        } else {
            context += ` O usuário não possui tarefas pendentes.`;
        }
    }
    
    try {
      let filePayload = undefined;
      if (currentFile) {
        filePayload = await fileToBase64(currentFile);
      }
      const response = await sendBotMessage(currentInput, context, filePayload);
      setMessages([...newMessages, { sender: 'bot', text: response.reply }]);
    } catch (error) {
      console.error("Error sending message to Gemini:", error);
      const errorMessage = error instanceof Error ? error.message : "Desculpe, ocorreu um erro. Tente novamente.";
      setMessages([...newMessages, { sender: 'bot', text: errorMessage }]);
    } finally {
      setIsLoading(false);
    }
  }, [userInput, attachedFile, isLoading, messages, currentUser, invoices, tasks, documents, activeClientId]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setAttachedFile(event.target.files[0]);
    }
  };


  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-8 right-8 bg-primary text-white p-4 rounded-full shadow-xl hover:bg-primary-dark transition-transform transform hover:scale-110"
        aria-label="Abrir chat do assistente virtual"
      >
        <Icon path="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" className="w-8 h-8" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-8 right-8 w-96 h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300">
      <header className="bg-primary text-white p-4 flex justify-between items-center rounded-t-2xl">
        <h3 className="font-bold text-lg">Assistente Virtual JZF</h3>
        <button onClick={() => setIsOpen(false)} className="hover:bg-primary-dark rounded-full p-1">
          <Icon path="M6 18L18 6M6 6l12 12" className="w-6 h-6" />
        </button>
      </header>
      <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
        {messages.map((msg, index) => (
          <div key={index} className={`flex mb-4 ${msg.sender === 'bot' ? 'justify-start' : 'justify-end'}`}>
            <div className={`rounded-lg p-3 max-w-xs text-white ${msg.sender === 'bot' ? 'bg-primary' : 'bg-gray-600'}`}>
              <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start mb-4">
                 <div className="rounded-lg p-3 max-w-xs bg-primary text-white">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 rounded-full bg-white animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      <footer className="p-4 border-t border-gray-200">
        {attachedFile && (
            <div className="mb-2 p-2 bg-gray-100 rounded-lg flex justify-between items-center text-sm">
                <span className="truncate text-gray-700">{attachedFile.name}</span>
                <button onClick={() => setAttachedFile(null)} className="text-red-500 hover:text-red-700">
                    <Icon path="M6 18L18 6M6 6l12 12" className="w-4 h-4" />
                </button>
            </div>
        )}
        <div className="flex items-center">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button onClick={() => fileInputRef.current?.click()} disabled={isLoading} className="mr-2 text-gray-500 hover:text-primary p-2 rounded-full disabled:text-gray-300">
            <Icon path="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" className="w-6 h-6" />
          </button>
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Digite sua dúvida..."
            className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isLoading}
          />
          <button onClick={handleSendMessage} disabled={isLoading || (!userInput.trim() && !attachedFile)} className="ml-2 bg-primary text-white p-2 rounded-lg hover:bg-primary-dark disabled:bg-gray-400">
             <Icon path="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" className="w-6 h-6" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Chatbot;