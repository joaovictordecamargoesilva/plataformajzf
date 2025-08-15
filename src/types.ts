





export type UserRole = 'AdminGeral' | 'AdminLimitado' | 'Cliente';

export interface UserPermissions {
  canManageClients: boolean;
  canManageDocuments: boolean;
  canManageBilling: boolean;
  canManageAdmins: boolean;
  canManageSettings: boolean;
  canViewReports: boolean;
  canViewDashboard: boolean;
  canManageTasks: boolean;
}

export interface User {
  id: number;
  username: string;
  password: string; // In a real app, this would be a hash
  role: UserRole;
  name: string;
  email: string;
  permissions?: UserPermissions;
  clientIds?: number[]; // Only for 'Cliente' role
}

export type TaxRegime = 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';

export interface Client {
  id: number;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: 'Ativo' | 'Inativo';
  userId: number; // Link to the user login
  taxRegime: TaxRegime;
  businessProfile: {
    cnaes: string[];
    keywords: string[];
    description: string;
  };
}

export type DocumentTemplateFieldType = 'text' | 'date' | 'number' | 'textarea' | 'select' | 'checkbox' | 'file';

export interface DocumentTemplateField {
  id: string;
  label: string;
  type: DocumentTemplateFieldType;
  required: boolean;
  options?: string[]; // For 'select' type
  description?: string; // Helper text or placeholder
  acceptedTypes?: string; // For 'file' type
  step?: number; // For multi-step forms
}

export interface DocumentTemplate {
  id: string;
  name: string;
  fields: DocumentTemplateField[];
  fileConfig?: {
    acceptedTypes: string;
    isRequired: boolean;
  };
  steps?: { title: string }[]; // Titles for multi-step forms
}

export type DocumentStatus = 'Pendente' | 'Recebido' | 'Revisado' | 'Aguardando Assinatura' | 'Aguardando Aprovação' | 'Pendente Etapa 2' | 'Concluído';

export interface SignatureAuditTrail {
  userAgent: string;
  screenResolution: string;
  ipAddress: string; // Strengthens legal validity
}

export interface Signature {
    userId: number;
    name: string;
    date: string; // ISO String
    signatureId: string; // Unique identifier for the signature event
    auditTrail: SignatureAuditTrail;
}

export interface RequiredSignatory {
    userId: number;
    name: string;
    status: 'pendente' | 'assinado';
}

export interface Document {
  id: number;
  clientId: number; // Link to a client
  name:string;
  description?: string;
  type: 'PDF' | 'Excel' | 'XML' | 'Outro' | 'Formulário';
  uploadDate: string;
  // 'uploadedBy' is the user.name, 'source' distinguishes between a client submission and an office request
  uploadedBy: string; 
  source: 'cliente' | 'escritorio';
  status: DocumentStatus;
  // for office->client requests before they are fulfilled
  requestText?: string;
  // for client->office submissions
  file?: { name: string; type: string; content: string }; // Storing file content as base64 string
  templateId?: string; // e.g. 'admissao-funcionario'
  formData?: Record<string, any>;
  workflow?: {
    currentStep: number;
    totalSteps: number;
  }
  signatures?: Signature[];
  requiredSignatories?: RequiredSignatory[];
  aiAnalysis?: {
    status: 'idle' | 'loading' | 'done' | 'error';
    result?: string;
    structuredResult?: { // For chart data
        totalIn: number;
        totalOut: number;
        expensesByCategory: { category: string, amount: number }[];
    }
    error?: string;
  };
  auditLog?: {
    user: string;
    date: string; // ISO String
    action: string;
  }[];
}


export interface Invoice {
  id: string;
  clientId: number; // Link to a client
  description: string;
  amount: number;
  dueDate: string;
  status: 'Pendente' | 'Pago' | 'Atrasado';
  boletoPdf?: string; // Base64 encoded PDF string
  recurring?: {
    isRecurring: boolean;
  };
}

export interface Payment {
    id: string;
    date: string;
    description: string;
    amount: number;
    method: 'Boleto' | 'Pix' | 'Cartão de Crédito' | 'Link de Pagamento';
}

export interface Settings {
    pixKey: string;
    paymentLink: string;
}

export interface AppNotification {
  id: number;
  userId: number; // ID of user who should see this
  message: string;
  date: string; // ISO string
  read: boolean;
  link?: string; // Optional link to navigate to
}

export type TaskStatus = 'Pendente' | 'Concluída';

export interface Task {
    id: number;
    clientId: number;
    description: string;
    status: TaskStatus;
    isRecurring: boolean; // Is it a monthly task?
    createdBy: string;
    creationDate: string;
}

export interface Opportunity {
  id: string;
  clientId: number;
  type: 'Incentivo Fiscal' | 'Edital/Licitação' | 'Outro';
  title: string;
  description: string;
  source: string; // URL or Diário Oficial reference
  dateFound: string; // ISO string
  submissionDeadline?: string; // ISO string
}

export interface ComplianceFinding {
  id: string;
  clientId: number;
  title: string;
  status: 'OK' | 'Atenção' | 'Pendência' | 'Informativo';
  summary: string;
  sourceUrl: string;
  dateChecked: string; // ISO string
}

export interface TaskTemplateSet {
    id: string;
    name: string;
    taskDescriptions: string[];
}

export interface Employee {
    id: number;
    clientId: number;
    name: string;
    role: string; // Cargo
    status: 'Ativo' | 'Inativo';
    salary: number; // Salário base para cálculos
}

export interface TimeSheet {
    id: string; // Format: 'FP-clientId-employeeId-YYYY-MM'
    clientId: number;
    employeeId: number;
    month: number; // 1-12
    year: number;
    status: 'Pendente de Envio' | 'Enviado para Análise' | 'Processado' | 'Erro na Análise';

    // Data can be manually entered or extracted by AI
    totalOvertimeHours50: number; // Horas extras 50%
    totalOvertimeHours100: number; // Horas extras 100%
    totalNightlyHours: number; // Adicional noturno em horas
    totalLatenessMinutes: number; // Atrasos em minutos
    totalAbsencesDays: number; // Faltas em dias

    // Calculated values by AI or manually
    dsrValue: number; // Valor final do DSR em R$

    sourceFile?: { name: string; type: string; content: string }; // For imported file
    aiAnalysisNotes?: string; // Notes from AI analysis
}