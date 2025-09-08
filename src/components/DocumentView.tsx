import React, { useState, useEffect, useMemo } from 'react';
import { Document, User, Client, AppNotification, DocumentStatus, DocumentTemplate, DocumentTemplateField, RequiredSignatory, Signature, Task, Employee, DocumentCategory, AuditLog } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as api from '../services/api';
import DocumentRequestSelectionModal from './DocumentRequestSelectionModal';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ADMISSION_TEMPLATE, TERMINATION_TEMPLATE, AVISO_FERIAS_TEMPLATE, documentRequestLists, fileRestrictions } from '../constants';


interface DocumentViewProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  currentUser: User;
  clients: Client[];
  users: User[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  documentTemplates: DocumentTemplate[];
  directAction: { type: string, payload: any } | null;
  setDirectAction: (action: null) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  activeClientId: number | null;
  setIsLoading: (isLoading: boolean) => void;
  employees: Employee[];
  handleInactivateEmployee: (employeeId: number) => Promise<void>;
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

const formatDocumentStatus = (status: DocumentStatus): string => {
    switch (status) {
        case 'AguardandoAssinatura': return 'Aguardando Assinatura';
        case 'AguardandoAprovacao': return 'Aguardando Aprovação';
        case 'PendenteEtapa2': return 'Pendente Etapa 2';
        case 'Concluido': return 'Concluído';
        default: return status;
    }
}

const downloadReceiptAsPdf = (docData: Document, clientName?: string) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Recibo de Envio de Documento', 14, 22);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    
    autoTable(doc, {
        startY: 30,
        head: [[docData.name]],
        body: [
            ['Cliente', clientName || 'N/A'],
            ['Data de Envio', new Date(docData.uploadDate).toLocaleString('pt-BR')],
            ['Enviado Por', docData.uploadedBy],
            ['Status', formatDocumentStatus(docData.status)],
        ],
        theme: 'striped'
    });
    
    doc.save(`recibo_${docData.id}.pdf`);
};

const generateAvisoPrevioPdf = (docData: Document, client: Client) => {
    const doc = new jsPDF();
    const {
        nome_funcionario_rescisao: employeeName,
        data_aviso_previo: noticeDate,
        motivo_rescisao: reason,
        tipo_aviso_previo: noticeType
    } = docData.formData || {};

    // Placeholder for logo
    doc.setFontSize(10);
    doc.setTextColor('#922c26');
    doc.text('JZF Contabilidade', 20, 20);
    doc.setTextColor('#333333');

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AVISO PRÉVIO DO EMPREGADOR', doc.internal.pageSize.getWidth() / 2, 40, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.text(`Local e Data: ________________________, ${new Date().toLocaleDateString('pt-BR')}`, 20, 60);

    doc.text(`À`, 20, 80);
    doc.text(`Sr(a). ${employeeName || '[Nome do Funcionário]'}`, 20, 85);
    doc.text(`CTPS Nº: _______________ Série: _______`, 20, 90);


    const bodyText = `
Pela presente, comunicamos que, a partir de ${noticeDate ? new Date(noticeDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '[Data do Aviso]'}, não serão mais necessários os seus serviços em nossa empresa, ${client.company}, inscrita no CNPJ sob o nº ${client.cnpj || '[CNPJ da Empresa]'}.

O motivo desta rescisão é: ${reason || '[Motivo]'}.

Seu aviso prévio será na modalidade: ${noticeType || '[Tipo]'}.

Solicitamos a sua apresentação ao departamento de Recursos Humanos para as devidas providências e acerto final.
`;
    doc.text(bodyText, 20, 110, { maxWidth: 170, lineHeightFactor: 1.5 });
    
    doc.text('Atenciosamente,', 20, 180);

    doc.text('________________________________', 20, 200);
    doc.text(client.company, 20, 205);
    doc.text(`CNPJ: ${client.cnpj || '[CNPJ da Empresa]'}`, 20, 210);

    doc.text('Ciente em: _____/_____/______', 20, 240);
    doc.text('________________________________', 20, 260);
    doc.text(employeeName || '[Nome do Funcionário]', 20, 265);
    doc.text(`CPF: ${docData.formData?.cpf_rescisao || '[CPF do Funcionário]'}`, 20, 270);


    return doc;
};

// A more robust way to convert Uint8Array to base64
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}


