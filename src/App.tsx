import React, { useState, useEffect, useCallback, useMemo, FC, useRef } from 'react';
import SideNav from './components/SideNav';
import Header from './components/Header';
import ClientView from './components/ClientView';
import DocumentView from './components/DocumentView';
import { BillingView } from './components/BillingView';
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
import ClientDashboardView from './components/ClientDashboardView';
import MultiClientDashboardView from './components/MultiClientDashboardView';
import { User, Client, Document, Invoice, Settings, AppNotification, Task, Opportunity, TaskTemplateSet, Employee, TimeSheet, DocumentTemplate, ComplianceFinding } from './types';
import * as api from './services/api';
import Icon from './components/Icon';

export type View = 'dashboard' | 'clientes' | 'documentos' | 'cobranca' | 'administradores' | 'configuracoes' | 'relatorios' | 'tarefas' | 'novos-relatorios' | 'ponto' | 'simulacoes' | 'client-dashboard' | 'multi-client-dashboard';

const LoadingSpinner: FC = () => (
    <div className="flex justify-center items-center h-screen w-screen fixed top-0 left-0 bg-white/70 z-[100]">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
    </div>
);

const ErrorDisplay: FC<{ error: string }> = ({ error }) => (
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


const App: React.FC = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [users, setUsers] = useState<User[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [documents, setDocuments] = useState<Document[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
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
    const [viewingClientId, setViewingClientId] = useState<number | null>(null);
    const [isQuickSendModalOpen, setQuickSendModalOpen] = useState(false);
    const [isRadarRunning, setIsRadarRunning] = useState(false);
    const [directAction, setDirectAction] = useState<{type: string, payload: any} | null>(null);
    const [currentView, setCurrentView] = useState<View>('dashboard');
    const lastDocCheckTimestamp = useRef(new Date().toISOString());
    const lastInvoiceCheckTimestamp = useRef(new Date().toISOString());

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
                setTasks(data.tasks || []);
                setSettings(data.settings || { pixKey: '', paymentLink: '' });
                setNotifications(data.notifications || []);
                setOpportunities(data.opportunities || []);
                setComplianceFindings(data.complianceFindings || []);
                setTaskTemplateSets(data.taskTemplateSets || []);
                setEmployees(data.employees || []);
                setTimeSheets(data.timeSheets || []);
                setCurrentUserId(data.currentUserId);
                setDocumentTemplates(data.documentTemplates || []);
                
                const user = data.users.find((u: User) => u.id === data.currentUserId);
                if (user) {
                    // Set initial view based on user type
                    if (user.role === 'Cliente' && user.clientIds.length > 1) {
                         setCurrentView('multi-client-dashboard');
                    } else {
                         setCurrentView('dashboard');
                    }
                }
                
                // --- Active Client Validation Logic ---
                let finalActiveClientId = data.activeClientId;

                if (user && user.role === 'Cliente' && user.clientIds && user.clientIds.length > 0) {
                    const storedId = data.activeClientId;
                    if (!storedId || !user.clientIds.includes(storedId)) {
                        finalActiveClientId = user.clientIds[0];
                        await api.setActiveClient(finalActiveClientId);
                    }
                } else if (user && user.role !== 'Cliente' && data.activeClientId !== null) {
                    finalActiveClientId = null;
                    await api.setActiveClient(null);
                }
                setActiveClientId(finalActiveClientId);
                lastDocCheckTimestamp.current = new Date().toISOString();
                lastInvoiceCheckTimestamp.current = new Date().toISOString();
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

    // Polling for real-time updates
    useEffect(() => {
        if (!currentUser) return;

        const pollInterval = setInterval(async () => {
            const nextTimestamp = new Date().toISOString();
            try {
                // Poll for documents
                const updatedDocs = await api.fetchDocumentUpdates(lastDocCheckTimestamp.current);
                 if (updatedDocs.length > 0) {
                    setDocuments(prevDocs => {
                        const existingIds = new Set(prevDocs.map(d => d.id));
                        const newDocs = updatedDocs.filter(d => !existingIds.has(d.id));
                        return newDocs.length > 0 ? [...newDocs, ...prevDocs] : prevDocs;
                    });
                }
                lastDocCheckTimestamp.current = nextTimestamp;

                // Poll for invoices
                const updatedInvoices = await api.fetchInvoiceUpdates(lastInvoiceCheckTimestamp.current);
                if (updatedInvoices.length > 0) {
                    setInvoices(prevInvoices => {
                        const existingIds = new Set(prevInvoices.map(i => i.id));
                        const newInvoices = updatedInvoices.filter(i => !existingIds.has(i.id));
                        return newInvoices.length > 0 ? [...newInvoices, ...prevInvoices] : prevInvoices;
                    });
                }
                lastInvoiceCheckTimestamp.current = nextTimestamp;

            } catch (error) {
                console.error("Polling for updates failed:", error);
            }
        }, 10000); // Poll every 10 seconds

        return () => clearInterval(pollInterval);
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

    const handleSwitchClient = async (clientId: number | null) => {
        if (currentUser?.role !== 'Cliente' || (clientId !== null && currentUser?.clientIds?.includes(clientId))) {
            await api.setActiveClient(clientId);
            setActiveClientId(clientId);
        }
    };
    
    const handleSelectCompany = async (clientId: number) => {
        await handleSwitchClient(clientId);
        setCurrentView('dashboard');
    }

    // --- Data mutation handlers ---
    
    const handleSaveClient = async (clientData: any, isEditing: boolean) => {
        setIsLoading(true);
        try {
            if (isEditing) {
                const { updatedClient, updatedUser } = await api.updateClient(clientData);
                setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
                if (updatedUser) {
                    setUsers(prevUsers => prevUsers.map(u => u.id === updatedUser.id ? updatedUser : u));
                }
                if (clientData.password && clientData.userId) {
                    const updatedUserWithNewPassword = await api.updateUserPassword(clientData.userId, clientData.password);
                    setUsers(prevUsers => prevUsers.map(u => u.id === updatedUserWithNewPassword.id ? updatedUserWithNewPassword : u));
                }
            } else {
                const { newClient, newUser, newTasks } = await api.onboardClient(clientData);
                setClients(prev => [...prev, newClient]);
                setUsers(prev => [...prev, newUser]);
                if (newTasks.length > 0) setTasks(prev => [...prev, ...newTasks]);
                addNotification({ userId: newUser.id, message: `Bem-vindo à Plataforma JZF! Seu acesso foi criado.` });
            }
        } catch (error: any) {
            console.error("Failed to save client:", error);
            alert(`Erro: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInactivateClient = async (clientId: number) => {
        setIsLoading(true);
        try {
            const inactivatedClient = await api.inactivateClient(clientId);
            setClients(clients.map(c => c.id === clientId ? inactivatedClient : c));
        } catch (error) {
            console.error("Failed to inactivate client:", error);
        } finally {
            setIsLoading(false);
        }
    }

    const handleDeleteClient = async (clientId: number) => {
        setIsLoading(true);
        try {
            const usersToDelete = users.filter(u => u.clientIds.length === 1 && u.clientIds[0] === clientId);
            await api.deleteClient(clientId);
            setClients(clients.filter(c => c.id !== clientId));
            setUsers(users.filter(u => !usersToDelete.some(deletedUser => deletedUser.id === u.id)));
        } catch (error) {
            console.error("Failed to delete client permanently:", error);
        } finally {
            setIsLoading(false);
        }
    }
    
    const handleInactivateEmployee = async (employeeId: number) => {
        setIsLoading(true);
        try {
            const updatedEmployee = await api.inactivateEmployee(employeeId);
            setEmployees(employees.map(e => e.id === employeeId ? updatedEmployee : e));
        } catch (error) {
            console.error("Failed to inactivate employee:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const titleMap: Record<View, string> = {
        dashboard: 'Dashboard',
        'client-dashboard': 'Painel do Cliente',
        'multi-client-dashboard': 'Visão Geral das Empresas',
        clientes: 'Gestão de Clientes',
        documentos: 'Gestão de Documentos',
        cobranca: 'Cobranças e Pagamentos',
        administradores: 'Gestão de Administradores',
        configuracoes: 'Configurações',
        relatorios: 'Análise & IA',
        'novos-relatorios': 'Relatórios Gerenciais',
        tarefas: 'Gestão de Tarefas',
        ponto: 'Folha de Ponto',
        simulacoes: 'Simulações'
    };

    if (isLoading && !currentUser) { // Only show full-screen spinner on initial load
        return <LoadingSpinner />;
    }
    
    if (error && !currentUserId) {
        return <ErrorDisplay error={error} />;
    }

    if (!currentUser) {
        return <Login onLogin={handleLogin} />;
    }

    const renderView = () => {
        switch(currentView) {
            case 'dashboard': return <DashboardView currentUser={currentUser} clients={clients} invoices={invoices} documents={documents} notifications={notifications} setCurrentView={setCurrentView} activeClientId={activeClientId} />;
            case 'client-dashboard': return <ClientDashboardView currentUser={currentUser} clients={clients} invoices={invoices} documents={documents} tasks={tasks} employees={employees} viewingClientId={viewingClientId} setCurrentView={setCurrentView} addNotification={addNotification} users={users} />;
            case 'multi-client-dashboard': return <MultiClientDashboardView currentUser={currentUser} clients={clients} invoices={invoices} tasks={tasks} handleSelectCompany={handleSelectCompany} />;
            case 'clientes': return <ClientView clients={clients} users={users} currentUser={currentUser} addNotification={addNotification} taskTemplateSets={taskTemplateSets} onSave={handleSaveClient} onInactivate={handleInactivateClient} onDelete={handleDeleteClient} setIsLoading={setIsLoading} setCurrentView={setCurrentView} setViewingClientId={setViewingClientId} />;
            case 'documentos': return <DocumentView documents={documents} setDocuments={setDocuments} currentUser={currentUser} clients={clients} users={users} addNotification={addNotification} documentTemplates={documentTemplates} directAction={directAction} setDirectAction={setDirectAction} setTasks={setTasks} activeClientId={activeClientId} setIsLoading={setIsLoading} employees={employees} handleInactivateEmployee={handleInactivateEmployee} />;
            case 'cobranca': return <BillingView invoices={invoices} setInvoices={setInvoices} currentUser={currentUser} clients={clients} users={users} settings={settings} addNotification={addNotification} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'administradores': return <AdminManagementView users={users} setUsers={setUsers} setIsLoading={setIsLoading} />;
            case 'configuracoes': return <SettingsView settings={settings} setSettings={setSettings} taskTemplateSets={taskTemplateSets} setTaskTemplateSets={setTaskTemplateSets} setIsLoading={setIsLoading} />;
            case 'relatorios': return <ReportsView currentUser={currentUser} clients={clients} opportunities={opportunities} setOpportunities={setOpportunities} complianceFindings={complianceFindings} setComplianceFindings={setComplianceFindings} isRadarRunning={isRadarRunning} activeClientId={activeClientId} />;
            case 'novos-relatorios': return <NewReportsView currentUser={currentUser} clients={clients} invoices={invoices} documents={documents} tasks={tasks} activeClientId={activeClientId} />;
            case 'tarefas': return <TasksView tasks={tasks} setTasks={setTasks} currentUser={currentUser} clients={clients} users={users} addNotification={addNotification} setDirectAction={setDirectAction} setCurrentView={setCurrentView} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'ponto': return <PontoView clients={clients.filter(c => c.status === 'Ativo')} employees={employees} setEmployees={setEmployees} timeSheets={timeSheets} setTimeSheets={setTimeSheets} currentUser={currentUser} addNotification={addNotification} users={users} activeClientId={activeClientId} setIsLoading={setIsLoading} />;
            case 'simulacoes': return <SimulationView currentUser={currentUser} />;
            default: return <DashboardView currentUser={currentUser} clients={clients} invoices={invoices} documents={documents} notifications={notifications} setCurrentView={setCurrentView} activeClientId={activeClientId} />;
        }
    };

    return (
        <div className="flex h-screen bg-light-gray">
            {isLoading && <LoadingSpinner />}
            <SideNav currentView={currentView} setCurrentView={setCurrentView} currentUser={currentUser} onOpenQuickSend={() => setQuickSendModalOpen(true)}/>
            <main className="flex-1 flex flex-col overflow-hidden">
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
                <div className="flex-1 p-8 overflow-y-auto">
                    {renderView()}
                </div>
            </main>
            <Chatbot currentUser={currentUser} tasks={tasks} documents={documents} invoices={invoices} activeClientId={activeClientId} />
            {isQuickSendModalOpen && (
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
            )}
        </div>
    );
};

export default App;
