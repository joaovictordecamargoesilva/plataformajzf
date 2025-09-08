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
  password?: string; // Kept optional for frontend
  role: UserRole;
  name: string;
  email: string;
  permissions: UserPermissions;
  clientIds: number[];
  activeClientId?: number | null;
}

export type TaxRegime = 'SimplesNacional' | 'LucroPresumido' | 'LucroReal';

export interface Client {
  id: number;
  name: string;
  company: string;
  cnpj?: string;
  email: string;
  phone: string;
  status: 'Ativo' | 'Inativo';
  taxRegime: TaxRegime;
  cnaes: string[];
  keywords: string[];
  businessDescription: string;
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

export type DocumentCategory = 'RH' | 'Fiscal' | 'Contábil' | 'Societário' | 'Outro';

export interface DocumentTemplate {
  id: string;
  name: string;
  category: DocumentCategory;
  fields: DocumentTemplateField[] | null;
  fileConfig?: {
    acceptedTypes: string;
    isRequired: boolean;
  } | null;
  steps?: { title: string }[] | null; // Titles for multi-step forms
}

export type DocumentStatus = 'Pendente' | 'Recebido' | 'Revisado' | 'AguardandoAssinatura' | 'AguardandoAprovacao' | 'PendenteEtapa2' | 'Concluido';

// Represents a signature event
export interface Signature {
  id: string;
  documentId: number;
  userId: number;
  date: string; // ISO String
  signatureId: string; // Unique identifier for the signature event
  auditTrail: Record<string, any>;
}

// Represents a required signatory status
export interface RequiredSignatory {
  id: string;
  documentId: number;
  userId: number;
  name: string; // Denormalized name for easy display
  status: 'pendente' | 'assinado';
}

// Represents an audit log entry
export interface AuditLog {
  id: string;
  documentId: number;
  user: string;
  date: string; // ISO String
  action: string;
}


export interface Document {
  id: number;
  clientId: number; // Link to a client
  name:string;
  description?: string;
  type: 'PDF' | 'Excel' | 'XML' | 'Outro' | 'Formulário';
  uploadDate: string;
  uploadedBy: string; 
  source: 'cliente' | 'escritorio';
  status: DocumentStatus;
  requestText?: string;
  file?: { name: string; type: string; content: string } | null;
  templateId?: string;
  formData?: Record<string, any> | null;
  workflow?: {
    currentStep: number;
    totalSteps: number;
  } | null;
  signatures: Signature[];
  requiredSignatories: RequiredSignatory[];
  auditLog: AuditLog[];
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
}

export interface InvoicePaymentMethods {
  pdfContent?: string; // base64 encoded PDF string
  pixEnabled?: boolean;
  linkEnabled?: boolean;
}

export interface Invoice {
  id: string;
  clientId: number; // Link to a client
  description: string;
  amount: number;
  dueDate: string;
  status: 'Pendente' | 'Pago' | 'Atrasado';
  isRecurring: boolean;
  paymentMethods: InvoicePaymentMethods | null;
}

export interface Settings {
    pixKey: string;
    paymentLink: string;
}

export interface AppNotification {
  id: number;
  userId: number | null; // Can be null for admin-wide broadcasts
  message: string;
  date: string; // ISO string
  read: boolean;
  link?: string; // Optional link to navigate to
}

export type TaskStatus = 'Pendente' | 'Concluida';

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
  type: 'IncentivoFiscal' | 'EditalLicitacao' | 'Outro';
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
  status: 'OK' | 'Atencao' | 'Pendencia' | 'Informativo';
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
    cbo?: string;
}

export interface TimeSheet {
    id: string; // Format: 'FP-clientId-employeeId-YYYY-MM'
    clientId: number;
    employeeId: number;
    month: number; // 1-12
    year: number;
    status: 'PendenteDeEnvio' | 'EnviadoParaAnalise' | 'Processado' | 'ErroNaAnalise';
    totalOvertimeHours50: number; // Horas extras 50%
    totalOvertimeHours100: number; // Horas extras 100%
    totalNightlyHours: number; // Adicional noturno em horas
    totalLatenessMinutes: number; // Atrasos em minutos
    totalAbsencesDays: number; // Faltas em dias
    dsrValue: number; // Valor final do DSR em R$
    sourceFile?: { name: string; type: string; content: string } | null; // For imported file
    aiAnalysisNotes?: string; // Notes from AI analysis
}

export {};