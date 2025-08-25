import React from 'react';
import { User, Client, Invoice, Document, Task } from '../types';
import Icon from './Icon';

interface NewReportsViewProps {
  currentUser: User;
  clients: Client[];
  invoices: Invoice[];
  documents: Document[];
  tasks: Task[];
  activeClientId: number | null;
}

const StatCard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-6 rounded-lg shadow-lg flex items-center">
        <div className={`p-4 rounded-full mr-4 ${color}`}>
            <Icon path={icon} className="w-8 h-8 text-white" />
        </div>
        <div>
            <p className="text-3xl font-bold text-text-primary">{value}</p>
            <p className="text-text-secondary">{title}</p>
        </div>
    </div>
);

const NewReportsView: React.FC<NewReportsViewProps> = ({ currentUser, clients, invoices, documents, tasks, activeClientId }) => {

    const AdminReport = () => {
        const activeClients = clients.filter(c => c.status === 'Ativo');

        const permissions = currentUser.role === 'AdminGeral' 
            ? { canManageClients: true, canManageDocuments: true, canManageBilling: true, canManageAdmins: true, canManageSettings: true, canViewReports: true, canViewDashboard: true, canManageTasks: true }
            : currentUser.permissions!;

        const getClientMetrics = (clientId: number) => {
            const clientInvoices = permissions.canManageBilling ? invoices.filter(inv => inv.clientId === clientId) : [];
            const clientDocs = permissions.canManageDocuments ? documents.filter(doc => doc.clientId === clientId) : [];
            const clientTasks = permissions.canManageTasks ? tasks.filter(task => task.clientId === clientId) : [];

            return {
                pendingInvoices: clientInvoices.filter(inv => inv.status === 'Pendente').length,
                overdueInvoices: clientInvoices.filter(inv => inv.status === 'Atrasado').length,
                pendingDocuments: clientDocs.filter(doc => doc.status === 'Pendente' || doc.status === 'PendenteEtapa2').length,
                pendingTasks: clientTasks.filter(task => task.status === 'Pendente').length
            };
        };

        return (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            <th className="px-5 py-3">Cliente</th>
                            {permissions.canManageBilling && <th className="px-5 py-3 text-center">Faturas Pendentes</th>}
                            {permissions.canManageBilling && <th className="px-5 py-3 text-center">Faturas Atrasadas</th>}
                            {permissions.canManageDocuments && <th className="px-5 py-3 text-center">Documentos Pendentes</th>}
                            {permissions.canManageTasks && <th className="px-5 py-3 text-center">Tarefas Pendentes</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {activeClients.map(client => {
                            const metrics = getClientMetrics(client.id);
                            const hasIssues = metrics.overdueInvoices > 0 || metrics.pendingDocuments > 0 || metrics.pendingTasks > 0;
                            return (
                                <tr key={client.id} className={`border-b border-gray-200 hover:bg-gray-50 ${hasIssues ? 'bg-red-50' : ''}`}>
                                    <td className="px-5 py-5 text-sm">
                                        <p className="text-gray-900 font-semibold whitespace-no-wrap">{client.name}</p>
                                        <p className="text-gray-700 whitespace-no-wrap">{client.company}</p>
                                    </td>
                                    {permissions.canManageBilling && <td className="px-5 py-5 text-sm text-center">{metrics.pendingInvoices}</td>}
                                    {permissions.canManageBilling && <td className={`px-5 py-5 text-sm text-center font-bold ${metrics.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-700'}`}>{metrics.overdueInvoices}</td>}
                                    {permissions.canManageDocuments && <td className={`px-5 py-5 text-sm text-center font-bold ${metrics.pendingDocuments > 0 ? 'text-yellow-600' : 'text-gray-700'}`}>{metrics.pendingDocuments}</td>}
                                    {permissions.canManageTasks && <td className={`px-5 py-5 text-sm text-center font-bold ${metrics.pendingTasks > 0 ? 'text-yellow-600' : 'text-gray-700'}`}>{metrics.pendingTasks}</td>}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const ClientReport = () => {
        if (!activeClientId) return null;

        const paidInvoices = invoices.filter(inv => inv.clientId === activeClientId && inv.status === 'Pago');
        const totalPaid = paidInvoices.reduce((acc, inv) => acc + inv.amount, 0);

        const submittedDocs = documents.filter(doc => doc.clientId === activeClientId && doc.source === 'cliente').length;
        const completedTasks = tasks.filter(task => task.clientId === activeClientId && task.status === 'Concluida').length;

        return (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <StatCard 
                    title="Total Pago Este Ano" 
                    value={`R$ ${totalPaid.toFixed(2)}`} 
                    icon="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" 
                    color="bg-green-500" 
                />
                <StatCard 
                    title="Documentos Enviados" 
                    value={submittedDocs.toString()} 
                    icon="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                    color="bg-blue-500" 
                />
                <StatCard 
                    title="Tarefas Concluídas" 
                    value={completedTasks.toString()} 
                    icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                    color="bg-indigo-500" 
                />
            </div>
        );
    };

    const isClient = currentUser.role === 'Cliente';

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">
                {isClient ? 'Seu Resumo Anual' : 'Relatório de Saúde do Cliente'}
            </h2>
            <p className="text-gray-700 mb-8">
                {isClient 
                    ? 'Acompanhe um resumo de suas atividades na plataforma.' 
                    : 'Use este painel para monitorar rapidamente as pendências de cada cliente ativo.'}
            </p>

            {isClient ? <ClientReport /> : <AdminReport />}
        </div>
    );
};

export default NewReportsView;