import { User, Client, Invoice, AppNotification, TaskTemplateSet, Employee, TimeSheet, Document, Signature, Task, TaskStatus, DocumentTemplate, Settings, Opportunity, ComplianceFinding, DocumentStatus } from '../types';

const API_BASE_URL = (import.meta as any).env.VITE_API_URL || '/api';

const handleResponse = async (response: Response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(error.message || 'Ocorreu um erro na requisição.');
    }
    if (response.status === 204) {
        return null;
    }
    return response.json();
};

export const fetchAllData = async () => {
    const response = await fetch(`${API_BASE_URL}/all-data`);
    return handleResponse(response);
};

export const login = async (username: string, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    return handleResponse(response);
};

export const logout = async () => {
    const response = await fetch(`${API_BASE_URL}/logout`, { method: 'POST' });
    return handleResponse(response);
};

export const setActiveClient = async (clientId: number | null) => {
    const response = await fetch(`${API_BASE_URL}/active-client/${clientId}`, { method: 'POST' });
    return handleResponse(response);
};

export const addNotification = async (notification: Omit<AppNotification, 'id' | 'date' | 'read'>): Promise<AppNotification> => {
    const response = await fetch(`${API_BASE_URL}/notifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
    });
    return handleResponse(response);
};

export const markNotificationAsRead = async (id: number): Promise<AppNotification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, { method: 'PUT' });
    return handleResponse(response);
}

export const markAllNotificationsAsRead = async (): Promise<AppNotification[]> => {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, { method: 'PUT' });
    return handleResponse(response);
}

export const fetchDocumentUpdates = async (since: string): Promise<Document[]> => {
    const response = await fetch(`${API_BASE_URL}/documents/updates?since=${encodeURIComponent(since)}`);
    return handleResponse(response);
};

export const fetchInvoiceUpdates = async (since: string): Promise<Invoice[]> => {
    const response = await fetch(`${API_BASE_URL}/invoices/updates?since=${encodeURIComponent(since)}`);
    return handleResponse(response);
}


export const onboardClient = async (clientData: any): Promise<{ newClient: Client, newUser: User, newTasks: Task[] }> => {
    const response = await fetch(`${API_BASE_URL}/clients/onboard-client`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData),
    });
    return handleResponse(response);
};

export const updateClient = async (clientData: any): Promise<{ updatedClient: Client, updatedUser: User | null }> => {
     const response = await fetch(`${API_BASE_URL}/clients`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientData),
    });
    return handleResponse(response);
};

export const inactivateClient = async (clientId: number): Promise<Client> => {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}/inactivate`, { method: 'PUT' });
    return handleResponse(response);
};

export const deleteClient = async (clientId: number): Promise<{ success: boolean }> => {
    const response = await fetch(`${API_BASE_URL}/clients/${clientId}`, { method: 'DELETE' });
    return handleResponse(response);
};

// Settings
export const updateSettings = async (settings: Settings): Promise<Settings> => {
    const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
    });
    return handleResponse(response);
};

// Task Templates
export const createTaskTemplate = async (templateData: { name: string, tasks: string }): Promise<TaskTemplateSet> => {
    const response = await fetch(`${API_BASE_URL}/settings/task-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
    });
    return handleResponse(response);
};

export const deleteTaskTemplate = async (templateId: string): Promise<{ success: true }> => {
    const response = await fetch(`${API_BASE_URL}/settings/task-templates/${templateId}`, { method: 'DELETE' });
    return handleResponse(response);
};

// Users / Admins
export const createAdmin = async (adminData: any): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...adminData, role: 'AdminLimitado' })
    });
    return handleResponse(response);
};

export const updateAdmin = async (adminId: number, adminData: any): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${adminId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminData)
    });
    return handleResponse(response);
};

export const updateUserPassword = async (userId: number, password: string): Promise<User> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}/password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
    });
    return handleResponse(response);
};

export const deleteUser = async (userId: number): Promise<{ success: true }> => {
    const response = await fetch(`${API_BASE_URL}/users/${userId}`, { method: 'DELETE' });
    return handleResponse(response);
};


// Invoices
export const createInvoice = async (invoiceData: any): Promise<{ invoicesToAdd: Invoice[], notificationMessage: string, clientId: number }> => {
    const response = await fetch(`${API_BASE_URL}/invoices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invoiceData)
    });
    return handleResponse(response);
};

export const updateInvoiceAmount = async (invoiceId: string, amount: number): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/amount`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
    });
    return handleResponse(response);
};

export const updateInvoiceStatus = async (invoiceId: string, status: 'Pendente' | 'Pago' | 'Atrasado'): Promise<Invoice> => {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    return handleResponse(response);
};


export const deleteInvoice = async (invoiceId: string): Promise<{ success: true }> => {
    const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, { method: 'DELETE' });
    return handleResponse(response);
};

// Tasks
export const createTask = async (taskData: any, createdBy: string): Promise<Task> => {
    const response = await fetch(`${API_BASE_URL}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...taskData, createdBy })
    });
    return handleResponse(response);
};

export const updateTask = async (taskId: number, description: string): Promise<Task> => {
     const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description })
    });
    return handleResponse(response);
};

export const updateTaskStatus = async (taskId: number, status: TaskStatus): Promise<Task> => {
     const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    return handleResponse(response);
};

