import React from 'react';
import { User, Client, Invoice, Document, AppNotification, UserPermissions } from '../types';
import Icon from './Icon';
import { View } from '../App';

// Define props for the DashboardView
interface DashboardViewProps {
  currentUser: User;
  clients: Client[];
  invoices: Invoice[];
  documents: Document[];
  notifications: AppNotification[];
  setCurrentView: (view: View) => void;
  activeClientId: number | null;
}

const ActionItem: React.FC<{ icon: string; text: string; buttonText: string; onClick: () => void; }> = ({ icon, text, buttonText, onClick }) => (
    <li className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-all duration-200">
        <div className="flex items-center min-w-0">
            <Icon path={icon} className="w-6 h-6 text-primary mr-3 flex-shrink-0" />
            <p className="text-sm text-gray-800 truncate">{text}</p>
        </div>
        <button onClick={onClick} className="text-sm font-bold text-primary hover:underline ml-4 flex-shrink-0">
            {buttonText}
        </button>
    </li>
);


const DashboardView: React.FC<DashboardViewProps> = ({ currentUser, clients, invoices, documents, notifications, setCurrentView, activeClientId }) => {
    const permissions = currentUser.role === 'AdminGeral' 
        ? { canManageClients: true, canManageDocuments: true, canManageBilling: true, canManageAdmins: true, canManageSettings: true, canViewReports: true, canViewDashboard: true, canManageTasks: true }
        : currentUser.permissions!;

    // Admin-specific data, calculated conditionally based on permissions
    const pendingAdminDocs = permissions?.canManageDocuments 
        ? documents.filter(d => (d.source === 'cliente' && d.status === 'Pendente') || d.status === 'AguardandoAprovacao')
        : [];
    const overdueInvoices = permissions?.canManageBilling 
        ? invoices.filter(inv => inv.status === 'Atrasado') 
        : [];
    const projectedRevenue = permissions?.canManageBilling 
        ? invoices
            .filter(inv => inv.isRecurring)
            .reduce((acc, inv) => acc + inv.amount, 0)
        : 0;

    // Client-specific data
    const clientInvoices = invoices.filter(inv => inv.clientId === activeClientId && (inv.status === 'Pendente' || inv.status === 'Atrasado'));
    const clientDocs = documents.filter(doc => doc.clientId === activeClientId && ((doc.source === 'escritorio' && doc.status === 'Pendente') || doc.status === 'PendenteEtapa2'));

    const userNotifications = notifications
        .filter(n => n.userId === currentUser.id || (currentUser.role.includes('Admin') && !n.userId))
        .slice(0, 5); // Get latest 5

    // Admin: Calculate clients with issues, only if relevant permissions exist
    const clientsWithIssues = currentUser.role !== 'Cliente' && (permissions?.canManageBilling || permissions?.canManageDocuments) ? clients
        .map(client => {
            const issues = {
                overdue: permissions?.canManageBilling ? invoices.filter(i => i.clientId === client.id && i.status === 'Atrasado').length : 0,
                pendingDocs: permissions?.canManageDocuments ? documents.filter(d => d.clientId === client.id && d.source === 'escritorio' && d.status === 'Pendente').length : 0
            };
            const totalIssues = issues.overdue + issues.pendingDocs;
            return { ...client, issues, totalIssues };
        })
        .filter(c => c.totalIssues > 0 && c.status === 'Ativo')
        .sort((a, b) => b.totalIssues - a.totalIssues) : [];

    const StatCard: React.FC<{ title: string; value: number | string; icon: string; color: string; onClick?: () => void; }> = ({ title, value, icon, color, onClick }) => (
        <div 
            className={`bg-white p-6 rounded-lg shadow-lg flex items-center ${onClick ? 'cursor-pointer hover:shadow-xl hover:scale-105 transition-transform' : ''}`}
            onClick={onClick}
        >
            <div className={`p-4 rounded-full mr-4 ${color}`}>
                <Icon path={icon} className="w-8 h-8 text-white" />
            </div>
            <div>
                <p className="text-3xl font-bold text-text-primary">{value}</p>
                <p className="text-gray-600">{title}</p>
            </div>
        </div>
    );

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-6">Bem-vindo(a), {currentUser.name.split(' ')[0]}!</h2>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {currentUser.role !== 'Cliente' ? (
                    <>
                        {permissions?.canManageBilling && (
                            <>
                                <StatCard title="Previsão de Receita (Mês)" value={`R$ ${projectedRevenue.toFixed(2)}`} icon="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" color="bg-green-500" />
                                <StatCard title="Faturas Atrasadas" value={overdueInvoices.length} icon="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" color="bg-red-500" onClick={() => setCurrentView('cobranca')} />
                            </>
                        )}
                        {permissions?.canManageDocuments && (
                            <StatCard title="Documentos Pendentes" value={pendingAdminDocs.length} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" color="bg-yellow-500" onClick={() => setCurrentView('documentos')} />
                        )}
                        {permissions?.canManageClients && (
                            <StatCard title="Total de Clientes Ativos" value={clients.filter(c => c.status === 'Ativo').length} icon="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21v-1a6 6 0 00-5.176-5.97M15 21h3a2 2 0 002-2v-1a2 2 0 00-2-2h-3m-9-3.076A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076 2.424M11 15.545A5.986 5.986 0 017 9.5a5.986 5.986 0 014.076-2.424" color="bg-blue-500" onClick={() => setCurrentView('clientes')} />
                        )}
                    </>
                ) : (
                    <>
                         <StatCard title="Faturas Pendentes" value={clientInvoices.length} icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" color="bg-red-500" onClick={() => setCurrentView('cobranca')} />
                         <StatCard title="Documentos Solicitados" value={clientDocs.length} icon="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" color="bg-yellow-500" onClick={() => setCurrentView('documentos')}/>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                 <div className="bg-white p-6 rounded-lg shadow-lg">
                    <h3 className="text-xl font-bold text-black mb-4">Atividade Recente</h3>
                    {userNotifications.length > 0 ? (
                        <ul className="space-y-4">
                            {userNotifications.map(n => (
                                <li key={n.id} className="flex items-start p-3 bg-gray-50 rounded-md">
                                    <div className="p-2 bg-primary rounded-full mr-4 flex-shrink-0">
                                        <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-800">{n.message}</p>
                                        <p className="text-xs text-gray-500 mt-1">{new Date(n.date).toLocaleString('pt-BR')}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-600">Nenhuma atividade recente para mostrar.</p>
                    )}
                </div>
                
                 <div className="bg-white p-6 rounded-lg shadow-lg">
                    {currentUser.role === 'Cliente' ? (
                        <>
                            <h3 className="text-xl font-bold text-black mb-4">Suas Ações Pendentes</h3>
                            <ul className="space-y-3">
                                {clientInvoices.length === 0 && clientDocs.length === 0 && <p className="text-gray-500 text-sm">Nenhuma pendência encontrada. Bom trabalho!</p>}
                                {clientInvoices.map(inv => <ActionItem key={inv.id} icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" text={`Fatura "${inv.description}" está pendente.`} buttonText="Ver Faturas" onClick={() => setCurrentView('cobranca')} />)}
                                {clientDocs.map(doc => <ActionItem key={doc.id} icon="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" text={`Escritório solicitou: "${doc.name}"`} buttonText="Ver Documentos" onClick={() => setCurrentView('documentos')} />)}
                            </ul>
                        </>
                    ) : (
                        <>
                            {(permissions?.canManageBilling || permissions?.canManageDocuments) && (
                                <>
                                    <h3 className="text-xl font-bold text-black mb-4">Clientes que Precisam de Atenção</h3>
                                    <ul className="space-y-3">
                                        {clientsWithIssues.length === 0 && <p className="text-gray-500 text-sm">Nenhum cliente com pendências críticas. Ótimo!</p>}
                                        {clientsWithIssues.slice(0, 5).map(c => (
                                             <li key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
                                                 <div>
                                                    <p className="font-semibold text-sm text-gray-900">{c.company}</p>
                                                    <p className="text-xs text-gray-600">{c.name}</p>
                                                 </div>
                                                 <div className="text-right flex-shrink-0 ml-4">
                                                    {permissions?.canManageBilling && c.issues.overdue > 0 && <p className="text-xs font-medium text-red-600">{c.issues.overdue} fatura(s) atrasada(s)</p>}
                                                    {permissions?.canManageDocuments && c.issues.pendingDocs > 0 && <p className="text-xs font-medium text-yellow-600">{c.issues.pendingDocs} doc(s) pendente(s)</p>}
                                                 </div>
                                             </li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardView;