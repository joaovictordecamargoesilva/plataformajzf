import React, { useState, useCallback } from 'react';
import { User, Document, AppNotification } from '../types';
import * as api from '../services/api';
import Modal from './Modal';
import Icon from './Icon';

interface QuickSendModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentUser: User;
    setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
    addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
    users: User[];
    activeClientId: number | null;
    setIsLoading: (loading: boolean) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
};

const QuickSendModal: React.FC<QuickSendModalProps> = ({ isOpen, onClose, currentUser, setDocuments, addNotification, users, activeClientId, setIsLoading }) => {
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysis, setAnalysis] = useState<any>(null);
    const [error, setError] = useState('');

    const resetState = () => {
        setFile(null);
        setDescription('');
        setIsAnalyzing(false);
        setAnalysis(null);
        setError('');
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            setFile(e.target.files[0]);
            setAnalysis(null);
            setError('');
        }
    };

    const handleAnalyze = async () => {
        if (!file || !activeClientId) return;
        setIsAnalyzing(true);
        setError('');
        try {
            const base64 = await fileToBase64(file);
            const result = await api.analyzeScannedDocument(base64, file.type, description);
            setAnalysis(result);
        } catch (err: any) {
            setError(err.message || 'Falha na análise. Tente novamente.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirmSend = async () => {
        if (!file || !analysis || !activeClientId) return;
        setIsLoading(true);
        handleClose();
        
        try {
            const base64 = await fileToBase64(file);
            const newDocData = {
                clientId: activeClientId,
                name: analysis.suggestedName || file.name,
                description: `Enviado via Envio Rápido. Classificação sugerida: ${analysis.suggestedClassification || 'N/A'}. Valor: R$ ${analysis.extractedTotal?.toFixed(2) || 'N/A'}`,
                file: { name: file.name, type: file.type, content: base64 },
                uploadedBy: currentUser.name,
            };

            const newDoc = await api.createQuickSendDocument(newDocData);
            setDocuments(prev => [newDoc, ...prev]);

            users.filter(u => u.role.includes('Admin')).forEach(admin => {
                addNotification({
                    userId: admin.id,
                    message: `${currentUser.name} enviou um novo documento: ${newDoc.name}`
                });
            });
        } catch (error) {
            console.error("Failed to quick send document:", error);
        } finally {
            setIsLoading(false);
        }
    };


    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="lg">
            <h3 className="text-xl font-bold text-black mb-4">Envio Rápido de Documento</h3>
            
            {!analysis ? (
                <div className="space-y-4">
                    <p className="text-gray-600">Envie um arquivo (recibo, nota fiscal, etc.) e nossa IA irá analisá-lo e classificá-lo para você.</p>
                    <div>
                        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">Arquivo (PDF, JPG, PNG)</label>
                        <input id="file-upload" type="file" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1" accept="image/*,application/pdf" />
                    </div>
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrição (Opcional)</label>
                        <input id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Gasolina da viagem para SP" className="w-full p-2 border rounded mt-1" />
                    </div>
                    
                    {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    
                    <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={handleClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                        <button type="button" onClick={handleAnalyze} disabled={!file || isAnalyzing} className="bg-primary text-white font-bold py-2 px-4 rounded-lg disabled:opacity-50">
                            {isAnalyzing ? 'Analisando...' : 'Analisar e Enviar'}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                    <h4 className="font-semibold text-lg">Revisar Informações Extraídas</h4>
                    <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                         <p><strong>Nome Sugerido:</strong> {analysis.suggestedName}</p>
                         <p><strong>Classificação Sugerida:</strong> {analysis.suggestedClassification}</p>
                         <p><strong>Data Extraída:</strong> {analysis.extractedDate ? new Date(analysis.extractedDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : 'N/A'}</p>
                         <p><strong>Valor Total:</strong> R$ {analysis.extractedTotal?.toFixed(2) || 'N/A'}</p>
                    </div>
                    <p className="text-sm text-gray-600">Se as informações estiverem corretas, confirme o envio. Caso contrário, você pode voltar e tentar novamente.</p>
                     <div className="mt-6 flex justify-end space-x-3">
                        <button type="button" onClick={() => setAnalysis(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Voltar</button>
                        <button type="button" onClick={handleConfirmSend} className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg">
                            Confirmar e Enviar
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );
};

export default QuickSendModal;