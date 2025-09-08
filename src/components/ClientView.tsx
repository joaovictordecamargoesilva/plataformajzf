import React, { useState } from 'react';
import { Client, User, AppNotification, TaskTemplateSet } from '../types';
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
    taskTemplateSets: TaskTemplateSet[],
    allClients: Client[]
}> = ({ client, onSave, onCancel, initialData, users, taskTemplateSets, allClients }) => {
    const isEditing = !!client;
    // Find the primary user for the client being edited
    const clientUser = isEditing ? users.find(u => u.role === 'Cliente' && u.clientIds?.includes(client.id)) : null;

    const [isSaving, setIsSaving] = useState(false);
    const [formData, setFormData] = useState({
        id: client?.id,
        userId: clientUser?.id, // Use the found user's ID
        name: client?.name || initialData?.name || '',
        company: client?.company || initialData?.company || '',
        cnpj: client?.cnpj || initialData?.cnpj || '',
        email: client?.email || initialData?.email || '',
        phone: client?.phone || initialData?.phone || '',
        taxRegime: client?.taxRegime || initialData?.taxRegime || 'SimplesNacional',
        username: clientUser ? clientUser.username : initialData?.username || '',
        password: initialData?.password || '',
        cnaes: client?.cnaes.join(', ') || (initialData?.cnaes || []).join(', ') || '',
        keywords: client?.keywords.join(', ') || '',
        businessDescription: client?.businessDescription || initialData?.businessDescription || '',
        taskTemplateSetId: '',
    });
    
    const [selectedClientIds, setSelectedClientIds] = useState<number[]>(() => {
        if (!isEditing || !clientUser) return [];
        return clientUser.clientIds || [];
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

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
        setFormData({ ...formData, cnpj: formatted });
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        // The payload now needs to include userId for password updates and selectedClientIds for permissions
        await onSave({ ...formData, cnpj: formData.cnpj.replace(/\D/g, ''), selectedClientIds });
        setIsSaving(false);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-semibold mb-2">{client ? 'Editar Cliente' : 'Adicionar Novo Cliente'}</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="name" value={formData.name} onChange={handleChange} placeholder="Nome Completo do Responsável" className="p-2 border rounded" required/>
                <input name="company" value={formData.company} onChange={handleChange} placeholder="Nome da Empresa (Razão Social)" className="p-2 border rounded" required/>
                <input name="cnpj" value={formData.cnpj} onChange={handleCnpjChange} placeholder="CNPJ" maxLength={18} className="p-2 border rounded"/>
                <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email de Contato" className="p-2 border rounded" required/>
                <input name="phone" value={formData.phone} onChange={handleChange} placeholder="Telefone" className="p-2 border rounded" required/>
                <div>
                  <label htmlFor="taxRegime" className="text-sm font-medium text-gray-700">Regime Tributário</label>
                  <select id="taxRegime" name="taxRegime" value={formData.taxRegime} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                      <option value="SimplesNacional">Simples Nacional</option>
                      <option value="LucroPresumido">Lucro Presumido</option>
                      <option value="LucroReal">Lucro Real</option>
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

            {isEditing && clientUser && (
                <div className="border-t pt-4">
                    <h4 className="font-semibold text-lg mb-2">Acesso a Outras Empresas</h4>
                    <div>
                        <label htmlFor="clientIds" className="text-sm font-medium text-gray-700">Permitir que este usuário acesse os dados das seguintes empresas:</label>
                        <select
                            id="clientIds"
                            name="clientIds"
                            multiple
                            value={selectedClientIds.map(String)}
                            onChange={(e) => {
                                const options = e.target.options;
                                const value: number[] = [];
                                for (let i = 0, l = options.length; i < l; i++) {
                                    if (options[i].selected) {
                                        value.push(Number(options[i].value));
                                    }
                                }
                                setSelectedClientIds(value);
                            }}
                            className="w-full p-2 border rounded mt-1 h-32"
                        >
                            {allClients.filter(c => c.status === 'Ativo').map(c => (
                                <option key={c.id} value={c.id}>{c.company}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Segure Ctrl (ou Cmd) para selecionar múltiplos. A empresa principal deste cadastro já está incluída.</p>
                    </div>
                </div>
            )}
            
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
                      maxLength={18}
                      className="w-full p-2 border rounded mt-1"
                  />
              </div>
              {cnpjError && <p className="text-red-500 text-sm">{cnpjError}</p>}
              <div className="flex justify-between items-center pt-4">
                  <button onClick={handleShowManualForm} className="text-sm text-primary hover:underline">
                      Prefiro preencher manualmente
                  </button>
                  <button onClick={handleCnpjSearch} className="bg-primary text-white font-bold py-2 px-4 rounded-lg" disabled={isLoadingCnpj}>
                      {isLoadingCnpj ? 'Buscando...' : 'Buscar Dados'}
                  </button>
              </div>
          </div>
      </div>
    )
}


const ClientView: React.FC<ClientViewProps> = ({ clients, users, currentUser, addNotification, taskTemplateSets, onSave, onInactivate, onDelete, setIsLoading, setCurrentView, setViewingClientId }) => {
  const [modalState, setModalState] = useState<'closed' | 'cnpj' | 'form'>('closed');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  
  // State for CNPJ search functionality
  const [cnpj, setCnpj] = useState('');
  const [isLoadingCnpj, setIsLoadingCnpj] = useState(false);
  const [cnpjError, setCnpjError] = useState('');
  const [initialFormData, setInitialFormData] = useState<any>(null);


  const handleOpenModal = (client: Client | null = null) => {
    if (client) {
      setEditingClient(client);
      setModalState('form');
    } else {
      // Reset everything for a new client
      setEditingClient(null);
      setCnpj('');
      setCnpjError('');
      setInitialFormData(null);
      setModalState('cnpj');
    }
  };

  const handleCloseModal = () => {
    setModalState('closed');
    setEditingClient(null); // Clear editing state on close
  };

  const handleSaveAndClose = async (clientData: any) => {
    await onSave(clientData, !!editingClient);
    handleCloseModal();
  };

  const handleCnpjSearch = async () => {
      if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) {
          setCnpjError('Por favor, insira um CNPJ válido com 14 dígitos.');
          return;
      }
      setIsLoadingCnpj(true);
      setCnpjError('');
      try {
          const clientData = await api.getClientDataFromCnpj(cnpj.replace(/\D/g, ''));
          setInitialFormData(clientData);
          setModalState('form'); // Move to form with pre-filled data
      } catch (error: any) {
          setCnpjError(error.message || "Não foi possível buscar os dados do CNPJ.");
      } finally {
          setIsLoadingCnpj(false);
      }
  };

  const handleConfirmDelete = () => {
      if (clientToDelete) {
          onDelete(clientToDelete.id);
          setClientToDelete(null);
      }
  };
  
  const handleViewClientDashboard = (client: Client) => {
      setViewingClientId(client.id);
      setCurrentView('client-dashboard');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Gestão de Clientes</h2>
        <button onClick={() => handleOpenModal()} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
          <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2"/>
          Adicionar Cliente
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="px-5 py-3">Cliente</th>
              <th className="px-5 py-3">Contato</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {clients.map(client => (
              <tr key={client.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-5 py-5 text-sm">
                    <p className="text-gray-900 font-semibold whitespace-no-wrap">{client.company}</p>
                    <p className="text-gray-700 whitespace-no-wrap text-xs">{client.name}</p>
                </td>
                <td className="px-5 py-5 text-sm">
                  <p className="text-gray-900 whitespace-no-wrap">{client.email}</p>
                  <p className="text-gray-700 whitespace-no-wrap">{client.phone}</p>
                </td>
                <td className="px-5 py-5 text-sm">
                  <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${client.status === 'Ativo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {client.status}
                  </span>
                </td>
                <td className="px-5 py-5 text-sm">
                    <div className="flex items-center space-x-4">
                        <button onClick={() => handleViewClientDashboard(client)} className="text-blue-600 hover:text-blue-900 transition-colors" title="Ver Dashboard do Cliente">
                           <Icon path="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2h10a2 2 0 012 2v2" className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleOpenModal(client)} className="text-yellow-600 hover:text-yellow-900 transition-colors" title="Editar Cliente">
                            <Icon path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" className="w-5 h-5" />
                        </button>
                        {client.status === 'Ativo' ? (
                             <button onClick={() => onInactivate(client.id)} className="text-gray-500 hover:text-gray-800 transition-colors" title="Inativar Cliente">
                                <Icon path="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" className="w-5 h-5" />
                            </button>
                        ) : (
                           <button onClick={() => setClientToDelete(client)} className="text-red-600 hover:text-red-900 transition-colors" title="Excluir Permanentemente">
                                <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5" />
                           </button>
                        )}
                    </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <Modal isOpen={modalState !== 'closed'} onClose={handleCloseModal}>
        {modalState === 'cnpj' && (
            <CnpjModalContent
                cnpj={cnpj}
                setCnpj={setCnpj}
                isLoadingCnpj={isLoadingCnpj}
                cnpjError={cnpjError}
                handleShowManualForm={() => setModalState('form')}
                handleCnpjSearch={handleCnpjSearch}
            />
        )}
        {modalState === 'form' && (
            <ClientForm 
                client={editingClient} 
                onSave={handleSaveAndClose} 
                onCancel={handleCloseModal} 
                initialData={initialFormData}
                users={users}
                taskTemplateSets={taskTemplateSets}
                allClients={clients}
            />
        )}
      </Modal>

      <Modal isOpen={!!clientToDelete} onClose={() => setClientToDelete(null)}>
        <div>
            <h3 className="text-xl font-semibold mb-4">Confirmar Exclusão</h3>
            <p>Você tem certeza que deseja excluir o cliente <strong>{clientToDelete?.company}</strong> permanentemente? Esta ação é irreversível e removerá também o usuário de login associado.</p>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setClientToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleConfirmDelete} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Excluir</button>
            </div>
        </div>
      </Modal>

    </div>
  );
};

export default ClientView;