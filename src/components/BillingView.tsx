


import React, { useState, useMemo } from 'react';
import { Invoice, Payment, User, Client, Settings, AppNotification } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import { generateBoletoPdf } from '../services/boletoService';
import * as api from '../services/api';

interface BillingViewProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  currentUser: User;
  clients: Client[];
  settings: Settings;
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  activeClientId: number | null;
  setIsLoading: (isLoading: boolean) => void;
}

const BillingView: React.FC<BillingViewProps> = ({ invoices, setInvoices, currentUser, clients, settings, addNotification, activeClientId, setIsLoading }) => {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isPaymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{type: 'pix' | 'link', data: any} | null>(null);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', status: '' });
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);

  const canManage = currentUser.role === 'AdminGeral' || !!currentUser.permissions?.canManageBilling;

  const invoicesForView = currentUser.role === 'Cliente'
    ? invoices.filter(inv => inv.clientId === activeClientId)
    : invoices;
    
  const recurringModels = invoicesForView.filter(inv => inv.recurring?.isRecurring);
  const monthlyInvoices = invoicesForView.filter(inv => !inv.recurring?.isRecurring);
  
  const filteredMonthlyInvoices = useMemo(() => {
    return monthlyInvoices.filter(inv => {
        const dueDate = new Date(inv.dueDate);
        const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
        const toDate = filters.dateTo ? new Date(filters.dateTo) : null;

        if (fromDate && dueDate < fromDate) return false;
        if (toDate && dueDate > toDate) return false;
        if (filters.status && inv.status !== filters.status) return false;
        
        return true;
    });
  }, [monthlyInvoices, filters]);


  const pendingInvoices = filteredMonthlyInvoices.filter(inv => inv.status === 'Pendente' || inv.status === 'Atrasado');
  const paidInvoices = filteredMonthlyInvoices.filter(inv => inv.status === 'Pago');
  
  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const getStatusClass = (status: 'Pendente' | 'Pago' | 'Atrasado') => {
    switch (status) {
      case 'Pendente': return 'bg-yellow-100 text-yellow-800';
      case 'Pago': return 'bg-green-100 text-green-800';
      case 'Atrasado': return 'bg-red-100 text-red-800';
    }
  };
  
  const handleUpdateInvoice = async (invoiceId: string, newAmount: number) => {
    setIsLoading(true);
    try {
        const updatedInvoice = await api.updateInvoiceAmount(invoiceId, newAmount);
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updatedInvoice : inv));
        const client = clients.find(c => c.id === updatedInvoice.clientId);
        if (client) {
            addNotification({
                userId: client.userId,
                message: `Sua fatura "${updatedInvoice.description}" foi atualizada para o valor de R$ ${newAmount.toFixed(2)}.`
            });
        }
    } catch (error) {
        console.error("Failed to update invoice:", error);
    } finally {
        setIsLoading(false);
        setEditingInvoice(null);
    }
  };
  
  const handleConfirmDelete = async () => {
    if (!invoiceToDelete) return;
    setIsLoading(true);
    try {
        await api.deleteInvoice(invoiceToDelete.id);
        setInvoices(prev => prev.filter(inv => inv.id !== invoiceToDelete.id));
    } catch (error) {
        console.error("Failed to delete invoice:", error);
    } finally {
        setIsLoading(false);
        setInvoiceToDelete(null);
    }
  };

  const handleCreateInvoice = async (data: any) => {
    setIsLoading(true);
    try {
        const result = await api.createInvoice(data);
        setInvoices(prev => [...prev, ...result.invoicesToAdd]);
        const client = clients.find(c => c.id === result.clientId);
        if (client) {
            addNotification({
                userId: client.userId,
                message: result.notificationMessage
            });
        }
    } catch (error) {
        console.error("Failed to create invoice:", error);
    } finally {
        setIsLoading(false);
        setCreateModalOpen(false);
    }
  };
  
  const handleOpenPaymentModal = (type: 'pix' | 'link', invoice: Invoice) => {
      if(type === 'pix') setPaymentInfo({type, data: settings.pixKey});
      if(type === 'link') setPaymentInfo({type, data: settings.paymentLink});
      setPaymentModalOpen(true);
  }

  const downloadBoleto = (invoice: Invoice) => {
    const description = invoice.description;
    const makeDownload = (pdfData: string) => {
        const link = document.createElement('a');
        link.href = pdfData;
        link.download = `boleto_${description.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (invoice.boletoPdf) {
      makeDownload(invoice.boletoPdf);
    } else {
      const client = clients.find(c => c.id === invoice.clientId);
      if (client) {
          const invData = { clientId: invoice.clientId, description: invoice.description, amount: invoice.amount, dueDate: invoice.dueDate };
          const pdf = generateBoletoPdf(invData, client);
          setInvoices(prevInvoices => prevInvoices.map(i => i.id === invoice.id ? {...i, boletoPdf: pdf} : i));
          makeDownload(pdf);
      } else {
          alert('Não foi possível gerar o boleto pois os dados do cliente não foram encontrados.');
      }
    }
  };

  const CreateInvoiceForm: React.FC<{onSubmit: (data:any) => void, onCancel: ()=>void}> = ({onSubmit, onCancel}) => {
    const [formData, setFormData] = useState({
      clientId: clients[0]?.id || 0,
      description: '',
      amount: '',
      dueDate: '',
      isRecurring: false,
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value, type} = e.target;
        const isCheckbox = type === 'checkbox';
        setFormData(prev => ({...prev, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value}));
    }

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData);
    };

    return (
      <form onSubmit={handleSubmit}>
        <h3 className="text-xl font-semibold mb-4">Criar Nova Cobrança / Modelo</h3>
        <div className="space-y-4">
          <select name="clientId" value={formData.clientId} onChange={handleChange} className="w-full p-2 border rounded" required>
            <option value="">Selecione um cliente</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input name="description" value={formData.description} onChange={handleChange} placeholder="Descrição (ex: Honorários Contábeis)" className="w-full p-2 border rounded" required />
          <input name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} placeholder="Valor (R$)" className="w-full p-2 border rounded" required />
          <input name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} className="w-full p-2 border rounded" required={!formData.isRecurring} disabled={formData.isRecurring} />
          
          <label className="flex items-center">
            <input type="checkbox" name="isRecurring" checked={formData.isRecurring} onChange={handleChange} className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300"/>
            <span className="ml-2 text-sm text-gray-700">Marcar como Cobrança Recorrente (modelo)</span>
          </label>
           {formData.isRecurring && <p className="text-xs text-gray-500">Ao marcar, um modelo será salvo para recorrência e a fatura para o mês atual será gerada e enviada ao cliente automaticamente com um boleto simulado.</p>}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
          <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Criar</button>
        </div>
      </form>
    );
  }
  
  const EditInvoiceForm: React.FC<{invoice: Invoice, onSave: (id: string, amount: number) => void, onCancel: () => void}> = ({ invoice, onSave, onCancel }) => {
    const [amount, setAmount] = useState(invoice.amount.toString());

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(invoice.id, parseFloat(amount));
    };

    return (
        <form onSubmit={handleSubmit}>
            <h3 className="text-xl font-semibold mb-4">Editar Valor da Fatura</h3>
            <p className="mb-2 text-sm text-gray-600">Fatura: <strong>{invoice.description}</strong></p>
            <p className="mb-4 text-sm text-gray-600">Cliente: <strong>{clients.find(c => c.id === invoice.clientId)?.name}</strong></p>
            <div>
              <label htmlFor="amount" className="block text-sm font-medium text-gray-700">Novo Valor (R$)</label>
              <input 
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full p-2 border rounded mt-1"
                required 
              />
            </div>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar Alteração</button>
            </div>
        </form>
    );
  };
  
  const PaymentModalContent: React.FC<{info: typeof paymentInfo, onClose: ()=>void}> = ({info, onClose}) => {
      if(!info) return null;
      return (
        <div>
            {info.type === 'pix' && (
                <>
                <h3 className="text-xl font-semibold mb-2">Pagar com Pix</h3>
                <p className="mb-4">Use a chave abaixo (copia e cola) no seu aplicativo do banco:</p>
                <div className="bg-gray-100 p-3 rounded font-mono break-words">{info.data || 'Chave Pix não configurada.'}</div>
                </>
            )}
            {info.type === 'link' && (
                <>
                <h3 className="text-xl font-semibold mb-2">Link de Pagamento</h3>
                <p className="mb-4">Clique no link abaixo para ir para a página de pagamento seguro:</p>
                <a href={info.data} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-words">{info.data || 'Link de pagamento não configurado.'}</a>
                </>
            )}
            <div className="mt-6 flex justify-end">
                <button onClick={onClose} className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Fechar</button>
            </div>
        </div>
      )
  }

  const InvoiceCard: React.FC<{invoice: Invoice, isModel?: boolean}> = ({invoice, isModel}) => {
    const client = clients.find(c => c.id === invoice.clientId);
    return (
        <div key={invoice.id} className="bg-white rounded-lg shadow-lg p-6 flex flex-col justify-between">
            <div>
            <div className="flex justify-between items-start">
                <h4 className="font-bold text-lg text-black">{invoice.description}</h4>
                 <div className="flex items-center space-x-2">
                    {!isModel && <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(invoice.status)}`}>{invoice.status}</span>}
                    {isModel && <span className="px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">Modelo Recorrente</span>}
                    {canManage && !isModel && (invoice.status === 'Pendente' || invoice.status === 'Atrasado') && (
                        <button onClick={() => setEditingInvoice(invoice)} className="text-gray-400 hover:text-primary-dark">
                            <Icon path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" className="w-4 h-4" />
                        </button>
                    )}
                    {canManage && (
                         <button onClick={() => setInvoiceToDelete(invoice)} className="text-gray-400 hover:text-red-600">
                             <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-4 h-4" />
                         </button>
                    )}
                </div>
            </div>
            {client && currentUser.role !== 'Cliente' && (
                <p className="text-sm text-gray-600 mt-1">{client.name} - {client.company}</p>
            )}
            <p className="text-3xl font-bold text-text-primary my-4">R$ {invoice.amount.toFixed(2)}</p>
            {!isModel && <p className="text-sm text-gray-600">Vencimento: {new Date(invoice.dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</p>}
            </div>
            
            <div className="mt-6 flex flex-col space-y-2">
                {!isModel && invoice.status !== 'Pago' && currentUser.role === 'Cliente' && (
                    <>
                        
                        <button onClick={() => downloadBoleto(invoice)} className="flex items-center justify-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors">
                            <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-5 h-5 mr-2" /> Baixar Boleto
                        </button>
                        
                        <button onClick={() => handleOpenPaymentModal('pix', invoice)} className="flex items-center justify-center bg-gray-700 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-800 transition-colors">
                            <Icon path="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" className="w-5 h-5 mr-2" /> Pagar com Pix
                        </button>
                        <button onClick={() => handleOpenPaymentModal('link', invoice)} className="flex items-center justify-center bg-gray-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors">
                            <Icon path="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" className="w-5 h-5 mr-2" /> Link de Pagamento
                        </button>
                    </>
                )}
            </div>
        </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Cobranças e Pagamentos</h2>
        {canManage && (
        <div className="flex items-center space-x-2">
            <button onClick={() => setCreateModalOpen(true)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                <Icon path="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" className="w-5 h-5 mr-2" />
                Criar Cobrança / Modelo
            </button>
        </div>
        )}
      </div>
      
      <div className="bg-gray-100 p-4 rounded-lg mb-6 flex items-center space-x-4">
            <h4 className="font-semibold text-sm text-text-primary">Filtros:</h4>
            <input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleFilterChange} className="p-2 border rounded text-sm"/>
            <span className="text-sm text-text-primary">até</span>
            <input type="date" name="dateTo" value={filters.dateTo} onChange={handleFilterChange} className="p-2 border rounded text-sm"/>
            <select name="status" value={filters.status} onChange={handleFilterChange} className="p-2 border rounded text-sm">
                <option value="">Todos os Status</option>
                <option value="Pendente">Pendente</option>
                <option value="Pago">Pago</option>
                <option value="Atrasado">Atrasado</option>
            </select>
      </div>

      {canManage && recurringModels.length > 0 && (
         <div className="mb-8">
            <h3 className="text-xl font-semibold text-black mb-4">Modelos de Cobrança Recorrente</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {recurringModels.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} isModel={true} />)}
            </div>
          </div>
      )}

      <div className="mb-8">
        <h3 className="text-xl font-semibold text-black mb-4">Faturas Pendentes e Atrasadas</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pendingInvoices.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} />)}
        </div>
        {pendingInvoices.length === 0 && <p className="text-gray-500">Nenhuma fatura pendente ou atrasada encontrada com os filtros atuais.</p>}
      </div>
      
       <div className="mb-8">
            <h3 className="text-xl font-semibold text-black mb-4">Faturas Pagas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {paidInvoices.map(invoice => <InvoiceCard key={invoice.id} invoice={invoice} />)}
            </div>
            {paidInvoices.length === 0 && <p className="text-gray-500">Nenhuma fatura paga encontrada com os filtros atuais.</p>}
        </div>

      <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)}>
        <CreateInvoiceForm onSubmit={handleCreateInvoice} onCancel={() => setCreateModalOpen(false)} />
      </Modal>
      <Modal isOpen={isPaymentModalOpen} onClose={() => setPaymentModalOpen(false)}>
        <PaymentModalContent info={paymentInfo} onClose={() => setPaymentModalOpen(false)} />
      </Modal>
      <Modal isOpen={!!editingInvoice} onClose={() => setEditingInvoice(null)}>
        {editingInvoice && <EditInvoiceForm invoice={editingInvoice} onSave={handleUpdateInvoice} onCancel={() => setEditingInvoice(null)} />}
      </Modal>
       <Modal isOpen={!!invoiceToDelete} onClose={() => setInvoiceToDelete(null)}>
        <div>
            <h3 className="text-xl font-semibold mb-4">Confirmar Exclusão</h3>
            <p>Você tem certeza que deseja excluir a cobrança/modelo <strong>{invoiceToDelete?.description}</strong>? Esta ação não pode ser desfeita.</p>
            <div className="mt-6 flex justify-end space-x-3">
                <button type="button" onClick={() => setInvoiceToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <button type="button" onClick={handleConfirmDelete} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Excluir</button>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default BillingView;