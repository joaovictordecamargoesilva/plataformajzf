
import React, { useState, useEffect, useCallback, useMemo, FC } from 'react';
import SideNav from './components/SideNav';
import Header from './components/Header';
import ClientView from './components/ClientView';
import DocumentView from './components/DocumentView';
import BillingView from './components/BillingView';
import Chatbot from './components/Chatbot';
import Login from './components/Login';
import AdminManagementView from './components/AdminManagementView';
import SettingsView from './components/SettingsView';
import DashboardView from './components/DashboardView';
import ReportsView from './components/ReportsView';
import NewReportsView from './components/NewReportsView';
import TasksView from './components/TasksView';
import PontoView from './components/PontoView';
import SimulationView from './components/SimulationView';
import QuickSendModal from './components/QuickSendModal';
import { User, Client, Document, Invoice, Payment, Settings, AppNotification, Task, Opportunity, TaskTemplateSet, Employee, TimeSheet, DocumentTemplate, ComplianceFinding } from './types';
import * as api from './services/api';
import Icon from './components/Icon';

export type View = 'dashboard' | 'clientes' | 'documentos' | 'cobranca' | 'administradores' | 'configuracoes' | 'relatorios' | 'tarefas' | 'novos-relatorios' | 'ponto' | 'simulacoes';

const LoadingSpinner = () => (
    <div className="flex justify-center items-center h-screen w-screen fixed top-0 left-0 bg-white/70 z-[100]">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
    </div>
);

const ErrorDisplay = ({ error }: { error: string }) => (
    <div className="flex flex-col justify-center items-center h-screen w-screen bg-light-gray text-center p-4">
        <Icon path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" className="w-16 h-16 text-yellow-500 mb-4" />
        <h2 className="text-2xl font-bold text-text-primary mb-2">Ops! Algo deu errado.</h2>
        <p className="text-text-secondary mb-6">{error}</p>
        <button 
            onClick={() => window.location.reload()}
            className="bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors"
        >
            Tentar Novamente
        </button>
    </div>
);