export const deleteTask = async (taskId: number): Promise<{ success: true }> => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`, { method: 'DELETE' });
    return handleResponse(response);
};

// Employees and Timesheets
export const createEmployee = async (employeeData: Omit<Employee, 'id' | 'status'>): Promise<Employee> => {
    const response = await fetch(`${API_BASE_URL}/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
    });
    return handleResponse(response);
};

export const createEmployeesBatch = async (clientId: number, employees: Omit<Employee, 'id' | 'status' | 'clientId'>[]): Promise<Employee[]> => {
     const response = await fetch(`${API_BASE_URL}/employees/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, employees })
    });
    return handleResponse(response);
};


export const updateEmployee = async (employeeId: number, employeeData: Omit<Employee, 'id' | 'status'>): Promise<Employee> => {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(employeeData)
    });
    return handleResponse(response);
};

export const inactivateEmployee = async (employeeId: number): Promise<Employee> => {
    const response = await fetch(`${API_BASE_URL}/employees/${employeeId}/inactivate`, { method: 'PUT' });
    return handleResponse(response);
};

export const saveTimeSheet = async (timeSheetData: Omit<TimeSheet, 'id'>): Promise<TimeSheet> => {
    const response = await fetch(`${API_BASE_URL}/employees/timesheets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(timeSheetData)
    });
    return handleResponse(response);
};


// Documents
export const createDocumentRequest = async (clientId: number, requestText: string, uploadedBy: string, source: 'cliente' | 'escritorio', description?: string): Promise<Document> => {
     const response = await fetch(`${API_BASE_URL}/documents/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, requestText, uploadedBy, source, description })
    });
    return handleResponse(response);
}

export const updateDocumentStatus = async (docId: number, status: DocumentStatus): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    return handleResponse(response);
}

export const sendDocumentFromAdmin = async (data: { clientId: number; docName: string; signatoryIds: string[]; }, fileContent: string, uploadedBy: string): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/send-from-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, fileContent, uploadedBy })
    });
    return handleResponse(response);
}

export const createDocumentFromTemplate = async (data: any): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/from-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return handleResponse(response);
};

export const updateDocumentFromTemplate = async (docId: number, template: DocumentTemplate, data: any): Promise<Document> => {
     const response = await fetch(`${API_BASE_URL}/documents/${docId}/from-template`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template, ...data })
    });
    return handleResponse(response);
}

export const approveDocumentStep = async (docId: number): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}/approve-step`, { method: 'PUT' });
    return handleResponse(response);
};

export const signDocument = async (docId: number, signature: Omit<Signature, 'id'|'documentId'>, newPdfBytes: string): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/${docId}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature, newPdfBytes })
    });
    return handleResponse(response);
}

export const createQuickSendDocument = async (docData: any): Promise<Document> => {
    const response = await fetch(`${API_BASE_URL}/documents/quick-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(docData)
    });
    return handleResponse(response);
}

// --- Gemini API Calls via Backend ---

export const getClientDataFromCnpj = async (cnpj: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/gemini/cnpj-lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpj }),
    });
    return handleResponse(response);
};

export const analyzeScannedDocument = async (fileContentBase64: string, mimeType: string, userDescription: string): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/gemini/analyze-quick-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContentBase64, mimeType, userDescription }),
    });
    return handleResponse(response);
};

export const analyzeTimeSheet = async (
    fileContentBase64: string,
    mimeType: string,
    employee: { name: string, salary: number },
    month: number,
    year: number
): Promise<any> => {
    const response = await fetch(`${API_BASE_URL}/gemini/analyze-timesheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContentBase64, mimeType, employee, month, year }),
    });
    return handleResponse(response);
};

export const analyzeBulkTimeSheet = async (
    fileContentBase64: string,
    mimeType: string,
    clientId: number,
    month: number,
    year: number
): Promise<any[]> => {
     const response = await fetch(`${API_BASE_URL}/gemini/analyze-bulk-timesheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileContentBase64, mimeType, clientId, month, year }),
    });
    return handleResponse(response);
};

export const findFinancialOpportunities = async (client: Client): Promise<Omit<Opportunity, 'id' | 'clientId' | 'dateFound'>[]> => {
    const response = await fetch(`${API_BASE_URL}/gemini/find-opportunities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client }),
    });
    return handleResponse(response);
};

export const checkCompliance = async (client: Client): Promise<Omit<ComplianceFinding, 'id' | 'clientId' | 'dateChecked'>[]> => {
    const response = await fetch(`${API_BASE_URL}/gemini/check-compliance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client }),
    });
    return handleResponse(response);
};

// --- Chat API Calls ---

export const initChatSession = async (): Promise<{ initialMessage: string }> => {
    const response = await fetch(`${API_BASE_URL}/chat/init`, { method: 'POST' });
    return handleResponse(response);
}

export const sendChatMessage = async (message: string): Promise<{ reply: string }> => {
    const response = await fetch(`${API_BASE_URL}/chat/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
    });
    return handleResponse(response);
};

export const sendBotMessage = async (message: string, context: string, file?: { content: string, mimeType: string }): Promise<{ reply: string }> => {
    const response = await fetch(`${API_BASE_URL}/gemini/chatbot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context, file }),
    });
    return handleResponse(response);
};