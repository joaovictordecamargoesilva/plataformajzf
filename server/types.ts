// Using `any` for PrismaClient to bypass potential build-time type generation issues.
// The runtime behavior relies on the actual PrismaClient instance provided by the middleware.
type PrismaClient = any;

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
  options?: string[];
  description?: string;
  acceptedTypes?: string;
  step?: number;
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
  steps?: { title: string }[] | null;
}

export type DocumentStatus = 'Pendente' | 'Recebido' | 'Revisado' | 'AguardandoAssinatura' | 'AguardandoAprovacao' | 'PendenteEtapa2' | 'Concluido';

export interface Signature {
  id: string;
  documentId: number;
  userId: number;
  date: string;
  signatureId: string;
  auditTrail: Record<string, any>;
}

export interface RequiredSignatory {
  id: string;
  documentId: number;
  userId: number;
  name: string;
  status: 'pendente' | 'assinado';
}

export interface AuditLog {
  id: string;
  documentId: number;
  user: string;
  date: string;
  action: string;
}

export interface Document {
  id: number;
  clientId: number;
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
  aiAnalysis?: any;
}

export interface InvoicePaymentMethods {
  pdfContent?: string;
  pixEnabled?: boolean;
  linkEnabled?: boolean;
}

export interface Invoice {
  id: string;
  clientId: number;
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
  userId: number | null;
  message: string;
  date: string;
  read: boolean;
  link?: string;
}

export type TaskStatus = 'Pendente' | 'Concluida';

export interface Task {
    id: number;
    clientId: number;
    description: string;
    status: TaskStatus;
    isRecurring: boolean;
    createdBy: string;
    creationDate: string;
}

export interface Opportunity {
  id: string;
  clientId: number;
  type: 'IncentivoFiscal' | 'EditalLicitacao' | 'Outro';
  title: string;
  description: string;
  source: string;
  dateFound: string;
  submissionDeadline?: string;
}

export interface ComplianceFinding {
  id: string;
  clientId: number;
  title: string;
  status: 'OK' | 'Atencao' | 'Pendencia' | 'Informativo';
  summary: string;
  sourceUrl: string;
  dateChecked: string;
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
    role: string;
    status: 'Ativo' | 'Inativo';
    salary: number;
    cbo?: string;
}

export interface TimeSheet {
    id: string;
    clientId: number;
    employeeId: number;
    month: number;
    year: number;
    status: 'PendenteDeEnvio' | 'EnviadoParaAnalise' | 'Processado' | 'ErroNaAnalise';
    totalOvertimeHours50: number;
    totalOvertimeHours100: number;
    totalNightlyHours: number;
    totalLatenessMinutes: number;
    totalAbsencesDays: number;
    dsrValue: number;
    sourceFile?: { name: string; type: string; content: string } | null;
    aiAnalysisNotes?: string;
}

declare module 'express-serve-static-core' {
    interface Request {
      prisma: PrismaClient;
      user?: User;
    }
}

export {};