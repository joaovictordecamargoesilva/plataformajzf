import React from 'react';
import { User, Client, Invoice, Task } from '../types';
import Icon from './Icon';

interface MultiClientDashboardViewProps {
  currentUser: User;
  clients: Client[];
  invoices: Invoice[];
  tasks: Task[];
  handleSelectCompany: (clientId: number) => void;
}

const Stat: React.FC<{ value: number, label: string, colorClass: string, icon: string }> = ({ value, label, colorClass, icon }) => (
    <div className="flex items-center p-3 bg-gray-100 rounded-lg">
        <Icon path={icon} className={`w-6 h-6 mr-3 ${value > 0 ? colorClass : 'text-gray-500'}`} />
        <div>
            <p className={`text-xl font-bold ${value > 0 ? colorClass : 'text-gray-800'}`}>{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
        </div>
    </div>
);


const MultiClientDashboardView: React.FC<MultiClientDashboardViewProps> = ({ currentUser, clients, invoices, tasks, handleSelectCompany }) => {

    const userClients = clients.filter(c => currentUser.clientIds.includes(c.id) && c.status === 'Ativo');

    const getClientStats = (clientId: number) => {
        const clientInvoices = invoices.filter(i => i.clientId === clientId);
        const clientTasks = tasks.filter(t => t.clientId === clientId);

        return {
            pendingInvoices: clientInvoices.filter(i => i.status === 'Pendente' || i.status === 'Atrasado').length,
            pendingTasks: clientTasks.filter(t => t.status === 'Pendente').length,
        };
    };

    return (
        <div>
            <h2 className="text-3xl font-bold text-black mb-2">Visão Geral das Empresas</h2>
            <p className="text-text-secondary mb-8">Aqui está um resumo das suas empresas. Selecione uma para gerenciar.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {userClients.map(client => {
                    const stats = getClientStats(client.id);
                    const hasPendencies = stats.pendingInvoices > 0 || stats.pendingTasks > 0;

                    return (
                        <div key={client.id} className={`bg-white rounded-lg shadow-lg flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${hasPendencies ? 'border-2 border-yellow-400' : 'border border-gray-200'}`}>
                           <div className="p-6 flex-grow">
                                <div className="flex items-center mb-5">
                                    <div className="p-3 bg-primary-dark/10 rounded-full mr-4">
                                        <Icon path="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m-1 4h1m5-4h1m-1 4h1" className="w-6 h-6 text-primary"/>
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-black leading-tight">{client.company}</h3>
                                        <p className="text-sm text-gray-600">{client.name}</p>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <Stat 
                                        value={stats.pendingInvoices} 
                                        label="Cobranças Pendentes" 
                                        colorClass="text-red-600"
                                        icon="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H7a3 3 0 00-3 3v8a3 3 0 003 3z" 
                                    />
                                    <Stat 
                                        value={stats.pendingTasks} 
                                        label="Tarefas Pendentes" 
                                        colorClass="text-yellow-600"
                                        icon="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                                    />
                                </div>
                           </div>
                           <div className="p-4 bg-gray-50 rounded-b-lg mt-auto">
                               <button 
                                onClick={() => handleSelectCompany(client.id)}
                                className="w-full bg-primary text-white font-bold py-3 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors flex items-center justify-center text-sm"
                               >
                                  Gerenciar Empresa
                                  <Icon path="M13 7l5 5m0 0l-5 5m5-5H6" className="w-5 h-5 ml-2" />
                                </button>
                           </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MultiClientDashboardView;