// --- Main Component ---
const DocumentView: React.FC<DocumentViewProps> = ({ documents, setDocuments, currentUser, clients, users, addNotification, documentTemplates, directAction, setDirectAction, setTasks, activeClientId, setIsLoading, employees, handleInactivateEmployee }) => {
  const isClient = currentUser.role === 'Cliente';
  const [selectedClientId, setSelectedClientId] = useState<number | 'all'>(isClient && activeClientId ? activeClientId : 'all');
  
  // Modals state
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const [isSelectionModalOpen, setSelectionModalOpen] = useState<{isOpen: boolean; type: 'send' | 'request'}>({isOpen: false, type: 'send'});
  const [isSendModalOpen, setSendModalOpen] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  
  // Data state
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [initialFormData, setInitialFormData] = useState<Record<string, any> | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);

  const complexTemplates = [ADMISSION_TEMPLATE, TERMINATION_TEMPLATE, AVISO_FERIAS_TEMPLATE];

  useEffect(() => {
    if (isClient && activeClientId) {
      setSelectedClientId(activeClientId);
    }
  }, [activeClientId, isClient]);

   useEffect(() => {
    if (directAction?.type === 'OPEN_DOC_MODAL') {
      const { templateId, task } = directAction.payload;
      const template = complexTemplates.find(t => t.id === templateId);
      if (template) {
        setTaskToComplete(task);
        setEditingDocument(null);
        setSelectedTemplate(template);
        setInitialFormData({});
        setTemplateModalOpen(true);
      }
      setDirectAction(null);
    }
  }, [directAction, documentTemplates, setDirectAction, complexTemplates]);

  const handleOpenDetails = (doc: Document) => {
    setSelectedDocument(doc);
    setDetailsModalOpen(true);
  };
  
   const handleOpenForEditing = (doc: Document) => {
    const template = complexTemplates.find(t => t.id === doc.templateId);
    if(template) {
        setEditingDocument(doc);
        setSelectedTemplate(template);
        setInitialFormData(doc.formData || {});
        setTemplateModalOpen(true);
    }
  };

  const handleSelection = (docName: string, observation: string) => {
    setSelectionModalOpen({isOpen: false, type: 'send'}); // Close selection modal
    if (docName === 'Outro') {
        setRequestModalOpen(true);
        return;
    }

    if (isSelectionModalOpen.type === 'send') {
        const complexTemplate = complexTemplates.find(t => t.name === docName);
        
        if (complexTemplate) {
             setSelectedTemplate(complexTemplate);
        } else {
            const acceptedTypes = fileRestrictions[docName] || '*';
            const simpleTemplate: DocumentTemplate = {
                id: docName.toLowerCase().replace(/ /g, '-'),
                name: docName,
                category: (Object.keys(documentRequestLists) as DocumentCategory[]).find(cat => documentRequestLists[cat].includes(docName)) || 'Outro',
                fields: [{ id: 'observacao', label: 'Observações', type: 'textarea', required: false }],
                fileConfig: { isRequired: true, acceptedTypes }
            };
            setSelectedTemplate(simpleTemplate);
        }
        
        setEditingDocument(null);
        setInitialFormData({ observacao: observation });
        setTemplateModalOpen(true); // Open the actual form modal

    } else { // type === 'request'
        if (!isClient && selectedClientId === 'all') {
            alert("Por favor, selecione um cliente no filtro para solicitar este tipo de documento.");
            return;
        }
        // When an admin makes a request, we must provide the client ID.
        // When a client makes a request, the clientId is determined inside handleSaveRequest from activeClientId.
        const requestData: { requestText: string, description: string, clientId?: number } = {
             requestText: docName,
             description: observation
        };
        if (!isClient) {
            requestData.clientId = selectedClientId as number;
        }
        handleSaveRequest(requestData);
    }
  };

  const handleSaveRequest = async (data: { clientId?: number; requestText: string; description?: string }) => {
    setIsLoading(true);
    try {
        const targetClientId = isClient && activeClientId ? activeClientId : data.clientId!;
        const newDoc = await api.createDocumentRequest(targetClientId, data.requestText, currentUser.name, isClient ? 'cliente' : 'escritorio', data.description);
        setDocuments(prev => [newDoc, ...prev]);
        
        if (!isClient) {
            setSelectedClientId(targetClientId);
        }
        
        if (isClient) {
            users.filter(u => u.role.includes('Admin')).forEach(admin => {
                addNotification({ userId: admin.id, message: `${currentUser.name} solicitou um documento: ${newDoc.name}`});
            });
        } else {
            const clientUser = users.find(u => u.clientIds?.includes(targetClientId));
            if(clientUser) {
                addNotification({ userId: clientUser.id, message: `Nova solicitação de documento: ${data.requestText}`});
            }
        }
    } catch (error) {
        console.error("Failed to save document request:", error);
    } finally {
        setIsLoading(false);
        setRequestModalOpen(false);
    }
  };

  const handleAdminSend = async (data: { clientId: number; docName: string; file: File, signatoryIds: string[] }) => {
      setIsLoading(true);
      try {
        const fileContent = await fileToBase64(data.file);
        const newDoc = await api.sendDocumentFromAdmin({ ...data, signatoryIds: data.signatoryIds }, fileContent, currentUser.name);
        setDocuments(prev => [newDoc, ...prev]);
        setSelectedClientId(data.clientId);

        const clientUser = users.find(u => u.clientIds?.includes(data.clientId));
        if(clientUser) {
            const message = newDoc.requiredSignatories && newDoc.requiredSignatories.length > 0
                ? `Novo documento para assinar: ${data.docName}`
                : `O escritório enviou um novo documento: ${data.docName}`;
            addNotification({ userId: clientUser.id, message });
        }
      } catch (error) {
        console.error("Failed to send document from admin:", error);
      } finally {
        setIsLoading(false);
        setSendModalOpen(false);
      }
  }
  
  const handleApproveStep = async (docId: number) => {
    setIsLoading(true);
    try {
        const updatedDoc = await api.approveDocumentStep(docId);
        setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
        const clientUser = users.find(u => u.clientIds?.includes(updatedDoc.clientId));
        if(clientUser) {
            addNotification({
                userId: clientUser.id,
                message: `Sua solicitação "${updatedDoc.name}" foi aprovada. Por favor, complete a próxima etapa.`
            })
        }
    } catch (error) {
        console.error("Failed to approve step:", error);
    } finally {
        setIsLoading(false);
        setDetailsModalOpen(false);
    }
  };

  const handleSignDocument = async (docToSign: Document) => {
    if (!docToSign.file?.content || !currentUser) return;
    setIsLoading(true);
    try {
        const existingPdfBytes = Uint8Array.from(atob(docToSign.file.content.split(',')[1]), c => c.charCodeAt(0));
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        const signatureDate = new Date();
        const signatureText = `Assinado digitalmente por: ${currentUser.name}\nData: ${signatureDate.toLocaleString('pt-BR')}`;
        lastPage.drawText(signatureText, { x: 50, y: 50, font: helveticaFont, size: 10, color: rgb(0.2, 0.2, 0.2) });
        const pdfBytes = await pdfDoc.save();
        const newPdfBase64 = `data:application/pdf;base64,${uint8ArrayToBase64(pdfBytes)}`;
        const newSignature: Omit<Signature, 'id' | 'documentId'> = {
            userId: currentUser.id, date: signatureDate.toISOString(), signatureId: `SIG-${Date.now()}`,
            auditTrail: { ipAddress: 'captured_by_backend', userAgent: navigator.userAgent }
        };
        const updatedDoc = await api.signDocument(docToSign.id, newSignature, newPdfBase64);
        setDocuments(prev => prev.map(d => d.id === docToSign.id ? updatedDoc : d));
        users.filter(u => u.role.includes('Admin')).forEach(admin => {
            addNotification({ userId: admin.id, message: `${currentUser.name} assinou o documento: ${docToSign.name}.`});
        });
    } catch (error) {
        console.error("Failed to sign document:", error);
        alert("Ocorreu um erro ao assinar o documento.");
    } finally {
        setIsLoading(false);
        setDetailsModalOpen(false);
    }
};