const App = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [settings, setSettings] = useState<Settings>({ pixKey: '', paymentLink: '' });
    const [notifications, setNotifications] = useState<AppNotification[]>([]);
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [complianceFindings, setComplianceFindings] = useState<ComplianceFinding[]>([]);
    const [taskTemplateSets, setTaskTemplateSets] = useState<TaskTemplateSet[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [timeSheets, setTimeSheets] = useState<TimeSheet[]>([]);
    const [documentTemplates, setDocumentTemplates] = useState<DocumentTemplate[]>([]);
    const [currentUserId, setCurrentUserId] = useState<number | null>(null);

    const [activeClientId, setActiveClientId] = useState<number | null>(null);
    const [isQuickSendModalOpen, setQuickSendModalOpen] = useState(false);
    const [isRadarRunning, setIsRadarRunning] = useState(false);
    const [directAction, setDirectAction] = useState<{type: string, payload: any} | null>(null);
    const [currentView, setCurrentView] = useState<View>('dashboard');

    const currentUser = useMemo(() => {
        if (!currentUserId) return null;
        return users.find(u => u.id === currentUserId) || null;
    }, [currentUserId, users]);
    
    // Initial data load
    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await api.fetchAllData();
                setUsers(data.users || []);
                setClients(data.clients || []);
                setDocuments(data.documents || []);
                setInvoices(data.invoices || []);
                setPayments(data.payments || []);
                setTasks(data.tasks || []);
                setSettings(data.settings || { pixKey: '', paymentLink: '' });
                setNotifications(data.notifications || []);
                setOpportunities(data.opportunities || []);
                setComplianceFindings(data.complianceFindings || []);
                setTaskTemplateSets(data.taskTemplateSets || []);
                setEmployees(data.employees || []);
                setTimeSheets(data.timeSheets || []);
                setDocumentTemplates(data.documentTemplates || []);
                setCurrentUserId(data.currentUserId);
                
                const user = data.users.find((u: User) => u.id === data.currentUserId);
                if (user) {
                    setCurrentView('dashboard');
                }
                
                // --- Active Client Validation Logic ---
                // This logic now runs immediately after fetching data, preventing any race conditions.
                let finalActiveClientId = data.activeClientId;

                if (user && user.role === 'Cliente' && user.clientIds && user.clientIds.length > 0) {
                    const storedId = data.activeClientId;
                    if (!storedId || !user.clientIds.includes(storedId)) {
                        // If the stored client is invalid, default to the first one and update the server.
                        finalActiveClientId = user.clientIds[0];
                        await api.setActiveClient(finalActiveClientId);
                    }
                } else if (user && user.role !== 'Cliente' && data.activeClientId !== null) {
                    // If an admin has an active client, clear it.
                    finalActiveClientId = null;
                    await api.setActiveClient(null);
                }
                setActiveClientId(finalActiveClientId);
                
            } catch (error: any) {
                console.error("Failed to fetch initial data:", error.message || error);
                if (error.message.includes('Não autorizado')) {
                    setCurrentUserId(null);
                } else {
                    setError("Não foi possível carregar os dados da aplicação. O servidor pode estar indisponível.");
                }
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSwitchClient = useCallback(async (clientId: number | null) => {
        if (currentUser?.role !== 'Cliente' || (clientId !== null && currentUser?.clientIds?.includes(clientId))) {
            await api.setActiveClient(clientId);
            setActiveClientId(clientId);
        } else if (currentUser?.role !== 'Cliente' && clientId === null) {
            await api.setActiveClient(null);
            setActiveClientId(null);
        }
    }, [currentUser]);


    const addNotification = useCallback(async (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => {
        try {
            const newNotification = await api.addNotification(notification);
            setNotifications(prev => [newNotification, ...prev]);
             if (Notification.permission === 'granted') {
                new Notification('Plataforma JZF', {
                    body: newNotification.message,
                    icon: '/favicon.svg'
                });
            }
        } catch (error) {
            console.error("Failed to add notification", error);
        }
    }, []);

    const handleLogin = async (username: string, password: string) => {
        try {
            await api.login(username, password);
            window.location.reload();
        } catch (error: any) {
            console.error("Login failed:", error);
            throw error;
        }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        await api.logout();
        setCurrentUserId(null); // Immediately clear user
        window.location.reload();
    };
    
    // --- Data mutation handlers ---
    
    const handleSaveClient = async (clientData: any, isEditing: boolean) => {
        setIsLoading(true);
        try {
            if (isEditing) {
                const updatedClient = await api.updateClient(clientData);
                setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
                if (clientData.password) {
                    const updatedUser = await api.updateUserPassword(updatedClient.userId, clientData.password);
                    setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
                }
            } else {
                const { newClient, newUser, newTasks } = await api.onboardClient(clientData);
                setClients(prev => [...prev, newClient]);
                setUsers(prev => [...prev, newUser]);
                if (newTasks.length > 0) setTasks(prev => [...prev, ...newTasks]);
                addNotification({ userId: newUser.id, message: `Bem-vindo à Plataforma JZF! Seu acesso foi criado.` });
            }
        } catch (error) {
            console.error("Failed to save client:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInactivateClient = async (clientId: number) => {
        setIsLoading(true);
        try {
            const inactivatedClient = await api.inactivateClient(clientId);
            setClients(clients.map(c => c.id === clientId ? inactivatedClient : c));
            const userToUpdate = users.find(u => u.id === inactivatedClient.userId);
            if (userToUpdate) {
                setUsers(users.map(u => u.id === userToUpdate.id ? { ...u, clientIds: u.clientIds?.filter(id => id !== clientId) } : u));
            }
        } catch (error) {
            console.error("Failed to inactivate client:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClient = async (clientId: number) => {
        setIsLoading(true);
        try {
            await api.deleteClient(clientId);
            const clientToDelete = clients.find(c => c.id === clientId);
            setClients(clients.filter(c => c.id !== clientId));
            if (clientToDelete) {
                setUsers(users.map(u => u.id === clientToDelete.userId ? { ...u, clientIds: u.clientIds?.filter(id => id !== clientId) } : u));
            }
        } catch (error) {
            console.error("Failed to delete client:", error);
        } finally {
            setIsLoading(false);
        }
    }

    const titleMap: Record<View, string> = {
        dashboard: 'Dashboard',
        clientes: 'Gestão de Clientes',
        documentos: 'Gestão de Documentos',
        cobranca: 'Cobranças e Pagamentos',
        administradores: 'Gestão de Administradores',
        configuracoes: 'Configurações',
        relatorios: 'Análise e Oportunidades',
        'novos-relatorios': 'Relatórios Gerenciais',
        tarefas: 'Gestão de Tarefas',
        ponto: 'Folha de Ponto',
        simulacoes: 'Simulações de Negócio'
    };

    if (isLoading) {
        return <LoadingSpinner />;
    }

    if (error) {
        return <ErrorDisplay error={error} />;
    }

    if (!currentUser) {
        return <Login onLogin={handleLogin} />;
    }

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardView currentUser={currentUser} clients={clients} invoices={invoices} documents={documents} notifications={notifications} setCurrentView={setCurrentView} activeClientId={activeClientId} />;
            case 'clientes': return <ClientView clients={clients} users={users} currentUser={currentUser} addNotification={addNotification} taskTemplateSets={taskTemplateSets} onSave={handleSaveClient} onInactivate={handleInactivateClient} onDelete={handleDeleteClient} setIsLoading={setIsLoading}/>;
            case 'documentos': return <DocumentView documents={documents} setDocuments={setDocuments} currentUser={currentUser} clients={clients} users={users} addNotification={addNotification} documentTemplates={documentTemplates} directAction={directAction} setDirectAction={setDirectAction} setTasks={setTasks} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'cobranca': return <BillingView invoices={invoices} setInvoices={setInvoices} currentUser={currentUser} clients={clients} settings={settings} addNotification={addNotification} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'administradores': return <AdminManagementView users={users} setUsers={setUsers} setIsLoading={setIsLoading} />;
            case 'configuracoes': return <SettingsView settings={settings} setSettings={setSettings} taskTemplateSets={taskTemplateSets} setTaskTemplateSets={setTaskTemplateSets} setIsLoading={setIsLoading} />;
            case 'relatorios': return <ReportsView currentUser={currentUser} clients={clients} opportunities={opportunities} setOpportunities={setOpportunities} complianceFindings={complianceFindings} setComplianceFindings={setComplianceFindings} isRadarRunning={isRadarRunning} activeClientId={activeClientId}/>;
            case 'novos-relatorios': return <NewReportsView currentUser={currentUser} clients={clients} invoices={invoices} documents={documents} tasks={tasks} activeClientId={activeClientId} />;
            case 'tarefas': return <TasksView tasks={tasks} setTasks={setTasks} currentUser={currentUser} clients={clients} users={users} addNotification={addNotification} setDirectAction={setDirectAction} setCurrentView={setCurrentView} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'ponto': return <PontoView clients={clients} employees={employees} setEmployees={setEmployees} timeSheets={timeSheets} setTimeSheets={setTimeSheets} currentUser={currentUser} addNotification={addNotification} users={users} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'simulacoes': return <SimulationView currentUser={currentUser} />;
            default: return <div>Página não encontrada</div>;
        }
    };

    return (
        <div className="flex h-screen bg-light-gray">
            <SideNav currentView={currentView} setCurrentView={setCurrentView} currentUser={currentUser} onOpenQuickSend={() => setQuickSendModalOpen(true)} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header 
                    currentUser={currentUser} 
                    onLogout={handleLogout} 
                    title={titleMap[currentView]}
                    notifications={notifications}
                    setNotifications={setNotifications}
                    activeClientId={activeClientId}
                    handleSwitchClient={handleSwitchClient}
                    clients={clients}
                    setIsLoading={setIsLoading}
                />
                <main className="flex-1 overflow-x-hidden overflow-y-auto p-8">
                    {renderView()}
                </main>
            </div>
            <Chatbot currentUser={currentUser} tasks={tasks} documents={documents} invoices={invoices} activeClientId={activeClientId}/>
            <QuickSendModal
                isOpen={isQuickSendModalOpen}
                onClose={() => setQuickSendModalOpen(false)}
                currentUser={currentUser}
                setDocuments={setDocuments}
                addNotification={addNotification}
                users={users}
                activeClientId={activeClientId}
                setIsLoading={setIsLoading}
             />
        </div>
    );
};

export default App;
