import React, { useState } from 'react';
import { User, UserPermissions } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import * as api from '../services/api';

interface AdminManagementViewProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setIsLoading: (loading: boolean) => void;
}

const AdminManagementView: React.FC<AdminManagementViewProps> = ({ users, setUsers, setIsLoading }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<User | null>(null);
  const [adminToDelete, setAdminToDelete] = useState<User | null>(null);

  const adminUsers = users.filter(u => u.role === 'AdminGeral' || u.role === 'AdminLimitado');

  const handleOpenModal = (admin: User | null = null) => {
    setEditingAdmin(admin);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAdmin(null);
  };
  
  const handleSaveAdmin = async (formData: any) => {
    setIsLoading(true);
    try {
        if (editingAdmin) {
            const updatedAdmin = await api.updateAdmin(editingAdmin.id, formData);
            setUsers(users.map(u => u.id === updatedAdmin.id ? updatedAdmin : u));
        } else {
            const newAdmin = await api.createAdmin(formData);
            setUsers(prevUsers => [...prevUsers, newAdmin]);
        }
    } catch (error) {
        console.error("Failed to save admin:", error);
    } finally {
        setIsLoading(false);
        handleCloseModal();
    }
  };
  
  const handleConfirmDelete = async () => {
      if(adminToDelete) {
          if (adminToDelete.role === 'AdminGeral') {
              alert("O Administrador Geral não pode ser excluído.");
              setAdminToDelete(null);
              return;
          }
          setIsLoading(true);
          try {
            await api.deleteUser(adminToDelete.id);
            setUsers(users.filter(u => u.id !== adminToDelete.id));
          } catch(error) {
            console.error("Failed to delete admin:", error);
          } finally {
            setIsLoading(false);
            setAdminToDelete(null);
          }
      }
  }

  const AdminForm: React.FC<{ admin: User | null, onSave: (data: any) => void, onCancel: () => void }> = ({ admin, onSave, onCancel }) => {
    const initialPermissions: UserPermissions = {
      canManageClients: false,
      canManageDocuments: true,
      canManageBilling: true,
      canManageAdmins: false,
      canManageSettings: false,
      canViewReports: true,
      canViewDashboard: true,
      canManageTasks: true,
    };
    
    const permissionLabels: Record<keyof UserPermissions, string> = {
      canManageClients: 'Acessar e Gerenciar Clientes',
      canManageDocuments: 'Acessar e Gerenciar Documentos',
      canManageBilling: 'Acessar e Gerenciar Cobranças',
      canManageAdmins: 'Acessar e Gerenciar outros Admins',
      canManageSettings: 'Acessar Configurações Gerais',
      canViewReports: 'Visualizar Relatórios',
      canViewDashboard: 'Visualizar Dashboard',
      canManageTasks: 'Acessar e Gerenciar Tarefas',
    };

    const [formData, setFormData] = useState({
      name: admin?.name || '',
      email: admin?.email || '',
      username: admin?.username || '',
      password: '',
      permissions: admin?.permissions || initialPermissions,
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = e.target;
      setFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [name]: checked
        }
      }));
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <form onSubmit={handleSubmit}>
        <h3 className="text-xl font-semibold mb-4">{admin ? 'Editar Administrador' : 'Novo Administrador'}</h3>
        <div className="space-y-4">
          <input name="name" value={formData.name} onChange={handleChange} placeholder="Nome Completo" className="w-full p-2 border rounded" required />
          <input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="Email" className="w-full p-2 border rounded" required />
          <input name="username" value={formData.username} onChange={handleChange} placeholder="Nome de Usuário (login)" className="w-full p-2 border rounded" required disabled={!!admin} />
          <input name="password" type="password" value={formData.password} onChange={handleChange} placeholder={admin ? "Nova Senha (deixe em branco para manter)" : "Senha"} className="w-full p-2 border rounded" required={!admin} />
          
          {admin?.role !== 'AdminGeral' && (
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Permissões de Acesso</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(Object.keys(permissionLabels) as Array<keyof UserPermissions>).map(key => (
                    <label key={key} className="flex items-center p-2 rounded-md hover:bg-gray-100 cursor-pointer">
                      <input 
                        type="checkbox" 
                        name={key} 
                        checked={formData.permissions[key]} 
                        onChange={handlePermissionChange} 
                        className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300"
                      />
                      <span className="ml-2 text-sm text-gray-700">{permissionLabels[key]}</span>
                    </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
          <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar</button>
        </div>
      </form>
    );
  };


  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Gestão de Administradores</h2>
        <button onClick={() => handleOpenModal(null)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
            <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2"/>
            Adicionar Admin
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full leading-normal">
          <thead>
            <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              <th className="px-5 py-3">Nome / Email</th>
              <th className="px-5 py-3">Função</th>
              <th className="px-5 py-3">Permissões Ativas</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {adminUsers.map(admin => (
              <tr key={admin.id} className="border-b border-gray-200 hover:bg-gray-50">
                <td className="px-5 py-5 text-sm">
                  <p className="text-gray-900 font-semibold whitespace-no-wrap">{admin.name}</p>
                  <p className="text-gray-700 whitespace-no-wrap">{admin.email}</p>
                </td>
                <td className="px-5 py-5 text-sm">
                  <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${admin.role === 'AdminGeral' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-800'}`}>
                    {admin.role === 'AdminGeral' ? 'Admin Geral' : 'Admin Limitado'}
                  </span>
                </td>
                <td className="px-5 py-5 text-sm text-gray-700">
                  <ul className="list-disc list-inside">
                    {admin.permissions && Object.entries(admin.permissions)
                      .filter(([, value]) => value)
                      .map(([key]) => <li key={key}>{key.replace('canManage','').replace('canView','').replace(/([A-Z])/g, ' $1').trim()}</li>)}
                    {admin.role === 'AdminGeral' && <li>Todas as permissões</li>}
                  </ul>
                </td>
                <td className="px-5 py-5 text-sm">
                  <div className="flex items-center space-x-3">
                    <button onClick={() => handleOpenModal(admin)} className="text-yellow-600 hover:text-yellow-900 transition-colors">
                      <Icon path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" className="w-5 h-5" />
                    </button>
                    {admin.role !== 'AdminGeral' && (
                      <button onClick={() => setAdminToDelete(admin)} className="text-red-600 hover:text-red-900 transition-colors">
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
      <Modal isOpen={isModalOpen} onClose={handleCloseModal}>
        <AdminForm admin={editingAdmin} onSave={handleSaveAdmin} onCancel={handleCloseModal} />
      </Modal>
      <Modal isOpen={!!adminToDelete} onClose={() => setAdminToDelete(null)}>
        <div>
            <h3 className="text-xl font-semibold mb-4">Confirmar Exclusão</h3>
            <p>Você tem certeza que deseja excluir o administrador <strong>{adminToDelete?.name}</strong>? Esta ação é irreversível.</p>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setAdminToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleConfirmDelete} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Excluir</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default AdminManagementView;