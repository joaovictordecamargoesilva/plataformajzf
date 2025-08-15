
import React, { useState } from 'react';
import { Client, User, AppNotification, TaskTemplateSet, TaskStatus } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import * as api from '../services/api';
import { View } from '../App';

interface ClientViewProps {
  clients: Client[];
  users: User[];
  currentUser: User;
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  taskTemplateSets: TaskTemplateSet[];
  onSave: (clientData: any, isEditing: boolean) => Promise<void>;
  onInactivate: (clientId: number) => Promise<void>;
  onDelete: (clientId: number) => Promise<void>;
  setIsLoading: (isLoading: boolean) => void;
  setCurrentView: (view: View) => void;
  setViewingClientId: (id: number | null) => void;
}

// Moved ClientForm outside of ClientView to prevent re-rendering issues causing focus loss
const ClientForm: React.FC<{
    client: Client | null, 
    onSave: (data: any) => void, 
    onCancel: () => void, 
    initialData?: any,
    users: User[],
    taskTemplateSets: TaskTemplateSet[]
}> = ({ client, onSave, onCancel, initialData, users, taskTemplateSets }) => {
    const isEditing = !!client;
    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: client?.id,
        userId: client?.userId,
        name: client?.name || initialData?.name || '',
        company: client?.company || initialData?.company || '',
        email: client?.email || initialData?.email || '',
        phone: client?.phone || initialData?.phone || '',
        taxRegime: client?.taxRegime || initialData?.taxRegime || 'Simples Nacional',
        username: client ? users.find(u => u.id === client.userId)?.username || '' : initialData?.username || '',
        password: initialData?.password || '',
        cnaes: client?.businessProfile.cnaes.join(', ') || (initialData?.cnaes || []).join(', ') || '',
        keywords: client?.businessProfile.keywords.join(', ') || '',
        businessDescription: client?.businessProfile.description || initialData?.businessDescription || '',
        taskTemplateSetId: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        await onSave({ ...formData });
        setIsSaving(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-semibold mb-2">{client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Nome Completo do Responsável" className="p-2 border rounded" required/>
                <input name="company" value={formData.company} onChange={handleChange} placeholder="Nome da Empresa (Razão Social)" className="p-2 border rounded" required/>
                <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email de Contato" className="p-2 border rounded" required/>
                <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded" required/>
                <div>
                  <label htmlFor="taxRegime" className="text-sm font-medium text-gray-700">Regime Tributário</label>
                  <select id="taxRegime" name="taxRegime" value={formData.taxRegime} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                      <option>Simples Nacional</option>
                      <option>Lucro Presumido</option>
                      <option>Lucro Real</option>
                  </select>
                </div>
            </div>
            
            <div className="border-t pt-4">
               <h4 className="font-semibold text-lg mb-2">Perfil de Negócio (para IA)</h4>
               <div className="space-y-4">
                   <div>
                      <label htmlFor="cnaes" className="text-sm font-medium text-gray-700">CNAEs (separados por vírgula)</label>
                      <input id="cnaes" name="cnaes" value={formData.cnaes} onChange={handleChange} placeholder="Ex: 6201-5/01, 6204-0/00" className="w-full p-2 border rounded mt-1"/>
                   </div>
                    <div>
                      <label htmlFor="keywords" className="text-sm font-medium text-gray-700">Palavras-chave (separadas por vírgula)</label>
                      <input id="keywords" name="keywords" value={formData.keywords} onChange={handleChange} placeholder="Ex: saas, logística, consultoria ti" className="w-full p-2 border rounded mt-1"/>
                   </div>
                   <div>
                      <label htmlFor="businessDescription" className="text-sm font-medium text-gray-700">Descrição Detalhada da Atividade</label>
                      <textarea id="businessDescription" name="businessDescription" value={formData.businessDescription} onChange={handleChange} placeholder="Descreva o que a empresa faz..." className="w-full p-2 border rounded mt-1" rows={3}></textarea>
                   </div>
               </div>
            </div>

             <div className="border-t pt-4">
               <h4 className="font-semibold text-lg mb-2">Credenciais de Acesso</h4>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input name="username" value={formData.username} onChange={handleChange} placeholder="Nome de Usuário (login)" className={`p-2 border rounded ${isEditing ? 'bg-gray-100' : ''}`} required disabled={isEditing} />
                  <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder={isEditing ? "Nova Senha (deixe em branco para manter)" : "Senha"} className="p-2 border rounded" required={!isEditing}/>
               </div>
             </div>
            
            {!client && (
               <div className="border-t pt-4">
                  <h4 className="font-semibold text-lg mb-2">Automação de Tarefas</h4>
                  <div>
                      <label htmlFor="taskTemplateSetId" className="text-sm font-medium text-gray-700">Aplicar Conjunto de Tarefas Recorrentes</label>
                      <select id="taskTemplateSetId" name="taskTemplateSetId" value={formData.taskTemplateSetId} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                          <option value="">Nenhum (criar manualmente depois)</option>
                          {taskTemplateSets.map(template => (
                              <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-1">Ao selecionar, as tarefas recorrentes do conjunto serão criadas automaticamente para este cliente.</p>
                  </div>
              </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg" disabled={isSaving}>
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>
        </form>
    )
}

// Moved CnpjModalContent outside of ClientView to prevent re-rendering issues causing focus loss
const CnpjModalContent: React.FC<{
    cnpj: string;
    setCnpj: (value: string) => void;
    isLoadingCnpj: boolean;
    cnpjError: string;
    handleShowManualForm: () => void;
    handleCnpjSearch: () => void;
}> = ({ cnpj, setCnpj, isLoadingCnpj, cnpjError, handleShowManualForm, handleCnpjSearch }) => {

    const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const onlyNums = value.replace(/[^\d]/g, '');

        let formatted = onlyNums;
        if (onlyNums.length > 12) {
            formatted = `${onlyNums.slice(0, 2)}.${onlyNums.slice(2, 5)}.${onlyNums.slice(5, 8)}/${onlyNums.slice(8, 12)}-${onlyNums.slice(12, 14)}`;
        } else if (onlyNums.length > 8) {
            formatted = `${onlyNums.slice(0, 2)}.${onlyNums.slice(2, 5)}.${onlyNums.slice(5, 8)}/${onlyNums.slice(8)}`;
        } else if (onlyNums.length > 5) {
            formatted = `${onlyNums.slice(0, 2)}.${onlyNums.slice(2, 5)}.${onlyNums.slice(5)}`;
        } else if (onlyNums.length > 2) {
            formatted = `${onlyNums.slice(0, 2)}.${onlyNums.slice(2)}`;
        }
        setCnpj(formatted);
    };

    return (
      <div>
          <h3 className="text-xl font-semibold mb-4 text-black">Adicionar Novo Cliente via CNPJ</h3>
          <div className="space-y-4">
              <p className="text-gray-600">Para agilizar, digite o CNPJ do cliente. Nossa IA buscará os dados cadastrais publicamente disponíveis para preencher o formulário.</p>
              <div>
                  <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700">CNPJ</label>
                  <input
                      id="cnpj"
                      name="cnpj"
                      value={cnpj}
                      onChange={handleCnpjChange}
                      placeholder="00.000.000/0000-00"
                      className="w-full p-2 border rounded mt-1"
                      maxLength={18}
                  />
              </div>
              {cnpjError && <p className="text-red-500 text-sm">{cnpjError}</p>}
              <div className="flex items-center justify-between pt-4">
                  <button onClick={handleShowManualForm} className="text-sm text-primary hover:underline">ou Cadastrar Manualmente</button>
                  <button
                      onClick={handleCnpjSearch}
                      disabled={isLoadingCnpj || cnpj.replace(/\D/g, '').length < 14}
                      className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors disabled:opacity-50"
                  >
                      {isLoadingCnpj ? 'Buscando...' : 'Buscar Dados com IA'}
                  </button>
              </div>
          </div>
      </div>
    );
}


const ClientView: React.FC<ClientViewProps> = ({ clients, users, currentUser, addNotification, taskTemplateSets, onSave, onInactivate, onDelete, setIsLoading, setCurrentView, setViewingClientId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<'cnpj' | 'form'>('cnpj');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToInactivate, setClientToInactivate] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [preloadedData, setPreloadedData] = useState<any>(null);
  
  const [cnpj, setCnpj] = useState('');
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState('');

  const canManage = currentUser.role === 'AdminGeral' || !!currentUser.permissions?.canManageClients;

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.company.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusClass = (status: 'Ativo' | 'Inativo') => {
    return status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const handleOpenModal = (client: Client | null = null) => {
    setEditingClient(client);
    if(client) {
        setModalStep('form');
    } else {
        setModalStep('cnpj');
        setCnpj('');
        setCnpjError('');
        setPreloadedData(null);
    }
    setIsModalOpen(true);
  }

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingClient(null);
  }
  
  const handleCnpjSearch = async () => {
    if (!cnpj) return;
    setIsLoadingCnpj(true);
    setCnpjError('');
    try {
        const data = await api.getClientDataFromCnpj(cnpj.replace(/\D/g,''));
        const randomPassword = Math.random().toString(36).slice(-8);
        setPreloadedData({ ...data, password: randomPassword });
        setModalStep('form');
    } catch (error: any) {
        setCnpjError(error.message || "Erro desconhecido ao buscar CNPJ.");
    } finally {
        setIsLoadingCnpj(false);
    }
  };
  
  const handleShowManualForm = () => {
      setPreloadedData(null); // Clear any preloaded data
      setModalStep('form');
  };

  const handleSaveClient = async (formData: any) => {
    await onSave(formData, !!editingClient);
    handleCloseModal();
  };

  const handleConfirmInactivate = async () => {
      if(clientToInactivate) {
          await onInactivate(clientToInactivate.id);
          setClientToInactivate(null);
      }
  }

  const handleConfirmDelete = async () => {
      if(clientToDelete) {
          await onDelete(clientToDelete.id);
          setClientToDelete(null);
      }
  }

  const handleViewDashboard = (clientId: number) => {
      setViewingClientId(clientId);
      setCurrentView('client-dashboard');
  }
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Gestão de Clientes</h2>
        {canManage && (
            <button onClick={() => handleOpenModal(null)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2" />
                Adicionar Cliente
            </button>
        )}
      </div>

      <div className="mb-6 relative">
        <input
          type="text"
          placeholder="Buscar por nome ou empresa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon path="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="px-5 py-3">Cliente / Empresa</th>
              <th className="px-5 py-3">Contato</th>
              <th className="px-5 py-3">Regime Tributário</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.map(client => (
              <tr key={client.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-5 py-5 text-sm">
                  <p className="text-gray-900 font-semibold whitespace-no-wrap">{client.company}</p>
                  <p className="text-gray-700 whitespace-no-wrap">{users.find(u => u.id === client.userId)?.name}</p>
                </td>
                <td className="px-5 py-5 text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{client.email}</p>
                  <p className="text-gray-700 whitespace-no-wrap">{client.phone}</p>
                </td>
                <td className="px-5 py-5 text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{client.taxRegime}</p>
                </td>
                <td className="px-5 py-5 text-sm">
                  <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${getStatusClass(client.status)}`}>
                    <span className="relative">{client.status}</span>
                  </span>
                </td>
                <td className="px-5 py-5 text-sm">
                  {canManage && (
                    <div className="flex items-center space-x-3">
                      <button onClick={() => handleViewDashboard(client.id)} className="text-gray-600 hover:text-gray-900 transition-colors" title="Ver Painel">
                          <Icon path="M15 12a3 3 0 11-6 0 3 3 0 016 0z M21 12c-2.833-5-7.167-5-10-5s-7.167 0-10 5c2.833 5 7.167 5 10 5s7.167 0 10-5z" className="w-5 h-5" />
                      </button>
                      <button onClick={() => handleOpenModal(client)} className="text-blue-600 hover:text-blue-900 transition-colors" title="Editar">
                          <Icon path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" className="w-5 h-5" />
                      </button>
                      {client.status === 'Ativo' && (
                        <button onClick={() => setClientToInactivate(client)} className="text-yellow-600 hover:text-yellow-900 transition-colors" title="Inativar">
                            <Icon path="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" className="w-5 h-5" />
                        </button>
                      )}
                      <button onClick={() => setClientToDelete(client)} className="text-red-600 hover:text-red-900 transition-colors" title="Excluir Permanentemente">
                          <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        {modalStep === 'cnpj' 
            ? <CnpjModalContent 
                cnpj={cnpj}
                setCnpj={setCnpj}
                isLoadingCnpj={isLoadingCnpj}
                cnpjError={cnpjError}
                handleShowManualForm={handleShowManualForm}
                handleCnpjSearch={handleCnpjSearch}
              />
            : <ClientForm 
                client={editingClient} 
                onSave={handleSaveClient} 
                onCancel={handleCloseModal} 
                initialData={preloadedData} 
                users={users}
                taskTemplateSets={taskTemplateSets}
              />
        }
      </Modal>
      <Modal isOpen={!!clientToInactivate} onClose={() => setClientToInactivate(null)}>
        <div>
            <h3 className="text-xl font-semibold mb-4">Confirmar Inativação</h3>
            <p>Você tem certeza que deseja inativar a empresa <strong>{clientToInactivate?.company}</strong>? Esta ação removerá o acesso do usuário associado, mas manterá os dados históricos.</p>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setClientToInactivate(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleConfirmInactivate} className="bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg">Sim, Inativar</button>
            </div>
        </div>
      </Modal>
       <Modal isOpen={!!clientToDelete} onClose={() => setClientToDelete(null)}>
        <div>
            <h3 className="text-xl font-semibold mb-4 text-red-600">Confirmar Exclusão Permanente</h3>
            <p>Você tem certeza que deseja <strong>EXCLUIR PERMANENTEMENTE</strong> a empresa <strong>{clientToDelete?.company}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setClientToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleConfirmDelete} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Sim, Excluir</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientView;