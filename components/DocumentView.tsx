import React, { useState, useEffect } from 'react';
import { Document, User, Client, AppNotification, DocumentStatus, DocumentTemplate, DocumentTemplateField, RequiredSignatory, Signature, Task, Employee } from '../types';
import Icon from './Icon';
import Modal from './Modal';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as api from '../services/api';
import DocumentRequestSelectionModal from './DocumentRequestSelectionModal';


interface DocumentViewProps {
  documents: Document[];
  setDocuments: React.Dispatch<React.SetStateAction<Document[]>>;
  currentUser: User;
  clients: Client[];
  users: User[];
  addNotification: (notification: Omit<AppNotification, 'id' | 'date' | 'read'>) => void;
  documentTemplates: DocumentTemplate[];
  directAction: { type: string, payload: any } | null;
  setDirectAction: (action: { type: string, payload: any } | null) => void;
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
            ['Status', docData.status],
        ],
        theme: 'striped'
    });
    
    doc.save(`recibo_${docData.id}.pdf`);
};

const generateAvisoPrevioPdf = (docData: Document, client: Client, employeeName?: string) => {
    const doc = new jsPDF();
    const {
        data_aviso_previo: noticeDate,
        motivo_rescisao: reason,
        tipo_aviso_previo: noticeType
    } = docData.formData || {};
    
    const finalEmployeeName = employeeName || docData.formData?.nome_funcionario_rescisao || '[Nome do Funcionário]';

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('AVISO PRÉVIO DO EMPREGADOR', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
    
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    doc.text(`À`, 20, 40);
    doc.text(`Sr(a). ${finalEmployeeName}`, 20, 45);

    const bodyText = `
Pela presente, comunicamos que, a partir de ${noticeDate ? new Date(noticeDate).toLocaleDateString('pt-BR', {timeZone: 'UTC'}) : '[Data do Aviso]'}, não serão mais necessários os seus serviços em nossa empresa, ${client.company}.

O motivo desta rescisão é: ${reason || '[Motivo]'}.

Seu aviso prévio será na modalidade: ${noticeType || '[Tipo]'}.

Solicitamos a sua apresentação ao departamento de Recursos Humanos para as devidas providências.

Atenciosamente,
`;
    doc.text(bodyText, 20, 60, { maxWidth: 170 });

    doc.text('________________________________', 20, 150);
    doc.text(client.company, 20, 155);

    doc.text('________________________________', 20, 170);
    doc.text(finalEmployeeName, 20, 175);
    doc.text('Ciente em: _____/_____/______', 20, 180);

    doc.save(`aviso_previo_${finalEmployeeName.replace(/ /g, '_')}.pdf`);
};


// --- Main Component ---
const DocumentView: React.FC<DocumentViewProps> = ({ documents, setDocuments, currentUser, clients, users, addNotification, documentTemplates, directAction, setDirectAction, setTasks, activeClientId, setIsLoading, employees, handleInactivateEmployee }) => {
  const isClient = currentUser.role === 'Cliente';
  const [selectedClientId, setSelectedClientId] = useState<number | 'all'>(isClient ? activeClientId! : 'all');
  const [isTemplateModalOpen, setTemplateModalOpen] = useState(false);
  const [isRequestModalOpen, setRequestModalOpen] = useState(false);
  const [isRequestSelectionModalOpen, setRequestSelectionModalOpen] = useState(false);
  const [isSendSelectionModalOpen, setIsSendSelectionModalOpen] = useState(false);
  const [isSimpleSendModalOpen, setIsSimpleSendModalOpen] = useState(false);
  const [simpleSendData, setSimpleSendData] = useState<{ name: string } | null>(null);
  const [isSendModalOpen, setSendModalOpen] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [editingDocument, setEditingDocument] = useState<Document | null>(null);
  const [taskToComplete, setTaskToComplete] = useState<Task | null>(null);
  const [preselectedRequestName, setPreselectedRequestName] = useState<string>('');

  const employeesForClient = employees.filter(e => e.clientId === activeClientId);

  useEffect(() => {
    if (isClient && activeClientId) {
      setSelectedClientId(activeClientId);
    }
  }, [activeClientId, isClient]);

   useEffect(() => {
    if (directAction?.type === 'OPEN_DOC_MODAL') {
      const { templateId, task } = directAction.payload;
      const template = documentTemplates.find(t => t.id === templateId);
      if (template) {
        setTaskToComplete(task);
        setEditingDocument(null); // Ensure it's a new doc
        setTemplateModalOpen(true);
      }
      setDirectAction(null); // Reset the action
    }
  }, [directAction, documentTemplates, setDirectAction]);


  const handleOpenDetails = (doc: Document) => {
    setSelectedDocument(doc);
    setDetailsModalOpen(true);
  };
  
   const handleOpenForEditing = (doc: Document) => {
    setEditingDocument(doc);
    setTemplateModalOpen(true);
  };

  const handleSaveRequest = async (data: { clientId?: number; requestText: string, description?: string, file?: any }) => {
    setIsLoading(true);
    try {
        const targetClientId = isClient ? activeClientId! : data.clientId!;
        let fileData = null;
        if (data.file) {
            const content = await fileToBase64(data.file);
            fileData = { name: data.file.name, type: data.file.type, content };
        }

        const newDoc = await api.createDocumentRequest(targetClientId, data.requestText, currentUser.name, isClient ? 'cliente' : 'escritorio', data.description, fileData);
        setDocuments(prev => [newDoc, ...prev]);
        
        const notificationTarget = isClient 
            ? users.filter(u => u.role.includes('Admin')) 
            : users.filter(u => u.clientIds?.includes(targetClientId));

        notificationTarget.forEach(user => {
            addNotification({
                userId: user.id,
                message: `${currentUser.name} ${isClient ? 'solicitou' : 'criou uma pendência para'}: ${data.requestText}`
            });
        });

    } catch (error) {
        console.error("Failed to save document request:", error);
    } finally {
        setIsLoading(false);
        setRequestModalOpen(false);
        setRequestSelectionModalOpen(false);
    }
  };

  const handleAdminSend = async (data: { clientId: number; docName: string; file: File, signatoryIds: string[] }) => {
      setIsLoading(true);
      try {
        const fileContent = await fileToBase64(data.file);
        const newDoc = await api.sendDocumentFromAdmin(data, fileContent, currentUser.name);
        setDocuments(prev => [newDoc, ...prev]);

        const clientUser = users.find(u => u.clientIds?.includes(data.clientId));
        if(clientUser) {
            const message = newDoc.requiredSignatories && newDoc.requiredSignatories.length > 0
                ? `Novo documento para assinar: ${data.docName}`
                : `O escritório enviou um novo documento: ${data.docName}`;
            addNotification({ userId: clientUser.id, message });

            newDoc.requiredSignatories?.filter(sig => sig.userId !== clientUser.id).forEach(sig => {
                addNotification({ userId: sig.userId, message: `Você foi solicitado a assinar o documento: ${data.docName}` });
            });
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
        const signatureId = `SIG-${Date.now()}`;
        const signatureDate = new Date();

        const newSignature: Signature = {
            userId: currentUser.id,
            name: currentUser.name,
            date: signatureDate.toISOString(),
            signatureId: signatureId,
            auditTrail: {
                ipAddress: '192.168.1.1', // This should be captured by the backend
                userAgent: navigator.userAgent,
                screenResolution: `${window.screen.width}x${window.screen.height}`
            }
        };

        const updatedDoc = await api.signDocument(docToSign.id, newSignature, docToSign.file.content);
        setDocuments(prev => prev.map(d => d.id === docToSign.id ? updatedDoc : d));
        
        users.filter(u => u.role.includes('Admin')).forEach(admin => {
            addNotification({
                userId: admin.id,
                message: `${currentUser.name} assinou o documento: ${docToSign.name}.`
            });
        });

    } catch (error) {
        console.error("Failed to sign document:", error);
        alert("Ocorreu um erro ao assinar o documento. O arquivo pode não ser um PDF válido.");
    } finally {
        setIsLoading(false);
        setDetailsModalOpen(false);
    }
  };

  const handleSendSelection = (docName: string) => {
    setIsSendSelectionModalOpen(false);

    const formDocMapping: { [key: string]: string } = {
        'Admissão de Funcionários': 'admissao-funcionario',
        'Rescisão de Contrato de Funcionário': 'rescisao-contrato'
    };

    let templateId: string | undefined = formDocMapping[docName];
    if (!templateId) {
        const template = documentTemplates.find(t => t.name === docName);
        if (template) templateId = template.id;
    }
    
    if (templateId) {
        setDirectAction({ type: 'OPEN_DOC_MODAL', payload: { templateId, task: null } });
    } else {
        setSimpleSendData({ name: docName });
        setIsSimpleSendModalOpen(true);
    }
  };
  
  const handleSimpleSend = async (file: File, description: string) => {
    if (!simpleSendData || !activeClientId) return;
    
    setIsLoading(true);
    setIsSimpleSendModalOpen(false);

    try {
        const fileContent = await fileToBase64(file);
        const docData = {
            clientId: activeClientId,
            name: simpleSendData.name,
            description,
            file: {
                name: file.name,
                type: file.type,
                content: fileContent
            },
            uploadedBy: currentUser.name
        };
        const newDoc = await api.createSimpleDocument(docData);
        setDocuments(prev => [newDoc, ...prev]);

        users.filter(u => u.role.includes('Admin')).forEach(admin => {
            addNotification({
                userId: admin.id,
                message: `${currentUser.name} enviou um novo documento: ${newDoc.name}`
            });
        });
        
    } catch (error) {
        console.error("Failed to send simple document", error);
    } finally {
        setIsLoading(false);
        setSimpleSendData(null);
    }
  };

  const filteredDocuments = selectedClientId === 'all'
    ? documents
    : documents.filter(doc => doc.clientId === selectedClientId);

  // --- SUB COMPONENTS --- //
  
    const DocumentTemplateForm: React.FC<{ template: DocumentTemplate, onSave: (data: any) => void, onCancel: () => void, initialData?: Record<string, any>, initialStep?: number, client?: Client, employees: Employee[] }> = ({ template, onSave, onCancel, initialData = {}, initialStep = 1, client, employees }) => {
    const [formData, setFormData] = useState<Record<string, any>>(initialData);
    const [files, setFiles] = useState<Record<string, File>>({});
    const [currentStep, setCurrentStep] = useState(initialStep);
    const [children, setChildren] = useState<any[]>(initialData?.children || []);

    const activeEmployees = employees.filter(e => e.status === 'Ativo');

    const handleChildChange = (index: number, field: string, value: string) => {
        const newChildren = [...children];
        newChildren[index] = { ...newChildren[index], [field]: value };
        setChildren(newChildren);
    };

    const addChild = () => {
        setChildren([...children, { name: '', cpf: '', dob: '' }]);
    };

    const removeChild = (index: number) => {
        setChildren(children.filter((_, i) => i !== index));
    };
  
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldId: string) => {
      if (e.target.files?.[0]) {
        setFiles(prev => ({...prev, [fieldId]: e.target.files![0]}));
      }
    };
  
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      
      const fieldsForCurrentStep = template.steps ? template.fields.filter(f => f.step === currentStep) : template.fields;
      for (const field of fieldsForCurrentStep) {
          let isFieldRequired = field.required;
          if (field.id === 'carteira_trabalho_numero' && !formData['carteira_trabalho_digital']) {
              isFieldRequired = true;
          }
          
          if (isFieldRequired && !formData[field.id] && field.type !== 'checkbox' && field.type !== 'file' && !editingDocument) {
              alert(`O campo "${field.label}" é obrigatório.`);
              return;
          }
          if (isFieldRequired && field.type === 'file' && !files[field.id] && !editingDocument) { // Allow editing without re-uploading
              alert(`O anexo para "${field.label}" é obrigatório.`);
              return;
          }
      }
      
      if (formData['possui_filhos'] && children.length === 0) {
          alert('Você marcou que possui filhos, por favor, adicione as informações de pelo menos um filho.');
          return;
      }
      for (const child of children) {
          if (!child.name || !child.cpf || !child.dob) {
              alert('Por favor, preencha todos os dados para cada filho adicionado.');
              return;
          }
      }

      const isIntermediateSubmitStep = template.id === 'rescisao-contrato' && currentStep === 1;

      if (isIntermediateSubmitStep && client) {
          const employeeId = Number(formData.nome_funcionario_rescisao);
          const employee = employees.find(e => e.id === employeeId);
          const tempDocDataForPdf: Document = {
              formData,
              id: 0,
              clientId: client.id,
              name: template.name,
              type: 'Formulário',
              uploadDate: new Date().toISOString(),
              uploadedBy: currentUser.name,
              source: 'cliente',
              status: 'Aguardando Aprovação'
          };
          generateAvisoPrevioPdf(tempDocDataForPdf, client, employee?.name);
      }
      
      const fileDataPromises = Object.entries(files).map(async ([fieldId, file]) => {
          const content = await fileToBase64(file);
          return { fieldId, data: { name: file.name, type: file.type, content } };
      });
      const resolvedFiles = await Promise.all(fileDataPromises);
      
      let mainFile: any = null;
      let fieldFilesData: Record<string, any> = {};

      resolvedFiles.forEach(({fieldId, data}) => {
        if(fieldId === '__mainFile') {
          mainFile = data;
        } else {
          fieldFilesData[fieldId] = data;
        }
      });
      
      const finalFormData = {...formData, ...fieldFilesData, children};

      onSave({ formData: finalFormData, file: mainFile });
    };

    const renderField = (field: DocumentTemplateField) => {
        if (field.id === 'carteira_trabalho_numero' && formData['carteira_trabalho_digital']) {
            return null;
        }
        
        const commonProps = {
            id: field.id,
            name: field.id,
            required: field.id === 'carteira_trabalho_numero' && !formData['carteira_trabalho_digital'] ? true : field.required,
            className: "w-full p-2 border rounded mt-1",
            value: formData[field.id] || '',
            onChange: (e: React.ChangeEvent<any>) => setFormData(prev => ({...prev, [field.id]: e.target.type === 'checkbox' ? e.target.checked : e.target.value}))
        };
        
        const isTextArea = field.type === 'textarea';

        return (
            <div key={field.id} className={isTextArea || field.id === 'local_moradia' ? "md:col-span-2" : ""}>
                <label htmlFor={field.id} className="block text-sm font-medium text-gray-700">{field.label}{commonProps.required && ' *'}</label>
                {field.description && <p className="text-xs text-gray-500">{field.description}</p>}
                
                {isTextArea && <textarea {...commonProps} rows={3}></textarea>}
                {field.type === 'select' && (
                    <select {...commonProps}>
                        <option value="">Selecione</option>
                        {field.id === 'nome_funcionario_rescisao' 
                            ? activeEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)
                            : field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)
                        }
                    </select>
                )}
                {field.type === 'checkbox' && <input {...commonProps} type="checkbox" checked={!!formData[field.id]} className="h-4 w-4 rounded text-primary focus:ring-primary border-gray-300"/>}
                {(field.type === 'text' || field.type === 'number' || field.type === 'date') && <input {...commonProps} type={field.type} />}
                {field.type === 'file' && (
                     <input 
                        type="file" 
                        id={field.id} 
                        name={field.id}
                        required={field.required && !editingDocument}
                        accept={field.acceptedTypes}
                        onChange={(e) => handleFileChange(e, field.id)}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20"
                    />
                )}
            </div>
        );
    };
    
    const fieldsForStep = template.steps ? template.fields.filter(f => f.step === currentStep) : template.fields;
    const isLastStep = !template.steps || currentStep === template.steps.length;
    const isIntermediateSubmitStep = template.id === 'rescisao-contrato' && currentStep === 1;
    
    return (
        <form onSubmit={handleSubmit}>
            {template.steps && (
                <div className="mb-6 text-center">
                    <h4 className="font-bold text-lg text-black">{template.steps[currentStep-1].title}</h4>
                    <p className="text-sm text-gray-500">Etapa {currentStep} de {template.steps.length}</p>
                </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {fieldsForStep.map(renderField)}
            </div>
            
            {template.id === 'admissao-funcionario' && formData['possui_filhos'] && (
                <div className="mt-6 pt-4 border-t md:col-span-2">
                    <h4 className="font-semibold text-lg mb-2 text-gray-800">Informações dos Filhos</h4>
                    {children.map((child, index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center mb-4 p-3 bg-gray-50 rounded-lg">
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium text-gray-700">Nome Completo *</label>
                                <input type="text" value={child.name} onChange={e => handleChildChange(index, 'name', e.target.value)} className="w-full p-2 border rounded mt-1" required/>
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium text-gray-700">CPF *</label>
                                <input type="text" value={child.cpf} onChange={e => handleChildChange(index, 'cpf', e.target.value)} className="w-full p-2 border rounded mt-1" required/>
                            </div>
                            <div className="md:col-span-1">
                                <label className="text-sm font-medium text-gray-700">Data de Nasc. *</label>
                                <input type="date" value={child.dob} onChange={e => handleChildChange(index, 'dob', e.target.value)} className="w-full p-2 border rounded mt-1" required/>
                            </div>
                            <div className="md:col-span-1 flex items-end">
                                <button type="button" onClick={() => removeChild(index)} className="bg-red-500 text-white font-bold py-2 px-3 rounded-lg hover:bg-red-600 mt-5">
                                    <Icon path="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                    ))}
                    <button type="button" onClick={addChild} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-600 transition-colors">
                        <Icon path="M12 6v6m0 0v6m0-6h6m-6 0H6" className="w-5 h-5 mr-2" />
                        Adicionar Filho
                    </button>
                </div>
            )}

            {template.fileConfig && isLastStep && (
                 <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Anexo Principal{template.fileConfig.isRequired && ' *'}</label>
                     <input 
                        type="file" 
                        required={template.fileConfig.isRequired && !editingDocument}
                        accept={template.fileConfig.acceptedTypes}
                        onChange={(e) => handleFileChange(e, '__mainFile')}
                        className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1"
                    />
                </div>
            )}
            
            <div className="mt-8 flex justify-between items-center">
                <button type="button" onClick={onCancel} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                <div className="flex space-x-3">
                    {template.steps && currentStep > 1 && (
                         <button type="button" onClick={() => setCurrentStep(s => s - 1)} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Voltar</button>
                    )}
                     {isLastStep || isIntermediateSubmitStep ? (
                        <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">
                            {isIntermediateSubmitStep ? 'Gerar PDF e Enviar p/ Aprovação' : 'Enviar'}
                        </button>
                    ) : (
                        <button type="button" onClick={() => setCurrentStep(s => s + 1)} className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Avançar</button>
                    )}
                </div>
            </div>
        </form>
    )
  }

  const SimpleSendModal: React.FC<{ isOpen: boolean, onClose: () => void, data: { name: string } | null }> = ({ isOpen, onClose, data }) => {
    const [file, setFile] = useState<File | null>(null);
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (file) {
            handleSimpleSend(file, description);
        }
    };
    
    useEffect(() => {
        if(isOpen) {
            setFile(null);
            setDescription('');
        }
    }, [isOpen]);

    if (!data) return null;

    const getAcceptedTypes = (name: string): string => {
        const lowerName = name.toLowerCase();
        if (lowerName.includes('danfe')) {
            return 'application/pdf,image/*';
        }
        if (lowerName.includes('nota fiscal') || lowerName.includes('nf-e') || lowerName.includes('nfs-e') || lowerName.includes('xml')) {
            return 'application/xml,text/xml';
        }
        return '*/*'; // default for others
    };

    const acceptedFileTypes = getAcceptedTypes(data.name);

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <h3 className="text-xl font-bold text-black mb-4">Enviar: {data.name}</h3>
                <div className="space-y-4">
                     <div>
                        <label htmlFor="simple-file-upload" className="block text-sm font-medium text-gray-700">Arquivo *</label>
                        <input id="simple-file-upload" type="file" accept={acceptedFileTypes} onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1" required/>
                        {acceptedFileTypes.includes('xml') && <p className="text-xs text-gray-500 mt-1">Este documento deve ser enviado no formato XML.</p>}
                    </div>
                    <div>
                        <label htmlFor="simple-send-description" className="block text-sm font-medium text-gray-700">Observações (opcional)</label>
                        <textarea id="simple-send-description" value={description} onChange={e => setDescription(e.target.value)} className="w-full p-2 border rounded mt-1" rows={3}></textarea>
                    </div>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg" disabled={!file}>Enviar</button>
                </div>
            </form>
        </Modal>
    );
};
  
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
                        <label htmlFor="client-select-send" className="block text-sm font-medium text-gray-700">Cliente</label>
                        <select id="client-select-send" value={clientId} onChange={e => { setClientId(Number(e.target.value)); setSignatoryIds([]); }} className="w-full p-2 border rounded mt-1">
                             {clients.filter(c => c.status === 'Ativo').map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="docName" className="block text-sm font-medium text-gray-700">Nome do Documento</label>
                        <input id="docName" value={docName} onChange={e => setDocName(e.target.value)} placeholder="Ex: Contrato Social Atualizado" className="w-full p-2 border rounded mt-1" required/>
                    </div>
                     <div>
                        <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">Arquivo (PDF recomendado para assinaturas)</label>
                        <input id="file-upload" type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1" required/>
                    </div>
                    <div>
                        <label htmlFor="signatories" className="block text-sm font-medium text-gray-700">Solicitar Assinatura de (opcional)</label>
                         <select id="signatories" multiple value={signatoryIds} onChange={e => setSignatoryIds(Array.from(e.target.selectedOptions, option => option.value))} className="w-full p-2 border rounded mt-1 h-24">
                             {clientUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">Segure Ctrl (ou Cmd) para selecionar múltiplos usuários. Apenas usuários do tipo "Cliente" associados a esta empresa são listados.</p>
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
    const [description, setDescription] = useState('');
    const [file, setFile] = useState<File | null>(null);

    useEffect(() => {
      if (isOpen) {
        if (isClient && preselectedRequestName) {
            setRequestText(preselectedRequestName);
        }
      } else {
        setRequestText('');
        setDescription('');
        setFile(null);
      }
    }, [isOpen, preselectedRequestName]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!requestText || (!isClient && !clientIdForRequest)) {
            alert('Por favor, descreva a solicitação e selecione um cliente se necessário.');
            return;
        }
        const data = { clientId: isClient ? undefined : clientIdForRequest, requestText, description, file };
        handleSaveRequest(data);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
             <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="text-xl font-bold text-black">Solicitar Documento</h3>
                {!isClient && (
                    <div>
                        <label htmlFor="client-select-req" className="block text-sm font-medium text-gray-700">Cliente</label>
                        <select id="client-select-req" value={clientIdForRequest} onChange={e => setClientIdForRequest(Number(e.target.value))} className="w-full p-2 border rounded mt-1">
                             {clients.filter(c => c.status === 'Ativo').map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
                        </select>
                    </div>
                )}
                <div>
                    <label htmlFor="requestText" className="block text-sm font-medium text-gray-700">Descrição da Solicitação *</label>
                    <textarea id="requestText" value={requestText} onChange={e => setRequestText(e.target.value)} placeholder={isClient ? "Ex: Preciso de uma cópia do meu contrato social." : "Ex: Documentos para fechamento fiscal de Fevereiro."} className="w-full p-2 border rounded mt-1" rows={2} required disabled={isClient && !!preselectedRequestName}/>
                </div>
                 <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">Observações (opcional)</label>
                    <textarea id="description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Adicione qualquer detalhe relevante aqui." className="w-full p-2 border rounded mt-1" rows={3}/>
                </div>
                 <div>
                    <label htmlFor="file-upload-req" className="block text-sm font-medium text-gray-700">Anexar Arquivo (opcional)</label>
                    <input id="file-upload-req" type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-dark/10 file:text-primary hover:file:bg-primary-dark/20 mt-1"/>
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="bg-gray-200 text-gray-800 font-bold py-2 px-4 rounded-lg">Cancelar</button>
                    <button type="submit" className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Solicitar</button>
                </div>
            </form>
        </Modal>
    );
  };
  
   const DocumentDetailsModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    doc: Document | null
  }> = ({ isOpen, onClose, doc }) => {
    if(!doc) return null;
    const client = clients.find(c => c.id === doc.clientId);
    const canApprove = !isClient && doc.status === 'Aguardando Aprovação' && doc.templateId === 'rescisao-contrato';
    const canGenerateAviso = (isClient || !isClient) && doc.templateId === 'rescisao-contrato' && (doc.status === 'Recebido' || doc.status === 'Concluído' || doc.status === 'Aguardando Aprovação' || doc.status === 'Pendente Etapa 2');
    const isPendingSignatory = doc.status === 'Aguardando Assinatura' && doc.requiredSignatories?.some(s => s.userId === currentUser.id && s.status === 'pendente');

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="lg">
            <div>
                 <h3 className="text-xl font-bold text-black mb-4">{doc.name}</h3>
                 <div className="space-y-2 text-sm mb-4 border-b pb-4">
                    <p className="text-black"><strong>Cliente:</strong> {client?.company || 'N/A'}</p>
                    <p className="text-black"><strong>Status:</strong> {doc.status}</p>
                    <p className="text-black"><strong>Enviado por:</strong> {doc.uploadedBy} em {new Date(doc.uploadDate).toLocaleString('pt-BR')}</p>
                    {doc.requestText && <p className="text-black mt-2"><strong>Solicitação:</strong> {doc.requestText}</p>}
                    {doc.description && <p className="text-black mt-2"><strong>Observações:</strong> {doc.description}</p>}
                 </div>
                 
                {doc.file && (
                  <div className="my-4">
                    <button onClick={() => downloadFileFromBase64(doc.file!.content, doc.file!.name)} className="flex items-center bg-blue-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-600">
                        <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-5 h-5 mr-2"/>
                        Baixar Arquivo ({doc.file.name})
                    </button>
                  </div>
                )}

                {doc.requiredSignatories && (
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
                        <p className="text-sm text-yellow-700 mt-1 mb-3">Sua assinatura é necessária para este documento.</p>
                        <button onClick={() => handleSignDocument(doc)} className="bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">
                            Assinar Documento
                        </button>
                    </div>
                 )}

                 {canApprove && (
                    <div className="my-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <h4 className="font-bold text-yellow-800">Ação Requerida</h4>
                        <p className="text-sm text-yellow-700 mt-1">O cliente enviou a primeira etapa da rescisão. Revise os detalhes e aprove para que ele possa enviar a documentação final.</p>
                        <button onClick={() => handleApproveStep(doc.id)} className="mt-3 bg-green-500 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-600">
                            Aprovar para Próxima Etapa
                        </button>
                    </div>
                 )}

                 <div className="mt-6 flex justify-end space-x-3">
                    {canGenerateAviso && client && (
                         <button type="button" onClick={() => generateAvisoPrevioPdf(doc, client)} className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg">Gerar Aviso Prévio</button>
                    )}
                    <button type="button" onClick={() => downloadReceiptAsPdf(doc, client?.name)} className="bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">Gerar Recibo</button>
                    <button type="button" onClick={onClose} className="bg-primary text-white font-bold py-2 px-4 rounded-lg">Fechar</button>
                 </div>
            </div>
        </Modal>
    )
  }

  // Admin View remains the same
  const AdminView: React.FC = () => {
    const getStatusClass = (status: DocumentStatus) => {
        const classes: Record<DocumentStatus, string> = {
            'Pendente': 'bg-yellow-100 text-yellow-800',
            'Recebido': 'bg-blue-100 text-blue-800',
            'Revisado': 'bg-indigo-100 text-indigo-800',
            'Aguardando Aprovação': 'bg-purple-100 text-purple-800',
            'Aguardando Assinatura': 'bg-purple-100 text-purple-800',
            'Concluído': 'bg-green-100 text-green-800',
            'Pendente Etapa 2': 'bg-yellow-200 text-yellow-900',
        };
        return classes[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <table className="min-w-full leading-normal">
                <thead>
                   <tr className="border-b-2 border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                        <th className="px-5 py-3">Documento</th>
                        <th className="px-5 py-3">Cliente</th>
                        <th className="px-5 py-3">Data</th>
                        <th className="px-5 py-3">Origem</th>
                        <th className="px-5 py-3">Status</th>
                        <th className="px-5 py-3">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    {filteredDocuments.map(doc => {
                        const client = clients.find(c => c.id === doc.clientId);
                        return (
                            <tr key={doc.id} className="border-b border-gray-200 hover:bg-gray-50">
                                <td className="px-5 py-5 text-sm">
                                    <p className="text-black font-semibold whitespace-no-wrap">{doc.name}</p>
                                    <p className="text-gray-600 whitespace-no-wrap text-xs">{doc.description || doc.requestText}</p>
                                </td>
                                <td className="px-5 py-5 text-sm text-black">{client?.company || 'N/A'}</td>
                                <td className="px-5 py-5 text-sm text-black">{new Date(doc.uploadDate).toLocaleDateString('pt-BR')}</td>
                                <td className="px-5 py-5 text-sm text-black">{doc.source === 'cliente' ? (doc.formData ? 'Formulário do Cliente' : 'Solicitado Pelo Cliente') : 'Escritório'}</td>
                                <td className="px-5 py-5 text-sm">
                                    <span className={`relative inline-block px-3 py-1 font-semibold leading-tight rounded-full ${getStatusClass(doc.status)}`}>
                                        <span className="relative">{doc.status}</span>
                                    </span>
                                </td>
                                <td className="px-5 py-5 text-sm">
                                    <button onClick={() => handleOpenDetails(doc)} className="text-primary hover:underline">Ver Detalhes</button>
                                </td>
                            </tr>
                        )
                    })}
                     {filteredDocuments.length === 0 && (
                        <tr><td colSpan={6} className="text-center py-10 text-gray-500">Nenhum documento encontrado.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
  };
  
  // Client View components
  const DocumentList: React.FC<{ title: string; docs: Document[]; onDocClick: (doc: Document) => void, emptyText: string, iconColor?: string }> = ({ title, docs, onDocClick, emptyText, iconColor="text-primary" }) => (
    <div>
        <h3 className="text-xl font-bold text-black mb-4">{title}</h3>
        {docs.length > 0 ? (
            <ul className="space-y-3 bg-white p-4 rounded-lg shadow">
                {docs.map(doc => (
                    <li key={doc.id} onClick={() => onDocClick(doc)} className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-all duration-200 cursor-pointer">
                        <div className="flex items-center min-w-0">
                            <Icon path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" className={`w-8 h-8 ${iconColor} mr-4 flex-shrink-0`} />
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-black truncate">{doc.name}</p>
                                <p className="text-xs text-gray-500">{new Date(doc.uploadDate).toLocaleDateString('pt-BR')} - {doc.status}</p>
                            </div>
                        </div>
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
    const pendingRequestsFromOffice = filteredDocuments.filter(d => d.source === 'escritorio' && d.status.startsWith('Pendente'));
    const clientActivity = filteredDocuments.filter(d => d.source === 'cliente' && d.status !== 'Pendente Etapa 2' && d.status !== 'Aguardando Aprovação' && d.status !== 'Aguardando Assinatura');
    const inProgressDocs = filteredDocuments.filter(d => d.status === 'Pendente Etapa 2' || d.status === 'Aguardando Aprovação' || d.status === 'Aguardando Assinatura');

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <DocumentList 
                title="Solicitações do Escritório" 
                docs={pendingRequestsFromOffice} 
                onDocClick={handleOpenDetails}
                emptyText="Nenhuma solicitação pendente."
            />
            <DocumentList 
                title="Documentos em Andamento" 
                docs={inProgressDocs} 
                onDocClick={(doc) => doc.status === 'Pendente Etapa 2' ? handleOpenForEditing(doc) : handleOpenDetails(doc)}
                emptyText="Nenhum processo em andamento."
                iconColor="text-yellow-500"
            />
            <DocumentList 
                title="Seus Envios e Solicitações" 
                docs={clientActivity} 
                onDocClick={handleOpenDetails}
                emptyText="Você ainda não enviou ou solicitou documentos."
            />
        </div>
    );
  };
  
  const DocumentTemplateModal: React.FC<{isOpen: boolean, onClose: () => void, editingDoc: Document | null}> = ({ isOpen, onClose, editingDoc }) => {
    const [selectedTemplateId, setSelectedTemplateId] = useState(editingDoc?.templateId || '');
    const selectedTemplate = documentTemplates.find(t => t.id === selectedTemplateId) || (editingDoc ? documentTemplates.find(t => t.id === editingDoc.templateId) : null) ;
    const clientForForm = clients.find(c => c.id === activeClientId);

    const handleSave = async (data: { formData: Record<string, any>, file?: { name: string, type: string, content: string } }) => {
        if (!selectedTemplate || !activeClientId) return;
        
        setIsLoading(true);
        try {
            if (editingDoc) {
                 const updatedDoc = await api.updateDocumentFromTemplate(editingDoc.id, selectedTemplate, data);
                 setDocuments(prev => prev.map(d => d.id === editingDoc.id ? updatedDoc : d));
                 users.filter(u => u.role.includes('Admin')).forEach(admin => {
                    addNotification({
                        userId: admin.id,
                        message: `${currentUser.name} completou o envio de: ${editingDoc.name}`
                    });
                });
            } else {
                const newDoc = await api.createDocumentFromTemplate({
                    ...data,
                    template: selectedTemplate,
                    clientId: activeClientId,
                    uploadedBy: currentUser.name,
                });
                setDocuments(prev => [newDoc, ...prev]);

                if (selectedTemplate.id === 'rescisao-contrato') {
                    const employeeIdToInactivate = Number(data.formData.nome_funcionario_rescisao);
                    if (employeeIdToInactivate) {
                        await handleInactivateEmployee(employeeIdToInactivate);
                    }
                }

                if (taskToComplete) {
                    const updatedTask = await api.updateTaskStatus(taskToComplete.id, 'Concluída');
                    setTasks(prevTasks => prevTasks.map(t => t.id === taskToComplete.id ? updatedTask : t));
                     addNotification({
                        userId: currentUser.id,
                        message: `Tarefa "${taskToComplete.description}" concluída com o envio do documento.`
                    });
                }

                const notificationMessage = newDoc.status === 'Aguardando Aprovação'
                    ? `${currentUser.name} iniciou uma solicitação de rescisão.`
                    : `${currentUser.name} enviou um novo documento: ${selectedTemplate.name}`;
                
                users.filter(u => u.role.includes('Admin')).forEach(admin => {
                    addNotification({
                        userId: admin.id,
                        message: notificationMessage
                    });
                });
            }
        } catch(error) {
            console.error("Failed to save document from template", error);
        } finally {
            setIsLoading(false);
            handleClose();
        }
    };

    const handleClose = () => {
        setSelectedTemplateId('');
        setEditingDocument(null);
        setTaskToComplete(null);
        onClose();
    }

    useEffect(() => {
        if(directAction?.type === 'OPEN_DOC_MODAL') {
            setSelectedTemplateId(directAction.payload.templateId);
        }
    }, [directAction]);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} size="xl">
            <h3 className="text-xl font-bold text-black mb-4">{editingDoc ? 'Continuar Preenchimento' : taskToComplete ? `Concluir Tarefa: ${taskToComplete.description}` : 'Enviar Novo Documento'}</h3>
            {!editingDoc && (
                <div className="mb-4">
                    <label htmlFor="template-select" className="block text-sm font-medium text-gray-700">Selecione o tipo de documento</label>
                    <select id="template-select" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)} className="w-full p-2 border rounded mt-1" disabled={!!taskToComplete}>
                        <option value="">-- Escolha uma opção --</option>
                        {documentTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                </div>
            )}
            <div className="mt-6 border-t pt-6">
                {selectedTemplate && <DocumentTemplateForm template={selectedTemplate} onSave={handleSave} onCancel={handleClose} initialData={editingDoc?.formData} initialStep={editingDoc?.workflow?.currentStep} client={clientForForm} employees={employeesForClient}/>}
            </div>
        </Modal>
    );
  };
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        {isClient ? (
          <h2 className="text-3xl font-bold text-black">Seus Documentos</h2>
        ) : (
          <h2 className="text-3xl font-bold text-black">Gestão de Documentos</h2>
        )}

        <div className="flex items-center space-x-2">
           {isClient ? (
             <>
                <button onClick={() => setRequestSelectionModalOpen(true)} className="flex items-center bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors">
                    <Icon path="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.79 4 4s-1.79 4-4 4-4-1.79-4-4c0-.994.368-1.912.984-2.623" className="w-5 h-5 mr-2" />
                    Solicitar Documento
                </button>
                <button onClick={() => setIsSendSelectionModalOpen(true)} className="flex items-center bg-primary text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-primary-dark transition-colors">
                    <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-5 h-5 mr-2" />
                    Enviar Novo Documento
                </button>
            </>
          ) : (
            <>
              <button onClick={() => setSendModalOpen(true)} className="flex items-center bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-green-600 transition-colors">
                <Icon path="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" className="w-5 h-5 mr-2" />
                Enviar Documento
              </button>
              <button onClick={() => setRequestModalOpen(true)} className="flex items-center bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md hover:bg-yellow-600 transition-colors">
                <Icon path="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" className="w-5 h-5 mr-2" />
                Solicitar Documento
              </button>
            </>
          )}
        </div>
      </div>
      
      {!isClient && (
        <div className="mb-4">
            <label htmlFor="client-filter" className="text-sm font-medium text-gray-700 mr-2">Filtrar por Cliente:</label>
            <select
              id="client-filter"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="p-2 border border-gray-300 rounded-lg"
            >
              <option value="all">Todos os Clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
            </select>
        </div>
      )}

      {isClient ? <ClientView /> : <AdminView />}

      <DocumentTemplateModal isOpen={isTemplateModalOpen} onClose={() => setTemplateModalOpen(false)} editingDoc={editingDocument} />
      <DocumentRequestModal isOpen={isRequestModalOpen} onClose={() => { setRequestModalOpen(false); setPreselectedRequestName(''); }} />
      <DocumentRequestSelectionModal 
        isOpen={isRequestSelectionModalOpen} 
        onClose={() => setRequestSelectionModalOpen(false)} 
        onSelect={(docName) => {
            setPreselectedRequestName(docName);
            setRequestSelectionModalOpen(false);
            setRequestModalOpen(true);
        }} 
      />
      <DocumentRequestSelectionModal isOpen={isSendSelectionModalOpen} onClose={() => setIsSendSelectionModalOpen(false)} onSelect={handleSendSelection} title="Enviar Documento" />
      <AdminSendDocumentModal isOpen={isSendModalOpen} onClose={() => setSendModalOpen(false)} />
      <DocumentDetailsModal isOpen={isDetailsModalOpen} onClose={() => setDetailsModalOpen(false)} doc={selectedDocument}/>
      <SimpleSendModal isOpen={isSimpleSendModalOpen} onClose={() => setIsSimpleSendModalOpen(false)} data={simpleSendData} />
    </div>
  );
};

export default DocumentView;