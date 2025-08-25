import '../types';
import { type Request, type Response, Router } from 'express';
import { AppNotification, Client, ComplianceFinding, Document, DocumentTemplate, Employee, Invoice, Opportunity, Settings, Task, TaskTemplateSet, TimeSheet, User } from '../types';
import { toAppUser } from '../auth';
import { Prisma } from '.prisma/client';

const router = Router();

const safeJsonParse = <T>(jsonValue: Prisma.JsonValue | null): T | null => {
    if (jsonValue === null || jsonValue === undefined) return null;
    if (typeof jsonValue === 'object' && !Array.isArray(jsonValue)) return jsonValue as T;
    if (typeof jsonValue === 'string') {
        try {
            return JSON.parse(jsonValue) as T;
        } catch (e) {
            console.error("Failed to parse JSON from string:", jsonValue);
            return null;
        }
    }
    // For other primitive types that might be in a JSON field but aren't objects
    return jsonValue as T;
};

const parseStringToArray = (input: Prisma.JsonValue | string | null): string[] => {
    if (Array.isArray(input)) {
        return input.map(String);
    }
    if (typeof input === 'string') {
        return input.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [];
};

const getAllData = async (req: Request, res: Response) => {
    const user = req.user!;
    
    const users = await req.prisma.user.findMany({ include: { clients: true } });
    const clients = await req.prisma.client.findMany();
    const documents = await req.prisma.document.findMany({ include: { signatures: true, requiredSignatories: true, auditLog: true }, orderBy: { uploadDate: 'desc' } });
    const invoices = await req.prisma.invoice.findMany({ orderBy: { dueDate: 'desc' } });
    const tasks = await req.prisma.task.findMany({ orderBy: { creationDate: 'desc' } });
    const settings = await req.prisma.settings.findUnique({ where: { id: 1 } });
    const notifications = await req.prisma.appNotification.findMany({ orderBy: { date: 'desc' }});
    const opportunities = await req.prisma.opportunity.findMany({ orderBy: { dateFound: 'desc' } });
    const taskTemplateSets = await req.prisma.taskTemplateSet.findMany();
    const employees = await req.prisma.employee.findMany();
    const timeSheets = await req.prisma.timeSheet.findMany();
    const documentTemplates = await req.prisma.documentTemplate.findMany();
    const complianceFindings = await req.prisma.complianceFinding.findMany({ orderBy: { dateChecked: 'desc' }});
    
    const appUsers: User[] = users.map(toAppUser);
    const appClients: Client[] = clients.map((c) => ({ ...c, cnaes: parseStringToArray(c.cnaes), keywords: parseStringToArray(c.keywords), taxRegime: c.taxRegime as any, status: c.status as any }));
    const appDocuments: Document[] = documents.map((d) => ({ ...d, uploadDate: d.uploadDate.toISOString(), file: safeJsonParse(d.file), formData: safeJsonParse(d.formData), workflow: safeJsonParse(d.workflow), signatures: (d.signatures || []).map((s: any) => ({...s, id: String(s.id), date: s.date.toISOString(), auditTrail: safeJsonParse(s.auditTrail)})), requiredSignatories: (d.requiredSignatories || []).map((rs: any) => ({ ...rs, id: String(rs.id), status: rs.status as 'pendente' | 'assinado' })), aiAnalysis: safeJsonParse(d.aiAnalysis), auditLog: (d.auditLog || []).map((l: any) => ({...l, id: String(l.id), date: l.date.toISOString()})), type: d.type as any, source: d.source as any, status: d.status as any, description: d.description ?? undefined, requestText: d.requestText ?? undefined, templateId: d.templateId ?? undefined }));
    const appInvoices: Invoice[] = invoices.map((i) => ({...i, dueDate: i.dueDate.toISOString(), isRecurring: i.isRecurring, status: i.status as any, boletoPdf: i.boletoPdf ?? undefined }));
    const appTasks: Task[] = tasks.map((t) => ({ ...t, creationDate: t.creationDate.toISOString(), status: t.status as any }));
    const appNotifications: AppNotification[] = notifications.map((n) => ({ ...n, date: n.date.toISOString(), link: n.link ?? undefined, userId: n.userId ?? null }));
    const appOpportunities: Opportunity[] = opportunities.map((o) => ({...o, type: o.type as any, dateFound: o.dateFound.toISOString(), submissionDeadline: o.submissionDeadline?.toISOString() }));
    const appComplianceFindings: ComplianceFinding[] = complianceFindings.map((cf) => ({...cf, status: cf.status as any, dateChecked: cf.dateChecked.toISOString() }));
    const appTaskTemplateSets: TaskTemplateSet[] = taskTemplateSets.map((tts) => ({...tts, taskDescriptions: parseStringToArray(tts.taskDescriptions as any)}));
    const appEmployees: Employee[] = employees.map((e) => ({...e, status: e.status as any}));
    const appTimeSheets: TimeSheet[] = timeSheets.map((ts) => ({ ...ts, sourceFile: safeJsonParse(ts.sourceFile), status: ts.status as any, aiAnalysisNotes: ts.aiAnalysisNotes ?? undefined }));
    const appDocumentTemplates: DocumentTemplate[] = documentTemplates.map((dt) => ({ ...dt, category: dt.category as any, fields: safeJsonParse(dt.fields), fileConfig: safeJsonParse(dt.fileConfig), steps: safeJsonParse(dt.steps) }));

    const dataPayload = {
        currentUserId: user.id,
        activeClientId: user.activeClientId,
        users: appUsers,
        clients: user.role === 'Cliente' ? appClients.filter(c => user.clientIds.includes(c.id)) : appClients,
        documents: user.role === 'Cliente' ? appDocuments.filter(d => user.clientIds.includes(d.clientId)) : appDocuments,
        invoices: user.role === 'Cliente' ? appInvoices.filter(i => user.clientIds.includes(i.clientId)) : appInvoices,
        tasks: user.role === 'Cliente' ? appTasks.filter(t => user.clientIds.includes(t.clientId)) : appTasks,
        employees: user.role === 'Cliente' ? appEmployees.filter(e => user.clientIds.includes(e.clientId)) : appEmployees,
        timeSheets: user.role === 'Cliente' ? appTimeSheets.filter(ts => user.clientIds.includes(ts.clientId)) : appTimeSheets,
        opportunities: user.role === 'Cliente' ? appOpportunities.filter(o => user.clientIds.includes(o.clientId)) : appOpportunities,
        complianceFindings: user.role === 'Cliente' ? appComplianceFindings.filter(cf => user.clientIds.includes(cf.clientId)) : appComplianceFindings,
        settings: settings || { pixKey: '', paymentLink: ''},
        documentTemplates: appDocumentTemplates,
        taskTemplateSets: user.role === 'Cliente' ? [] : appTaskTemplateSets,
        notifications: user.role === 'Cliente' ? appNotifications.filter(n => n.userId === user.id) : appNotifications,
    };
    
    res.json(dataPayload);
};

const setActiveClient = async (req: Request, res: Response) => {
    const user = req.user!;
    const clientIdParam = req.params.clientId;
    const clientId = clientIdParam === 'null' || !clientIdParam ? null : parseInt(clientIdParam, 10);

    await req.prisma.user.update({
        where: { id: user.id },
        data: { activeClientId: clientId },
    });
    res.status(200).json({ success: true, activeClientId: clientId });
};

const addNotification = async (req: Request, res: Response) => {
    const { userId, message, link } = req.body;
    const newNotification = await req.prisma.appNotification.create({
        data: { userId, message, link, date: new Date(), read: false },
    });
    res.status(201).json({ ...newNotification, date: newNotification.date.toISOString(), userId: newNotification.userId ?? null });
};

const markAsRead = async (req: Request, res: Response) => {
    const notificationId = parseInt(req.params.id, 10);
    await req.prisma.appNotification.update({ where: { id: notificationId }, data: { read: true } });
    const notifications = await req.prisma.appNotification.findMany({ orderBy: { date: 'desc' }});
    res.json(notifications.map(n => ({...n, date: n.date.toISOString(), link: n.link ?? undefined, userId: n.userId ?? null })));
};

const markAllAsRead = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    await req.prisma.appNotification.updateMany({ where: { userId: userId, read: false }, data: { read: true } });
    const notifications = await req.prisma.appNotification.findMany({ orderBy: { date: 'desc' }});
    res.json(notifications.map(n => ({...n, date: n.date.toISOString(), link: n.link ?? undefined, userId: n.userId ?? null })));
};

router.get('/all-data', getAllData);
router.post('/active-client/:clientId', setActiveClient);
router.post('/notifications', addNotification);
router.put('/notifications/:id/read', markAsRead);
router.put('/notifications/read-all', markAllAsRead);

export { router as mainRouter };