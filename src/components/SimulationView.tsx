import React, { useState, useEffect, useRef } from 'react';
import { User } from '../types';
import Icon from './Icon';
import * as api from '../services/api';
import { marked } from 'marked';


interface Message {
  sender: 'user' | 'bot';
  text: string;
}

interface SimulationViewProps {
  currentUser: User;
}

const SimulationView: React.FC<SimulationViewProps> = ({ currentUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initChat = async () => {
      try {
        setIsLoading(true);
        const { initialMessage } = await api.initChatSession();
        setMessages([{ sender: 'bot', text: initialMessage }]);
        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to initialize chat:", error);
        setMessages([{ sender: 'bot', text: 'Desculpe, não consegui iniciar o assistente de simulações no momento.' }]);
      } finally {
        setIsLoading(false);
      }
    };
    initChat();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (userInput.trim() === '' || isLoading || !isInitialized) return;

    const userMessage: Message = { sender: 'user', text: userInput };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    try {
      const { reply } = await api.sendChatMessage(currentInput);
      const botMessage: Message = { sender: 'bot', text: reply };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: Message = { sender: 'bot', text: 'Desculpe, ocorreu um erro ao processar sua simulação. Tente novamente.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  const parseMarkdown = (text: string) => {
      // Basic sanitation
      const cleanText = text.replace(/<script.*?>.*?<\/script>/gi, '');
      return marked.parse(cleanText, { breaks: true });
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <header className="p-4 border-b">
        <h2 className="text-xl font-bold text-text-primary">Simulações de Negócio com IA</h2>
        <p className="text-sm text-text-secondary">Explore cenários, analise impactos e tome decisões mais inteligentes.</p>
      </header>

      <div className="flex-1 p-6 overflow-y-auto">
        <div className="space-y-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${msg.sender === 'bot' ? 'bg-primary' : 'bg-gray-600'}`}>
                {msg.sender === 'bot' ? 
                  <Icon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-6 h-6"/> :
                  <Icon path="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" className="w-6 h-6"/>
                }
              </div>
              <div className={`p-4 rounded-lg max-w-lg ${msg.sender === 'bot' ? 'bg-gray-100' : 'bg-primary text-white'}`}>
                <div 
                  className={`prose prose-sm max-w-none ${msg.sender === 'bot' ? 'text-black' : 'prose-invert'}`} 
                  dangerouslySetInnerHTML={{ __html: parseMarkdown(msg.text) }} 
                />
              </div>
            </div>
          ))}
          {isLoading && !isInitialized && (
            <div className="text-center text-gray-500">Inicializando assistente...</div>
          )}
          {isLoading && isInitialized && (
             <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white">
                    <Icon path="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" className="w-6 h-6"/>
                </div>
                <div className="p-4 rounded-lg bg-gray-100">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" style={{animationDelay: '0.4s'}}></div>
                    </div>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <footer className="p-4 border-t bg-gray-50 rounded-b-lg">
        <div className="flex items-center gap-4">
          <textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                }
            }}
            placeholder="Digite seu cenário aqui..."
            className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            rows={2}
            disabled={isLoading || !isInitialized}
          />
          <button onClick={handleSendMessage} disabled={isLoading || !userInput.trim() || !isInitialized} className="bg-primary text-white p-3 rounded-lg hover:bg-primary-dark disabled:bg-gray-400 disabled:cursor-not-allowed flex-shrink-0 self-stretch flex items-center justify-center">
            <Icon path="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" className="w-6 h-6" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default SimulationView;