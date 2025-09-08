import React, { useState } from 'react';
import { Task, User, Client, AppNotification, TaskStatus } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import { View } from '../App';
import * as api from '../services/api';

interface TasksViewProps {
  tasks: Task[];
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  currentUser: User;
  clients: Client[];
  users: User[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  setDirectAction: (action: { type: string, payload: any } | null) => void;
  setCurrentView: (view: View) => void;
  activeClientId: number | null;
  setIsLoading: (loading: boolean) => void;
}

const formatTaskStatus = (status: TaskStatus): string => {
    if (status === 'Concluida') return 'Concluída';
    return status;
}

const TasksView: React.FC<TasksViewProps> = ({ tasks, setTasks, currentUser, clients, users, addNotification, setDirectAction, setCurrentView, activeClientId, setIsLoading }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  
  const canManage = currentUser.role === 'AdminGeral' || !!currentUser.permissions?.canManageTasks;

  const handleCreateTask = async (data: { clientId: number, description: string, isRecurring: boolean }) => {
    setIsLoading(true);
    try {
        const newTask = await api.createTask(data, currentUser.name);
        setTasks(prev => [newTask, ...prev]);
        const clientUser = users.find(u => u.clientIds?.includes(data.clientId));
        if (clientUser) {
            addNotification({
                userId: clientUser.id,
                message: `Nova tarefa adicionada para você: ${data.description}`
            });
        }
    } catch (error) {
        console.error("Failed to create task", error);
    } finally {
        setIsLoading(false);
        setIsModalOpen(false);
    }
  };
  
  const handleUpdateTask = async (taskId: number, newDescription: string) => {
    setIsLoading(true);
    try {
        const updatedTask = await api.updateTask(taskId, newDescription);
        setTasks(prev => prev.map(task => task.id === taskId ? updatedTask : task));
        const clientUser = users.find(u => u.clientIds?.includes(updatedTask.clientId));
        if (clientUser) {
            addNotification({
                userId: clientUser.id,
                message: `Uma tarefa foi atualizada para: "${newDescription}"`
            });
        }
    } catch (error) {
        console.error("Failed to update task", error);
    } finally {
        setIsLoading(false);
        setEditingTask(null);
    }
  };
  
  const handleDeleteTask = async () => {
    if (!taskToDelete) return;
    setIsLoading(true);
    try {
        await api.deleteTask(taskToDelete.id);
        setTasks(prev => prev.filter(task => task.id !== taskToDelete.id));
    } catch (error) {
        console.error("Failed to delete task", error);
    } finally {
        setIsLoading(false);
        setTaskToDelete(null);
    }
  };

  const handleCompleteTaskByButton = async (task: Task) => {
    setIsLoading(true);
    try {
        const updatedTask = await api.updateTaskStatus(task.id, 'Concluida');
        setTasks(prev => prev.map(t => t.id === task.id ? updatedTask : t));
        users.filter(u => u.role.includes("Admin")).forEach(admin => {
            addNotification({
              userId: admin.id,
              message: `Cliente ${currentUser.name} concluiu a tarefa: ${task.description}`
            })
        });
    } catch (error) {
        console.error("Failed to complete task", error);
    } finally {
        setIsLoading(false);
    }
  };

  const taskActionMappings = [
      { keywords: ['notas fiscais', 'nfs-e', 'nf-e'], templateId: 'notas-fiscais' },
      { keywords: ['extrato bancário', 'extratos bancários'], templateId: 'extrato-bancario' },
      { keywords: ['admissão'], templateId: 'admissao-funcionario' },
      { keywords: ['rescisão'], templateId: 'rescisao-contrato' },
      { keywords: ['alteração contratual'], templateId: 'alteracao-contratual' },
  ];

  const getTaskAction = (task: Task) => {
      if (currentUser.role !== 'Cliente' || task.status !== 'Pendente') return null;
      
      const description = task.description.toLowerCase();
      for (const mapping of taskActionMappings) {
          if (mapping.keywords.some(kw => description.includes(kw))) {
              return {
                  label: 'Executar',
                  action: () => {
                      setCurrentView('documentos');
                      setTimeout(() => {
                         setDirectAction({ type: 'OPEN_DOC_MODAL', payload: { templateId: mapping.templateId, task } });
                      }, 100);
                  }
              };
          }
      }
      return {
          label: 'Concluir',
          action: () => handleCompleteTaskByButton(task)
      };
  };

  const getStatusClass = (status: TaskStatus) => {
    return status === 'Pendente' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800';
  };
  
  const TaskForm: React.FC<{ onSubmit: (data:any) => void, onCancel: () => void }> = ({ onSubmit, onCancel }) => {
      const [formData, setFormData] = useState({
          clientId: clients[0]?.id.toString() || '',
          description: '',
          isRecurring: false,
      });

      const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
          const {name, value, type} = e.target;
          const isCheckbox = type === 'checkbox';
          setFormData(prev => ({ ...prev, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value }));
      };
      
      const handleSubmit = (e: React.FormEvent) => {
          e.preventDefault();
          onSubmit({
              ...formData,
              clientId: Number(formData.clientId)
          });
      };

      return (
          <form onSubmit={handleSubmit}>
              <h3 className="text-xl font-semibold mb-4">Criar Nova Tarefa</h3>
              <div className="space-y-4">
                  <select name="clientId" value={formData.clientId} onChange={handleChange} className="w-full p-2 border rounded" required>
                      <option value="">Selecione um cliente</option>
                      {clients.filter(c => c.status === 'Ativo').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <input name="description" value={formData.description} onChange={handleChange} placeholder="Descrição da Tarefa (ex: Enviar extrato do Banco Cora)" className="w-full p-2 border rounded" required/>
                  <label className="flex items-center">
                    <input type="checkbox" name="isRecurring" checked={formData.isRecurring} onChange={handleChange} className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300"/>
                    <span className="ml-2 text-sm text-gray-700">Tarefa Recorrente (Mensal)</span>
                  </label>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                  <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                  <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Criar Tarefa</button>
              </div>
          </form>
      );
  }
  
  const EditTaskForm: React.FC<{ task: Task, onSave: (id: number, description: string) => void, onCancel: () => void }> = ({ task, onSave, onCancel }) => {
    const [description, setDescription] = useState(task.description);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(task.id, description);
    };

    return (
        <form onSubmit={handleSubmit}>
            <h3 className="text-xl font-semibold mb-4">Editar Tarefa</h3>
            <p className="mb-4 text-sm text-gray-600">Cliente: <strong>{clients.find(c => c.id === task.clientId)?.name}</strong></p>
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrição da Tarefa</label>
              <input 
                id="description"
                name="description"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-2 border rounded mt-1"
                required 
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar Tarefa</button>
            </div>
        </form>
    );
  };

