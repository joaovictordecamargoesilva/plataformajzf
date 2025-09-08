import React, { useState, useEffect } from 'react';
import { Settings, TaskTemplateSet } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import * as api from '../services/api';

interface SettingsViewProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  taskTemplateSets: TaskTemplateSet[];
  setTaskTemplateSets: React.Dispatch<React.SetStateAction<TaskTemplateSet[]>>;
  setIsLoading: (loading: boolean) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ settings, setSettings, taskTemplateSets, setTaskTemplateSets, setIsLoading }) => {
  const [formData, setFormData] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState(Notification.permission);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const handleRequestPermission = () => {
    Notification.requestPermission().then(permission => {
      setNotificationPermission(permission);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setSaved(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
        const updatedSettings = await api.updateSettings(formData);
        setSettings(updatedSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    } catch(error) {
        console.error("Failed to save settings", error);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleSaveTemplate = async (templateData: { name: string, tasks: string }) => {
    setIsLoading(true);
    try {
        const newTemplate = await api.createTaskTemplate(templateData);
        setTaskTemplateSets(prev => [...prev, newTemplate]);
    } catch(error) {
        console.error("Failed to save template", error);
    } finally {
        setIsLoading(false);
        setIsTemplateModalOpen(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
      if(window.confirm("Tem certeza que deseja excluir este modelo de tarefas?")) {
        setIsLoading(true);
        try {
            await api.deleteTaskTemplate(templateId);
            setTaskTemplateSets(prev => prev.filter(t => t.id !== templateId));
        } catch(error) {
            console.error("Failed to delete template", error);
        } finally {
            setIsLoading(false);
        }
      }
  };
  
  const TemplateForm: React.FC<{onSave: (data: any) => void, onCancel: () => void}> = ({ onSave, onCancel }) => {
    const [name, setName] = useState('');
    const [tasks, setTasks] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave({ name, tasks });
    };

    return (
      <form onSubmit={handleSubmit}>
        <h3 className="text-xl font-semibold mb-4">Novo Modelo de Tarefas</h3>
        <div className="space-y-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Nome do Modelo (ex: Checklist Mensal)" className="w-full p-2 border rounded" required />
          <textarea value={tasks} onChange={e => setTasks(e.target.value)} placeholder={"Digite cada tarefa em uma nova linha.\nEx: Enviar notas fiscais de serviço\nEnviar extratos bancários"} className="w-full p-2 border rounded" rows={6} required></textarea>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
          <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar Modelo</button>
        </div>
      </form>
    );
  };


  return (
    <div>
      <h2 className="text-3xl font-bold text-black mb-6">Configurações</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white p-8 rounded-lg shadow-lg">
          <h3 className="text-2xl font-bold text-black mb-6">Cobrança</h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="pixKey" className="block text-sm font-medium text-gray-700 mb-1">
                Chave Pix
              </label>
              <input
                type="text"
                name="pixKey"
                id="pixKey"
                value={formData.pixKey}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Digite sua chave Pix (CPF, CNPJ, etc.)"
              />
            </div>
            <div>
              <label htmlFor="paymentLink" className="block text-sm font-medium text-gray-700 mb-1">
                Link de Pagamento Padrão
              </label>
              <input
                type="text"
                name="paymentLink"
                id="paymentLink"
                value={formData.paymentLink}
                onChange={handleChange}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="https://seu-provedor.com/pagar"
              />
            </div>
            <div className="flex items-center justify-end">
              {saved && (
                  <span className="text-green-600 mr-4 transition-opacity duration-300">Salvo!</span>
              )}
              <button
                type="submit"
                className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors"
              >
                <Icon path="M5 13l4 4L19 7" className="w-5 h-5 mr-2" />
                Salvar Alterações
              </button>
            </div>
          </form>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-lg">
           <h3 className="text-2xl font-bold text-black mb-6">Notificações</h3>
           <div className="space-y-4">
              <p className="text-gray-600">
                Receba alertas instantâneos no seu navegador sobre novas cobranças e solicitações de documentos.
              </p>
              {notificationPermission === 'granted' && (
                <div className="flex items-center p-4 bg-green-100 text-green-800 rounded-lg">
                  <Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-6 h-6 mr-3" />
                  As notificações no navegador estão ativadas.
                </div>
              )}
               {notificationPermission === 'denied' && (
                <div className="flex items-center p-4 bg-red-100 text-red-800 rounded-lg">
                  <Icon path="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-6 h-6 mr-3" />
                  As notificações estão bloqueadas. Você precisa alterar as permissões no seu navegador.
                </div>
              )}
              {notificationPermission === 'default' && (
                <button
                  onClick={handleRequestPermission}
                  className="w-full flex items-center justify-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-blue-600 transition-colors"
                >
                  <Icon path="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" className="w-5 h-5 mr-2" />
                  Ativar notificações no navegador
                </button>
              )}
           </div>
        </div>

        <div className="md:col-span-2 bg-white p-8 rounded-lg shadow-lg">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold text-black">Modelos de Tarefas</h3>
            <button onClick={() => setIsTemplateModalOpen(true)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
              <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2"/> Adicionar Modelo
            </button>
          </div>
          <div className="space-y-4">
              {taskTemplateSets.map(template => (
                  <div key={template.id} className="bg-gray-50 p-4 rounded-lg flex justify-between items-start">
                      <div>
                          <h4 className="font-bold text-primary">{template.name}</h4>
                          <ul className="list-disc list-inside text-sm text-gray-600 mt-2 pl-2">
                              {template.taskDescriptions.map((desc, i) => <li key={i}>{desc}</li>)}
                          </ul>
                      </div>
                      <button onClick={() => handleDeleteTemplate(template.id)} className="text-red-500 hover:text-red-700">
                          <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5"/>
                      </button>
                  </div>
              ))}
              {taskTemplateSets.length === 0 && <p className="text-center text-gray-500 py-4">Nenhum modelo de tarefa criado.</p>}
          </div>
        </div>
      </div>
       <Modal isOpen={isTemplateModalOpen} onClose={() => setIsTemplateModalOpen(false)}>
          <TemplateForm onSave={handleSaveTemplate} onCancel={() => setIsTemplateModalOpen(false)}/>
      </Modal>
    </div>
  );
};

export default SettingsView;