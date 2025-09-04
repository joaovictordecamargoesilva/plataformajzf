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
                pendingTasks: clientTasks.filter(task => task.status === 'Pendente').length,
            };
        };

        return (
            <div>
                <h3 className="text-2xl font-bold text-black mb-6">Relatório Geral de Clientes</h3>
                <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                    <table className="min-w-full leading-normal">
                        <thead>
                            <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                <th className="px-5 py-3">Cliente</th>
                                <th className="px-5 py-3 text-center">Cobranças Pendentes</th>
                                <th className="px-5 py-3 text-center">Cobranças Atrasadas</th>
                                <th className="px-5 py-3 text-center">Documentos Pendentes</th>
                                <th className="px-5 py-3 text-center">Tarefas Pendentes</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activeClients.map(client => {
                                const metrics = getClientMetrics(client.id);
                                const hasIssues = metrics.overdueInvoices > 0 || metrics.pendingDocuments > 0 || metrics.pendingTasks > 0;
                                return (
                                    <tr key={client.id} className={`border-b border-gray-200 ${hasIssues ? 'bg-yellow-50' : 'hover:bg-gray-50'}`}>
                                        <td className="px-5 py-4 text-sm">
                                            <p className="text-gray-900 font-semibold whitespace-no-wrap">{client.company}</p>
                                            <p className="text-gray-700 whitespace-no-wrap text-xs">{client.name}</p>
                                        </td>
                                        <td className="px-5 py-4 text-sm text-center">{metrics.pendingInvoices}</td>
                                        <td className={`px-5 py-4 text-sm text-center font-bold ${metrics.overdueInvoices > 0 ? 'text-red-600' : 'text-gray-900'}`}>{metrics.overdueInvoices}</td>
                                        <td className={`px-5 py-4 text-sm text-center font-bold ${metrics.pendingDocuments > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{metrics.pendingDocuments}</td>
                                        <td className={`px-5 py-4 text-sm text-center font-bold ${metrics.pendingTasks > 0 ? 'text-yellow-700' : 'text-gray-900'}`}>{metrics.pendingTasks}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const ClientReport = () => {
        // Placeholder for a potential client-side report view
        return <div>Relatórios para clientes em desenvolvimento.</div>
    }

    return (
        <div>
            {currentUser.role !== 'Cliente' ? <AdminReport /> : <ClientReport />}
        </div>
    );
};

export default NewReportsView;