  const AdminView = () => (
    <div>
      {clients.filter(c => c.status === 'Ativo').map(client => {
        const clientTasks = tasks.filter(t => t.clientId === client.id);
        if (clientTasks.length === 0) return null;
        return (
          <div key={client.id} className="mb-8">
            <h3 className="text-xl font-semibold text-black mb-4">{client.name} - {client.company}</h3>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <ul className="divide-y divide-gray-200">
                {clientTasks.map(task => (
                  <li key={task.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-800">{task.description}</p>
                      <div className="flex items-center text-xs text-gray-500 mt-1">
                          <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${getStatusClass(task.status)}`}>{formatTaskStatus(task.status)}</span>
                          {task.isRecurring && <span className="ml-3 px-2 py-1 font-semibold leading-tight rounded-full bg-indigo-100 text-indigo-800">Recorrente</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                        <button onClick={() => setEditingTask(task)} className="text-gray-400 hover:text-yellow-600" title="Editar">
                            <Icon path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" className="w-5 h-5" />
                        </button>
                        <button onClick={() => setTaskToDelete(task)} className="text-gray-400 hover:text-red-600" title="Excluir">
                            <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5" />
                        </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )
      })}
    </div>
  );

  const ClientView = () => {
      const clientTasks = tasks.filter(t => t.clientId === activeClientId);
      return (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
             <ul className="divide-y divide-gray-200">
                {clientTasks.map(task => {
                    const action = getTaskAction(task);
                    return (
                        <li key={task.id} className="p-4 flex items-center justify-between">
                           <div>
                             <p className="font-semibold text-gray-800">{task.description}</p>
                             <div className="flex items-center text-xs text-gray-500 mt-1">
                               <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${getStatusClass(task.status)}`}>{formatTaskStatus(task.status)}</span>
                               {task.isRecurring && <span className="ml-3 px-2 py-1 font-semibold leading-tight rounded-full bg-indigo-100 text-indigo-800">Mensal</span>}
                             </div>
                           </div>
                           {action && (
                               <button onClick={action.action} className="bg-green-500 text-white font-bold py-1 px-3 rounded-lg hover:bg-green-600 transition-colors">
                                   {action.label}
                               </button>
                           )}
                        </li>
                    )
                })}
                {clientTasks.length === 0 && <li className="p-4 text-center text-gray-500">Você não tem tarefas pendentes.</li>}
             </ul>
          </div>
      );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Gestão de Tarefas Mensais</h2>
        {canManage && (
          <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
            <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2" />
            Criar Tarefa
          </button>
        )}
      </div>

      {canManage ? <AdminView /> : <ClientView />}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <TaskForm onSubmit={handleCreateTask} onCancel={() => setIsModalOpen(false)} />
      </Modal>

      <Modal isOpen={!!editingTask} onClose={() => setEditingTask(null)}>
        {editingTask && <EditTaskForm task={editingTask} onSave={handleUpdateTask} onCancel={() => setEditingTask(null)} />}
      </Modal>

       <Modal isOpen={!!taskToDelete} onClose={() => setTaskToDelete(null)}>
        <div>
            <h3 className="text-xl font-semibold mb-4">Confirmar Exclusão</h3>
            <p>Você tem certeza que deseja excluir a tarefa <strong>"{taskToDelete?.description}"</strong>? Esta ação é irreversível.</p>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setTaskToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleDeleteTask} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Excluir</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default TasksView;