const handleUpdateStatus = async (docId: number, status: DocumentStatus) => {
    setIsLoading(true);
    try {
        const updatedDoc = await api.updateDocumentStatus(docId, status);
        setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));
        setSelectedDocument(updatedDoc);
        const clientUser = users.find(u => u.clientIds?.includes(updatedDoc.clientId));
        if (clientUser) {
            addNotification({ userId: clientUser.id, message: `O status do seu documento "${updatedDoc.name}" foi atualizado para: ${formatDocumentStatus(status)}.`});
        }
    } catch (error) {
        console.error("Failed to update status", error);
    } finally {
        setIsLoading(false);
    }
};

  const filteredDocuments = selectedClientId === 'all'
    ? documents
    : documents.filter(doc => doc.clientId === selectedClientId);

  // --- SUB COMPONENTS --- //
  
  const AdminSendDocumentModal: React.FC<{isOpen: boolean, onClose: () => void}> = ({ isOpen, onClose }) => {
    const [clientId, setClientId] = useState((clients.find(c=>c.status === 'Ativo') || clients[0])?.id || 0);
    const [docName, setDocName] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [signatoryIds, setSignatoryIds] = useState<string[]>([]);
    
    const clientUsers = users.filter(u => u.clientIds?.includes(clientId) && u.role === 'Cliente');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!clientId || !docName || !file) {
            alert('Por favor, preencha todos os campos e selecione um arquivo.');
            return;
        }
        handleAdminSend({ clientId, docName, file, signatoryIds });
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
             <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-black">Enviar Documento ao Cliente</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Cliente</label>
                        <select value={clientId} onChange={e => { setClientId(Number(e.target.value)); setSignatoryIds([]); }} className="w-full p-2 border rounded mt-1">
                             {clients.filter(c => c.status === 'Ativo').map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nome do Documento</label>
                        <input value={docName} onChange={e => setDocName(e.target.value)} placeholder="Ex: Contrato Social Atualizado" className="w-full p-2 border rounded mt-1" required/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700">Arquivo (PDF para assinaturas)</label>
                        <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1" required/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Solicitar Assinatura de (opcional)</label>
                         <select multiple value={signatoryIds} onChange={e => setSignatoryIds(Array.from(e.target.selectedOptions, option => option.value))} className="w-full p-2 border rounded mt-1 h-24">
                             {clientUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Segure Ctrl (ou Cmd) para selecionar múltiplos.</p>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Enviar</button>
                </div>
            </form>
        </Modal>
    );
  };
  
  const DocumentRequestModal: React.FC<{isOpen: boolean, onClose: () => void}> = ({ isOpen, onClose }) => {
    const [requestText, setRequestText] = useState('');
    const [clientIdForRequest, setClientIdForRequest] = useState((clients.find(c=>c.status === 'Ativo') || clients[0])?.id || 0);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const data = isClient ? { requestText } : { clientId: clientIdForRequest, requestText };
        handleSaveRequest(data as any);
        setRequestText('');
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
             <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-black">Solicitar Documento (Outro)</h3>
                {!isClient && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Cliente</label>
                        <select value={clientIdForRequest} onChange={e => setClientIdForRequest(Number(e.target.value))} className="w-full p-2 border rounded mt-1">
                             {clients.filter(c => c.status === 'Ativo').map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label className="block text-sm font-medium text-gray-700">Descrição da Solicitação</label>
                    <textarea value={requestText} onChange={e => setRequestText(e.target.value)} placeholder={isClient ? "Ex: Preciso de uma cópia do meu contrato social." : "Ex: Documentos para fechamento fiscal de Fevereiro."} className="w-full p-2 border rounded mt-1" rows={3} required/>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Solicitar</button>
                </div>
            </form>
        </Modal>
    );
  };
  
   const DocumentDetailsModal: React.FC<{ isOpen: boolean; onClose: () => void; doc: Document | null }> = ({ isOpen, onClose, doc }) => {
    if(!doc) return null;
    const [newStatus, setNewStatus] = useState<DocumentStatus>(doc.status);
    const client = clients.find(c => c.id === doc.clientId);
    const canApprove = !isClient && doc.status === 'AguardandoAprovacao';
    const canGenerateAviso = (doc.templateId === 'rescisao-contrato') && client;
    const isPendingSignatory = doc.status === 'AguardandoAssinatura' && doc.requiredSignatories?.some(s => s.userId === currentUser.id && s.status === 'pendente');

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="md:col-span-2">
                    <h3 className="text-xl font-bold text-black mb-4">{doc.name}</h3>
                    <div className="space-y-2 text-sm mb-4 border-b pb-4">
                        <p><strong>Cliente:</strong> {client?.company || 'N/A'}</p>
                        <p><strong>Status:</strong> <span className="font-semibold">{formatDocumentStatus(doc.status)}</span></p>
                        <p><strong>Enviado por:</strong> {doc.uploadedBy} em {new Date(doc.uploadDate).toLocaleString('pt-BR')}</p>
                    </div>
                    
                    {doc.formData && (
                        <div className="my-4 p-4 bg-gray-50 rounded-lg border max-h-60 overflow-y-auto">
                           <h4 className="font-bold text-gray-800 mb-2">Dados do Formulário</h4>
                           <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                            {Object.entries(doc.formData).map(([key, value]) => {
                                 const templateField = [...(ADMISSION_TEMPLATE.fields || []), ...(TERMINATION_TEMPLATE.fields || []), ...(AVISO_FERIAS_TEMPLATE.fields || [])].find(f => f.id === key);
                                 if (key === 'children' && Array.isArray(value) && value.length > 0) {
                                    return (
                                        <div key={key} className="sm:col-span-2">
                                            <dt className="font-medium text-gray-600">Filhos</dt>
                                            {value.map((child, index) => <dd key={index} className="text-gray-800 pl-2">{`#${index+1}: ${child.name}, CPF: ${child.cpf}`}</dd>)}
                                        </div>
                                    )
                                 }
                                 if(typeof value === 'boolean') return <div key={key}><dt className="font-medium text-gray-600">{templateField?.label || key}</dt><dd className="text-gray-800">{value ? 'Sim' : 'Não'}</dd></div>;
                                 if(!value) return null;
                                 return <div key={key}><dt className="font-medium text-gray-600">{templateField?.label || key}</dt><dd className="text-gray-800">{String(value)}</dd></div>;
                            })}
                           </dl>
                        </div>
                    )}

                    {doc.file && (
                    <div className="my-4">
                        <button onClick={() => downloadFileFromBase64(doc.file!.content, doc.file!.name)} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
                            <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-5 h-5 mr-2"/>
                            Baixar Arquivo ({doc.file.name})
                        </button>
                    </div>
                    )}

                    {doc.requiredSignatories?.length > 0 && (
                        <div className="my-4 p-4 bg-gray-50 rounded-lg border">
                            <h4 className="font-bold text-gray-800 mb-2">Status das Assinaturas</h4>
                            <ul className="space-y-2">
                            {doc.requiredSignatories.map(sig => (
                                <li key={sig.userId} className="flex items-center justify-between text-sm">
                                    <span>{sig.name}</span>
                                    {sig.status === 'assinado' ? 
                                    <span className="flex items-center font-semibold text-green-600"><Icon path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" className="w-4 h-4 mr-1"/> Assinado</span> :
                                    <span className="font-semibold text-yellow-600">Pendente</span>
                                    }
                                </li>
                            ))}
                            </ul>
                        </div>
                    )}
                    
                    {isPendingSignatory && (
                        <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
                            <h4 className="font-bold text-yellow-800">Ação Requerida</h4>
                            <p className="text-sm text-yellow-700 mt-1 mb-3">Sua assinatura é necessária.</p>
                            <button onClick={() => handleSignDocument(doc)} className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">Assinar</button>
                        </div>
                    )}

                    {canApprove && (
                        <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <h4 className="font-bold text-yellow-800">Ação Requerida</h4>
                            <p className="text-sm text-yellow-700 mt-1">Revise os dados e aprove para que o cliente possa enviar o documento final.</p>
                            <button onClick={() => handleApproveStep(doc.id)} className="mt-3 bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">Aprovar para Próxima Etapa</button>
                        </div>
                    )}
                 </div>
                 <div className="md:col-span-1 p-4 bg-gray-50 rounded-lg">
                     <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">Ações & Histórico</h4>
                     {!isClient && (
                         <div className="mb-4">
                             <label className="block text-sm font-medium text-gray-700">Alterar Status</label>
                             <div className="flex items-center space-x-2 mt-1">
                                <select value={newStatus} onChange={e => setNewStatus(e.target.value as DocumentStatus)} className="w-full p-2 border rounded-md">
                                    <option value="Pendente">Pendente</option>
                                    <option value="Recebido">Recebido</option>
                                    <option value="Revisado">Revisado</option>
                                    <option value="Concluido">Concluído</option>
                                </select>
                                <button onClick={() => handleUpdateStatus(doc.id, newStatus)} disabled={newStatus === doc.status} className="bg-primary text-white p-2 rounded-md disabled:opacity-50">
                                    <Icon path="M5 13l4 4L19 7" className="w-5 h-5"/>
                                </button>
                             </div>
                         </div>
                     )}

                     <div className="space-y-3 max-h-60 overflow-y-auto">
                        {doc.auditLog?.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(log => (
                           <div key={log.id} className="text-xs">
                               <p className="font-semibold text-gray-700">{log.action}</p>
                               <p className="text-gray-500">{log.user} em {new Date(log.date).toLocaleString('pt-BR')}</p>
                           </div>
                        ))}
                     </div>
                 </div>

                 <div className="md:col-span-3 mt-6 flex justify-end space-x-3 border-t pt-4">
                    {canGenerateAviso && client && (
                         <button type="button" onClick={() => generateAvisoPrevioPdf(doc, client).save(`aviso_previo_${doc.formData?.nome_funcionario_rescisao?.replace(/\s/g, '_')}.pdf`)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Gerar Aviso Prévio</button>
                    )}
                    <button type="button" onClick={() => downloadReceiptAsPdf(doc, client?.name)} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Gerar Recibo</button>
                    <button type="button" onClick={onClose} className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Fechar</button>
                 </div>
            </div>
        </Modal>
    )
  }
  
  const DocumentTable: React.FC<{title: string, docs: Document[]}> = ({ title, docs }) => {
    const getStatusClass = (status: DocumentStatus) => {
        const classes: Partial<Record<DocumentStatus, string>> = {
            'Pendente': 'bg-yellow-100 text-yellow-800', 'Recebido': 'bg-blue-100 text-blue-800',
            'Revisado': 'bg-indigo-100 text-indigo-800', 'AguardandoAprovacao': 'bg-purple-100 text-purple-800',
            'AguardandoAssinatura': 'bg-purple-100 text-purple-800', 'Concluido': 'bg-green-100 text-green-800',
            'PendenteEtapa2': 'bg-yellow-200 text-yellow-900',
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="mb-8">
            <h3 className="text-2xl font-bold text-black mb-4">{title}</h3>
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <table className="min-w-full leading-normal">
                    <thead>
                        <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                            <th className="px-5 py-3">Documento</th>
                            <th className="px-5 py-3">Cliente</th>
                            <th className="px-5 py-3">Data</th>
                            <th className="px-5 py-3">Status</th>
                            <th className="px-5 py-3">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {docs.map(doc => {
                            const client = clients.find(c => c.id === doc.clientId);
                            return (
                                <tr key={doc.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="px-5 py-5 text-sm"><p className="text-black font-semibold whitespace-no-wrap">{doc.name}</p></td>
                                    <td className="px-5 py-5 text-sm text-black">{client?.company || 'N/A'}</td>
                                    <td className="px-5 py-5 text-sm text-black">{new Date(doc.uploadDate).toLocaleDateString('pt-BR')}</td>
                                    <td className="px-5 py-5 text-sm"><span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${getStatusClass(doc.status)}`}>{formatDocumentStatus(doc.status)}</span></td>
                                    <td className="px-5 py-5 text-sm"><button onClick={() => handleOpenDetails(doc)} className="text-primary hover:underline">Ver Detalhes</button></td>
                                </tr>
                            )
                        })}
                        {docs.length === 0 && (
                            <tr><td colSpan={5} className="text-center py-10 text-gray-500">Nenhum documento encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
  };
  
  const AdminView: React.FC = () => {
    const docsFromClients = filteredDocuments.filter(d => d.source === 'cliente').sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    const docsFromOffice = filteredDocuments.filter(d => d.source === 'escritorio').sort((a,b) => new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    
    return (
        <div>
            <DocumentTable title="Documentos Enviados por Clientes" docs={docsFromClients} />
            <DocumentTable title="Documentos Enviados pelo Escritório" docs={docsFromOffice} />
        </div>
    );
  };
  
  const DocumentList: React.FC<{ title: string; docs: Document[]; onDocClick: (doc: Document) => void, emptyText: string, iconColor?: string, onActionClick?: (doc: Document) => void, actionText?: string }> = 
  ({ title, docs, onDocClick, emptyText, iconColor="text-primary", onActionClick, actionText }) => (
    <div>
        <h3 className="text-xl font-bold text-black mb-4">{title}</h3>
        {docs.length > 0 ? (
            <ul className="space-y-3 bg-white p-4 rounded-lg shadow">
                {docs.map(doc => (
                    <li key={doc.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-all duration-200">
                        <div onClick={() => onDocClick(doc)} className="flex items-center min-w-0 cursor-pointer flex-1">
                            <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className={`w-8 h-8 ${iconColor} mr-4 flex-shrink-0`} />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-black truncate">{doc.name}</p>
                                <p className="text-xs text-gray-500">{new Date(doc.uploadDate).toLocaleDateString('pt-BR')} - {formatDocumentStatus(doc.status)}</p>
                            </div>
                        </div>
                        {onActionClick && actionText && doc.status === 'PendenteEtapa2' && (
                            <button onClick={() => onActionClick(doc)} className="ml-4 flex-shrink-0 bg-green-500 text-white font-bold text-xs py-1 px-3 rounded-lg hover:bg-green-600 transition-colors">{actionText}</button>
                        )}
                        <Icon path="M9 5l7 7-7 7" className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
                    </li>
                ))}
            </ul>
        ) : (
            <div className="text-center py-6 bg-white p-4 rounded-lg shadow">
                <p className="text-sm text-gray-500">{emptyText}</p>
            </div>
        )}
    </div>
  );
  
  const ClientView: React.FC = () => {
    const statusPriority = (status: DocumentStatus): number => {
        switch (status) {
            case 'AguardandoAssinatura':
            case 'PendenteEtapa2': return 0; // Highest priority
            case 'AguardandoAprovacao': return 1;
            case 'Pendente': return 2;
            case 'Recebido':
            case 'Revisado': return 3;
            case 'Concluido': return 4; // Lowest priority
            default: return 5;
        }
    };

    const docsFromOffice = filteredDocuments
        .filter(d => d.source === 'escritorio')
        .sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());

    const docsFromClient = filteredDocuments
        .filter(d => d.source === 'cliente')
        .sort((a, b) => statusPriority(a.status) - statusPriority(b.status) || new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime());
    
    return (
        <div className="space-y-8">
            <div className="flex space-x-4">
                <button onClick={() => setSelectionModalOpen({isOpen: true, type: 'send'})} className="flex-1 flex flex-col items-center justify-center p-6 bg-primary text-white rounded-lg shadow-lg hover:bg-primary-dark transition-transform transform hover:-translate-y-1">
                    <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-10 h-10 mb-2"/>
                    <span className="font-bold text-lg">Enviar Documento</span>
                </button>
                 <button onClick={() => setSelectionModalOpen({isOpen: true, type: 'request'})} className="flex-1 flex flex-col items-center justify-center p-6 bg-white text-primary rounded-lg shadow-lg hover:bg-gray-50 transition-transform transform hover:-translate-y-1 border">
                    <Icon path="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4c0-.994.368-1.912.984-2.623" className="w-10 h-10 mb-2"/>
                    <span className="font-bold text-lg">Solicitar Documento</span>
                </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <DocumentList 
                    title="Recebidos do Escritório" 
                    docs={docsFromOffice} 
                    onDocClick={handleOpenDetails}
                    emptyText="Nenhum documento recebido do escritório."
                    iconColor="text-blue-500"
                />
                <DocumentList 
                    title="Seus Envios e Solicitações" 
                    docs={docsFromClient} 
                    onDocClick={handleOpenDetails}
                    onActionClick={handleOpenForEditing}
                    actionText="Continuar"
                    emptyText="Você ainda não enviou ou solicitou documentos."
                    iconColor="text-green-500"
                />
            </div>
        </div>
    );
  };
  
   const DocumentTemplateForm: React.FC<{ template: DocumentTemplate, onSave: (data: any, file?: File | null) => void, onCancel: () => void, initialData?: Record<string, any>, initialStep?: number }> = 
   ({ template, onSave, onCancel, initialData = {}, initialStep = 1 }) => {
    const [formData, setFormData] = useState<Record<string, any>>(initialData);
    const [file, setFile] = useState<File | null>(null);
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [children, setChildren] = useState<any[]>(initialData?.children || []);

    const handleChildChange = (index: number, field: string, value: string) => {
        const newChildren = [...children];
        newChildren[index] = { ...newChildren[index], [field]: value };
        setChildren(newChildren);
    };
    const addChild = () => setChildren([...children, { name: '', cpf: '', dob: '', sexo: '' }]);
    const removeChild = (index: number) => setChildren(children.filter((_, i) => i !== index));
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const checked = (e.target as HTMLInputElement).checked;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave({ ...formData, children: formData.possui_filhos ? children : [] }, file);
    };

    const fieldsForStep = template.fields?.filter(f => !f.step || f.step === currentStep);

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <h3 className="text-xl font-bold text-black">{template.name}</h3>
            {template.steps && <p className="font-semibold text-gray-600">{template.steps[currentStep-1].title}</p>}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {fieldsForStep?.map(field => {
                    if(field.id === 'possui_filhos' && template.id === 'admissao-funcionario') {
                        return (
                            <div key={field.id} className="md:col-span-2">
                                <label className="flex items-center"><input type="checkbox" name={field.id} checked={!!formData[field.id]} onChange={handleChange} className="h-4 w-4 rounded text-primary"/> <span className="ml-2">{field.label}</span></label>
                            </div>
                        )
                    }
                    if(field.id.startsWith('carteira_trabalho') && formData['carteira_trabalho_digital'] && field.id !== 'carteira_trabalho_digital') return null;
                    if(field.id === 'dias_experiencia' && formData['contrato_experiencia'] !== 'Sim') return null;

                    return (
                        <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                            <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">{field.label}{field.required && ' *'}</label>
                            { field.type === 'textarea' ? <textarea name={field.id} id={field.id} value={formData[field.id] || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" rows={3}/>
                            : field.type === 'select' ? <select name={field.id} id={field.id} value={formData[field.id] || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1">{field.options?.map(o => <option key={o} value={o}>{o}</option>)}</select>
                            : <input type={field.type} name={field.id} id={field.id} value={formData[field.id] || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" required={field.required}/> }
                            {field.description && <p className="text-xs text-gray-500 mt-1">{field.description}</p>}
                        </div>
                    )
                })}
            </div>
            
            {formData['possui_filhos'] && template.id === 'admissao-funcionario' && (
                <div className="md:col-span-2 border-t pt-4">
                    <h4 className="font-semibold mb-2">Dados dos Filhos</h4>
                    {children.map((child, index) => (
                        <div key={index} className="grid grid-cols-5 gap-2 mb-2 p-2 border rounded bg-gray-50 items-center">
                            <input value={child.name} onChange={e => handleChildChange(index, 'name', e.target.value)} placeholder="Nome" className="col-span-2 p-1 border rounded"/>
                            <input value={child.cpf} onChange={e => handleChildChange(index, 'cpf', e.target.value)} placeholder="CPF" className="p-1 border rounded"/>
                            <input type="date" value={child.dob} onChange={e => handleChildChange(index, 'dob', e.target.value)} placeholder="Nascimento" className="p-1 border rounded"/>
                            <button type="button" onClick={() => removeChild(index)} className="text-red-500"><Icon path="M6 18L18 6M6 6l12 12" className="w-5 h-5"/></button>
                        </div>
                    ))}
                    <button type="button" onClick={addChild} className="text-sm text-primary">+ Adicionar Filho</button>
                </div>
            )}

            {template.fileConfig && (!template.steps || currentStep === template.steps.length) && (
                 <div className="md:col-span-2 border-t pt-4">
                    <label className="block text-sm font-medium text-gray-700">Anexar Documento(s) {template.fileConfig.isRequired && '*'}</label>
                    <input type="file" onChange={handleFileChange} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1" accept={template.fileConfig.acceptedTypes} required={template.fileConfig.isRequired && !editingDocument}/>
                </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
              <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
              <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">
                {template.id === 'rescisao-contrato' && currentStep === 1 ? 'Gerar Aviso Prévio e Enviar p/ Aprovação' : (template.steps ? (currentStep < template.steps.length ? 'Próxima Etapa' : 'Enviar') : 'Enviar')}
              </button>
            </div>
        </form>
    );
  };

  const handleSaveFromTemplate = async (formData: any, attachedFile: File | null) => {
    if (!selectedTemplate || !activeClientId) return;
    setIsLoading(true);
    try {
        let filePayload = null;
        if (attachedFile) {
            const base64 = await fileToBase64(attachedFile);
            filePayload = { name: attachedFile.name, type: attachedFile.type, content: base64 };
        }
        
        if (editingDocument) {
            // Updating an existing multi-step document
            const updatedDoc = await api.updateDocumentFromTemplate(editingDocument.id, selectedTemplate, { formData, file: filePayload });
            setDocuments(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
            addNotification({ userId: null, message: `${currentUser.name} completou a etapa 2 de "${updatedDoc.name}".`});
        } else {
            // Creating a new document
            const newDoc = await api.createDocumentFromTemplate({ template: selectedTemplate, clientId: activeClientId, uploadedBy: currentUser.name, formData, file: filePayload });
            setDocuments(prev => [newDoc, ...prev]);
            
            if (taskToComplete) {
                const updatedTask = await api.updateTaskStatus(taskToComplete.id, 'Concluida');
                setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
            }

            if (selectedTemplate.id === 'rescisao-contrato') {
                const client = clients.find(c => c.id === activeClientId);
                if(client) {
                   const pdf = generateAvisoPrevioPdf(newDoc, client);
                   pdf.save(`aviso_previo_${formData.nome_funcionario_rescisao?.replace(/\s/g, '_')}.pdf`);
                }
            }

            users.filter(u => u.role.includes('Admin')).forEach(admin => {
                addNotification({ userId: admin.id, message: `${currentUser.name} enviou um novo documento: ${newDoc.name}`});
            });
        }
    } catch (error) {
        console.error("Failed to save from template", error);
    } finally {
        setIsLoading(false);
        setTemplateModalOpen(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-black">Gestão de Documentos</h2>
        {!isClient && (
            <div className="flex items-center space-x-2">
                 <select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="p-2 border rounded">
                    <option value="all">Todos os Clientes</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                </select>
                <button onClick={() => setSelectionModalOpen({ isOpen: true, type: 'request' })} className="flex items-center bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600">
                    <Icon path="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4c0-.994.368-1.912.984-2.623" className="w-5 h-5 mr-2" />
                    Solicitar Documento
                </button>
                <button onClick={() => setSendModalOpen(true)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark">
                    <Icon path="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" className="w-5 h-5 mr-2" />
                    Enviar ao Cliente
                </button>
            </div>
        )}
      </div>
      
      {isClient ? <ClientView /> : <AdminView />}
      
      <AdminSendDocumentModal isOpen={isSendModalOpen} onClose={() => setSendModalOpen(false)} />
      <DocumentRequestModal isOpen={isRequestModalOpen} onClose={() => setRequestModalOpen(false)} />
      <DocumentDetailsModal isOpen={isDetailsModalOpen} onClose={() => setDetailsModalOpen(false)} doc={selectedDocument} />
      <DocumentRequestSelectionModal 
        isOpen={isSelectionModalOpen.isOpen} 
        onClose={() => setSelectionModalOpen({isOpen: false, type: 'send'})} 
        onSelect={handleSelection} 
        title={isSelectionModalOpen.type === 'send' ? 'Enviar Documento' : 'Solicitar Documento'}
      />
      {selectedTemplate && (
          <Modal isOpen={isTemplateModalOpen} onClose={() => setTemplateModalOpen(false)} size="lg">
            <DocumentTemplateForm 
                template={selectedTemplate}
                onSave={handleSaveFromTemplate}
                onCancel={() => setTemplateModalOpen(false)}
                initialData={initialFormData || {}}
                initialStep={editingDocument?.workflow?.currentStep === 1 ? 2 : 1}
            />
          </Modal>
      )}

    </div>
  );
};

export default DocumentView;