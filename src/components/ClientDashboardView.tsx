import React, { useState } from 'react';
import { User, Client, Invoice, Document, Task, Employee, AppNotification } from '../types';
import Icon from './Icon';
import { View } from '../App';
import DocumentRequestSelectionModal from './DocumentRequestSelectionModal';
import * as api from '../services/api';

interface ClientDashboardViewProps {
    currentUser: User;
    clients: Client[];
    invoices: Invoice[];
    documents: Document[];
    tasks: Task[];
    employees: Employee[];
    viewingClientId: number | null;
    setCurrentView: (view: View) => void;
    addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
    users: User[];
}

const StatCard: React.FC<{ title: string; value: string | number; icon: string; }> = ({ title, value, icon }) => (
    <div className="bg-gray-50 p-4 rounded-lg flex items-center border">
        <Icon path={icon} className="w-8 h-8 text-primary mr-4" />
        <div>
            <p className="text-2xl font-bold text-text-primary">{value}</p>
            <p className="text-sm text-text-secondary">{title}</p>
        </div>
    </div>
);

const ListItem: React.FC<{ text: string; subtext: string; status?: React.ReactNode; }> = ({ text, subtext, status }) => (
    <li className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-md">
        <div>
            <p className="text-sm font-semibold text-gray-800">{text}</p>
            <p className="text-xs text-gray-500">{subtext}</p>
        </div>
        {status && <div className="ml-4 flex-shrink-0">{status}</div>}
    </li>
);

const ClientDashboardView: React.FC<ClientDashboardViewProps> = ({ currentUser, clients, invoices, documents, tasks, employees, viewingClientId, setCurrentView, addNotification, users }) => {
    
    const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
    const client = clients.find(c => c.id === viewingClientId);

    const handleRequestChange = async (requestText: string) => {
        if (!viewingClientId) return;
    
        try {
            // Reusing the document request logic as it fits perfectly.
            await api.createDocumentRequest(
                viewingClientId,
                requestText,
                currentUser.name, // The admin's name
                'escritorio' // Source is the office
            );
            
            // Find the user associated with the client to notify them
            const clientUser = users.find(u => u.clientIds?.includes(viewingClientId));
            if(clientUser) {
                addNotification({
                    userId: clientUser.id,
                    message: `Nova solicitação do escritório: ${requestText}`
                });
            }
            alert('Solicitação enviada com sucesso!');
        } catch (error) {
            console.error("Failed to create document request:", error);
            alert('Falha ao enviar solicitação.');
        } finally {
            setIsRequestModalOpen(false);
        }
    };

    if (!client) {
        return (
            <div>
                <button onClick={() => setCurrentView('clientes')} className="flex items-center text-primary mb-4">
                    <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-5 h-5 mr-2" />
                    Voltar para a lista de clientes
                </button>
                <p>Cliente não encontrado.</p>
            </div>
        );
    }

    const clientInvoices = invoices.filter(inv => inv.clientId === client.id);
    const clientDocuments = documents.filter(doc => doc.clientId === client.id);
    const clientTasks = tasks.filter(task => task.clientId === client.id);
    const clientEmployees = employees.filter(emp => emp.clientId === client.id);
    
    const pendingInvoices = clientInvoices.filter(inv => inv.status === 'Pendente' || inv.status === 'Atrasado');
    const pendingTasks = clientTasks.filter(task => task.status === 'Pendente');

    return (
        <div>
            <button onClick={() => setCurrentView('clientes')} className="flex items-center text-primary mb-6 font-semibold hover:underline">
                <Icon path="M10 19l-7-7m0 0l7-7m-7 7h18" className="w-5 h-5 mr-2" />
                Voltar para a lista de clientes
            </button>
            <header className="mb-8 flex justify-between items-start">
                <div>
                    <h2 className="text-3xl font-bold text-black">{client.company}</h2>
                    <p className="text-text-secondary">{client.name} - {client.email}</p>
                </div>
                 <button 
                    onClick={() => setIsRequestModalOpen(true)}
                    className="flex items-center bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors"
                >
                    <Icon path="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4c0-.994.368-1.912.984-2.623" className="w-5 h-5 mr-2" />
                    Solicitar Alteração
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard title="Cobranças Pendentes" value={pendingInvoices.length} icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" />
                <StatCard title="Tarefas Pendentes" value={pendingTasks.length} icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                <StatCard title="Total de Documentos" value={clientDocuments.length} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                <StatCard title="Funcionários Ativos" value={clientEmployees.filter(e => e.status === 'Ativo').length} icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97M15 21h3a2 2 0 002-2v-1a2 2 0 00-2-2h-3m-9-3.076A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076 2.424M11 15.545A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076-2.424" />
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-black mb-4">Últimos Documentos</h3>
                    <ul className="divide-y divide-gray-200">
                        {clientDocuments.slice(0, 5).map(doc => <ListItem key={doc.id} text={doc.name} subtext={`Enviado em ${new Date(doc.uploadDate).toLocaleDateString()}`} status={<span className="text-xs font-semibold px-2 py-1 bg-gray-200 text-gray-800 rounded-full">{doc.status}</span>} />)}
                        {clientDocuments.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum documento.</p>}
                    </ul>
                </div>
                <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-black mb-4">Últimas Cobranças</h3>
                    <ul className="divide-y divide-gray-200">
                         {clientInvoices.slice(0, 5).map(inv => <ListItem key={inv.id} text={inv.description} subtext={`Vencimento: ${new Date(inv.dueDate).toLocaleDateString()}`} status={<span className={`text-xs font-semibold px-2 py-1 ${inv.status === 'Pago' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} rounded-full`}>{inv.status}</span>} />)}
                         {clientInvoices.length === 0 && <p className="text-center text-gray-500 py-4">Nenhuma cobrança.</p>}
                    </ul>
                </div>
            </div>

            <DocumentRequestSelectionModal
                isOpen={isRequestModalOpen}
                onClose={() => setIsRequestModalOpen(false)}
                onSelect={handleRequestChange}
                title="Solicitar Alteração ou Documento"
            />
        </div>
    );
};

export default ClientDashboardView;