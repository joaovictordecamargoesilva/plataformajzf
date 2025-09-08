import React, { useState, useMemo } from 'react';
import { Invoice, User, Client, Settings, AppNotification, InvoicePaymentMethods } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import * as api from '../services/api';

interface BillingViewProps {
  invoices: Invoice[];
  setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
  currentUser: User;
  clients: Client[];
  users: User[];
  settings: Settings;
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  activeClientId: number | null;
  setIsLoading: (isLoading: boolean) => void;
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

const downloadFileFromBase64 = (base64: string, filename: string) => {
    const link = document.createElement('a');
    link.href = base64;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Helpers for PIX QR Code ---
const formatField = (id: string, value: string): string => {
  const len = String(value).length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

const generateBrCodePayload = (key: string, amount: number, name: string, city: string, txid: string): string => {
  const cleanName = name.substring(0, 25).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const cleanCity = city.substring(0, 15).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const cleanTxid = txid.substring(0, 25).replace(/\s/g, '');

  const gui = formatField('00', 'BR.GOV.BCB.PIX');
  const keyPart = formatField('01', key);
  const merchantAccountInfo = gui + keyPart;

  const payload = [
    formatField('00', '01'), // Payload Format Indicator
    formatField('26', merchantAccountInfo), // Merchant Account Information
    formatField('52', '0000'), // Merchant Category Code
    formatField('53', '986'), // Transaction Currency (BRL)
    formatField('54', amount.toFixed(2)), // Transaction Amount
    formatField('58', 'BR'), // Country Code
    formatField('59', cleanName), // Merchant Name
    formatField('60', cleanCity), // Merchant City
    formatField('62', formatField('05', cleanTxid)), // Additional Data Field (TXID)
  ].join('');
  
  // CRC16-CCITT calculation
  let crc = 0xFFFF;
  const data = payload + '6304';
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  const crc16 = (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  return data + crc16;
};


export const BillingView: React.FC<BillingViewProps> = ({ invoices, setInvoices, currentUser, clients, users, settings, addNotification, activeClientId, setIsLoading }) => {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [statusMenuOpenFor, setStatusMenuOpenFor] = useState<string | null>(null);
  
  const isClient = currentUser.role === 'Cliente';
  const canManage = currentUser.role === 'AdminGeral' || !!currentUser.permissions?.canManageBilling;

  const invoicesForView = currentUser.role === 'Cliente'
    ? invoices.filter(inv => inv.clientId === activeClientId)
    : invoices;
    
  const recurringModels = invoicesForView.filter(inv => inv.isRecurring);
  const monthlyInvoices = invoicesForView.filter(inv => !inv.isRecurring);
  
  const pendingInvoices = monthlyInvoices.filter(inv => inv.status === 'Pendente' || inv.status === 'Atrasado');
  const paidInvoices = monthlyInvoices.filter(inv => inv.status === 'Pago');
  
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
        const clientUser = users.find(u => u.clientIds.includes(updatedInvoice.clientId));
         if(clientUser) {
            addNotification({
                userId: clientUser.id,
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
        const clientUser = users.find(u => u.clientIds.includes(result.clientId));
        if(clientUser) {
            addNotification({
                userId: clientUser.id,
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

  const handleUpdateStatus = async (invoiceId: string, status: 'Pendente' | 'Pago' | 'Atrasado') => {
    setIsLoading(true);
    setStatusMenuOpenFor(null); // close menu
    try {
        const updatedInvoice = await api.updateInvoiceStatus(invoiceId, status);
        setInvoices(prev => prev.map(inv => inv.id === invoiceId ? updatedInvoice : inv));
        const clientUser = users.find(u => u.clientIds.includes(updatedInvoice.clientId));
        if(clientUser) {
            addNotification({
                userId: clientUser.id,
                message: `O status da sua fatura "${updatedInvoice.description}" foi atualizado para ${status}.`
            });
        }
    } catch (error) {
        console.error("Failed to update invoice status:", error);
    } finally {
        setIsLoading(false);
    }
  };
  
  const handleOpenPaymentModal = (invoice: Invoice) => {
      setSelectedInvoiceForPayment(invoice);
  };

  const CreateInvoiceForm: React.FC<{onSubmit: (data:any) => void, onCancel: ()=>void, clients: Client[]}> = ({onSubmit, onCancel, clients}) => {
    const [formData, setFormData] = useState({
      clientId: clients[0]?.id || 0,
      description: '',
      amount: '',
      dueDate: '',
      isRecurring: false,
    });
    const [paymentOptions, setPaymentOptions] = useState({
        pdf: null as File | null,
        pix: false,
        link: false,
        attachPdf: false,
    });
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const {name, value, type} = e.target;
        const isCheckbox = type === 'checkbox';
        setFormData(prev => ({...prev, [name]: isCheckbox ? (e.target as HTMLInputElement).checked : value}));
    }
    const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setPaymentOptions(prev => ({ ...prev, [name]: checked, pdf: name === 'attachPdf' && !checked ? null : prev.pdf }));
    }
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setPaymentOptions(prev => ({...prev, pdf: e.target.files?.[0] || null }));
    }

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const finalPaymentMethods: InvoicePaymentMethods = {
          pixEnabled: paymentOptions.pix,
          linkEnabled: paymentOptions.link
      };

      if (paymentOptions.attachPdf && paymentOptions.pdf) {
          finalPaymentMethods.pdfContent = await fileToBase64(paymentOptions.pdf);
      }
      
      onSubmit({ ...formData, paymentMethods: finalPaymentMethods });
    };

    return (
      <form onSubmit={handleSubmit}>
        <h3 className="text-xl font-semibold mb-4">Criar Nova Cobrança / Modelo</h3>
        <div className="space-y-4">
          <select name="clientId" value={formData.clientId} onChange={handleChange} className="w-full p-2 border rounded" required>
            {clients.filter(c => c.status === 'Ativo').map(c => <option key={c.id} value={c.id}>{c.name} - {c.company}</option>)}
          </select>
          <input name="description" value={formData.description} onChange={handleChange} placeholder="Descrição (ex: Mensalidade Contábil)" className="w-full p-2 border rounded" required/>
          <input name="amount" type="number" step="0.01" value={formData.amount} onChange={handleChange} placeholder="Valor (R$)" className="w-full p-2 border rounded" required/>
          {!formData.isRecurring && <input name="dueDate" type="date" value={formData.dueDate} onChange={handleChange} className="w-full p-2 border rounded" required={!formData.isRecurring} />}
          <label className="flex items-center">
            <input type="checkbox" name="isRecurring" checked={formData.isRecurring} onChange={handleChange} className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300"/>
            <span className="ml-2 text-sm text-gray-700">É um modelo de cobrança recorrente?</span>
          </label>
           <div className="border-t pt-4">
              <h4 className="font-semibold mb-2">Métodos de Pagamento</h4>
              <div className="space-y-3">
                 <label className="flex items-center"><input type="checkbox" name="pix" checked={paymentOptions.pix} onChange={handlePaymentChange} className="h-4 w-4 rounded text-primary"/> <span className="ml-2">Permitir pagamento via PIX</span></label>
                 <label className="flex items-center"><input type="checkbox" name="link" checked={paymentOptions.link} onChange={handlePaymentChange} className="h-4 w-4 rounded text-primary"/> <span className="ml-2">Permitir pagamento via Link</span></label>
                 <label className="flex items-center"><input type="checkbox" name="attachPdf" checked={paymentOptions.attachPdf} onChange={handlePaymentChange} className="h-4 w-4 rounded text-primary"/> <span className="ml-2">Anexar Boleto/PDF</span></label>
                 {paymentOptions.attachPdf && <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20" required={paymentOptions.attachPdf} />}
              </div>
            </div>
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
          <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Salvar</button>
        </div>
      </form>
    );
  };
  
  const PaymentOptionsModal: React.FC<{invoice: Invoice | null, settings: Settings, onClose: () => void}> = ({ invoice, settings, onClose }) => {
    const [copiedPix, setCopiedPix] = useState(false);
    if (!invoice) return null;

    const brCode = (invoice.paymentMethods?.pixEnabled && settings.pixKey) ? generateBrCodePayload(settings.pixKey, invoice.amount, "JZF Contabilidade", "SAO PAULO", `INV-${invoice.id.replace(/-/g, '')}`) : '';
    
    const hasPdf = !!invoice.paymentMethods?.pdfContent;
    const hasPix = !!(invoice.paymentMethods?.pixEnabled && settings.pixKey);
    const hasLink = !!(invoice.paymentMethods?.linkEnabled && settings.paymentLink);
    
    return (
        <Modal isOpen={!!invoice} onClose={onClose}>
            <div>
                <h3 className="text-2xl font-bold mb-2">Pagar Fatura</h3>
                <p className="text-gray-600 mb-1">{invoice.description}</p>
                <p className="text-lg font-semibold mb-6">Valor: R$ {invoice.amount.toFixed(2)}</p>

                <div className="space-y-4">
                    {hasPdf && (
                        <button onClick={() => downloadFileFromBase64(invoice.paymentMethods!.pdfContent!, `boleto_${invoice.id}.pdf`)} className="w-full flex items-center justify-center p-4 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700">
                           <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-6 h-6 mr-2"/> Baixar Boleto (PDF)
                        </button>
                    )}
                    {hasPix && (
                        <div className="p-4 border rounded-lg">
                            <h4 className="font-bold mb-2 text-center">Pague com PIX Copia e Cola</h4>
                            <p className="text-sm text-gray-500 mb-3 text-center">Copie o código abaixo e pague em seu aplicativo do banco.</p>
                             <div className="flex items-center bg-gray-100 p-2 rounded-lg border">
                                <span className="font-mono text-gray-700 text-xs break-all flex-1 mr-2 text-left">{brCode}</span>
                                <button
                                    onClick={() => { navigator.clipboard.writeText(brCode); setCopiedPix(true); setTimeout(() => setCopiedPix(false), 2000); }}
                                    className={`text-sm font-bold py-1 px-3 rounded-md transition-colors ${copiedPix ? 'bg-green-500 text-white' : 'bg-primary text-white hover:bg-primary-dark'}`}
                                >
                                    <Icon path={copiedPix ? "M5 13l4 4L19 7" : "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"} className="w-4 h-4 inline-block mr-1" />
                                    {copiedPix ? 'Copiado!' : 'Copiar'}
                                </button>
                            </div>
                        </div>
                    )}
                    {hasLink && (
                        <a href={settings.paymentLink} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center p-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                           <Icon path="M13.828 10.172a4 4 0 01-5.656 0l-4-4a4 4 0 115.656-5.656l1.102 1.101m-.758 2.828l-1.1 1.1a4 4 0 01-5.656 0l-4-4a4 4 0 015.656-5.656l4 4a4 4 0 010 5.656l-1.1 1.1" className="w-6 h-6 mr-2"/> Acessar Link de Pagamento
                        </a>
                    )}
                </div>
            </div>
        </Modal>
    );
  }
  
  const InvoiceTable: React.FC<{ title: string, invoices: Invoice[], isRecurring?: boolean }> = ({ title, invoices, isRecurring = false }) => (
    <div className="bg-white rounded-lg shadow-lg">
      <h3 className="text-xl font-bold text-black p-5">{title}</h3>
      <div className="overflow-x-auto">
      <table className="min-w-full leading-normal">
        <thead>
          <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
            {!isClient && <th className="px-5 py-3">Cliente</th>}
            <th className="px-5 py-3">Descrição</th>
            <th className="px-5 py-3">Valor</th>
            {!isRecurring && <th className="px-5 py-3">Vencimento</th>}
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map(inv => {
            const client = clients.find(c => c.id === inv.clientId);
            const hasPaymentMethods = inv.status !== 'Pago' && inv.paymentMethods && (
                (inv.paymentMethods.pdfContent && inv.paymentMethods.pdfContent.length > 0) || 
                inv.paymentMethods.pixEnabled || 
                inv.paymentMethods.linkEnabled
            );
            return (
              <tr key={inv.id} className="border-b border-gray-200 hover:bg-gray-50">
                {!isClient && <td className="px-5 py-5 text-sm">{client?.company || 'N/A'}</td>}
                <td className="px-5 py-5 text-sm">{inv.description}</td>
                <td className="px-5 py-5 text-sm">
                  {editingInvoice?.id === inv.id ? (
                     <input type="number" defaultValue={inv.amount} onBlur={(e) => handleUpdateInvoice(inv.id, parseFloat(e.target.value))} className="w-24 p-1 border rounded"/>
                  ) : `R$ ${inv.amount.toFixed(2)}`}
                </td>
                {!isRecurring && <td className="px-5 py-5 text-sm">{new Date(inv.dueDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'})}</td>}
                <td className="px-5 py-5 text-sm">
                  <span className={`px-2 py-1 font-semibold leading-tight rounded-full ${getStatusClass(inv.status)}`}>{inv.status}</span>
                </td>
                <td className="px-5 py-5 text-sm">
                  <div className="flex items-center space-x-3">
                    {isClient && !inv.isRecurring && hasPaymentMethods && (
                        <button onClick={() => handleOpenPaymentModal(inv)} className="bg-primary text-white font-bold py-1 px-3 rounded-lg text-xs">
                            Pagar
                        </button>
                    )}
                    {canManage && (
                      <>
                        <button onClick={() => setEditingInvoice(inv)} title="Editar Valor" className="text-yellow-600 hover:text-yellow-900"><Icon path="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L14.732 3.732z" className="w-5 h-5"/></button>
                        <button onClick={() => setInvoiceToDelete(inv)} title="Excluir" className="text-red-600 hover:text-red-900"><Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5"/></button>
                        <div className="relative">
                            <button onClick={() => setStatusMenuOpenFor(statusMenuOpenFor === inv.id ? null : inv.id)} title="Alterar Status" className="text-blue-600 hover:text-blue-900">
                                <Icon path="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" className="w-5 h-5"/>
                            </button>
                            {statusMenuOpenFor === inv.id && (
                                <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg z-10 border">
                                    <button onClick={() => handleUpdateStatus(inv.id, 'Pago')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Pago</button>
                                    <button onClick={() => handleUpdateStatus(inv.id, 'Pendente')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Pendente</button>
                                    <button onClick={() => handleUpdateStatus(inv.id, 'Atrasado')} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Atrasado</button>
                                </div>
                            )}
                        </div>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Cobranças e Pagamentos</h2>
        {canManage && (
          <button onClick={() => setCreateModalOpen(true)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
            <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2" />
            Criar Cobrança
          </button>
        )}
      </div>

      <div className="space-y-8">
        {recurringModels.length > 0 && <InvoiceTable title="Modelos Recorrentes" invoices={recurringModels} isRecurring={true} />}
        {pendingInvoices.length > 0 && <InvoiceTable title="Faturas Pendentes" invoices={pendingInvoices} />}
        {paidInvoices.length > 0 && <InvoiceTable title="Faturas Pagas" invoices={paidInvoices} />}
      </div>
      
      <Modal isOpen={isCreateModalOpen} onClose={() => setCreateModalOpen(false)}>
        <CreateInvoiceForm onSubmit={handleCreateInvoice} onCancel={() => setCreateModalOpen(false)} clients={clients} />
      </Modal>

      <PaymentOptionsModal 
        invoice={selectedInvoiceForPayment}
        settings={settings}
        onClose={() => setSelectedInvoiceForPayment(null)}
      />

      <Modal isOpen={!!invoiceToDelete} onClose={() => setInvoiceToDelete(null)}>
        <div>
          <h3 className="text-xl font-semibold mb-4">Confirmar Exclusão</h3>
          <p>Você tem certeza que deseja excluir a cobrança/modelo <strong>{invoiceToDelete?.description}</strong>? Esta ação é irreversível.</p>
          <div className="mt-6 flex justify-end space-x-3">
            <button type="button" onClick={() => setInvoiceToDelete(null)} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
            <button type="button" onClick={handleConfirmDelete} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg">Excluir</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
