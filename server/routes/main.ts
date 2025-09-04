import express, { Request, Response } from 'express';
import {} from '../types';
import { User } from '../types';
import { toAppUser } from '../auth';

const router = express.Router();

// Helper to convert JSON strings from DB to objects
const safeJsonParse = <T>(jsonString: string | null | undefined, defaultValue: T): T => {
    if (jsonString === null || jsonString === undefined) {
        return defaultValue;
    }
    if (typeof jsonString === 'object') {
        return jsonString as T;
    }
    try {
        if (typeof jsonString !== 'string') {
            return defaultValue;
        }
        return JSON.parse(jsonString) as T;
    } catch (e) {
        return defaultValue;
    }
};

const getAllData = async (req: Request, res: Response) => {
    const user = req.user as User;

    try {
        const isAdmin = user.role.includes('Admin');
        const clientIds = user.clientIds;

        const whereClause = isAdmin ? undefined : { clientId: { in: clientIds } };

        const [
            allUsers, allClients, documents, invoices, tasks, settings, notifications,
            opportunities, complianceFindings, taskTemplateSets, employees, timeSheets, documentTemplates
        ] = await req.prisma.$transaction([
            req.prisma.user.findMany({ include: { clients: true } }),
            req.prisma.client.findMany(),
            req.prisma.document.findMany({ where: whereClause, include: { signatures: true, requiredSignatories: true, auditLog: true } }),
            req.prisma.invoice.findMany({ where: whereClause }),
            req.prisma.task.findMany({ where: whereClause }),
            req.prisma.settings.findUnique({ where: { id: 1 } }),
            req.prisma.appNotification.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] }, orderBy: { date: 'desc' } }),
            req.prisma.opportunity.findMany({ where: whereClause }),
            req.prisma.complianceFinding.findMany({ where: whereClause }),
            req.prisma.taskTemplateSet.findMany(),
            req.prisma.employee.findMany({ where: whereClause }),
            req.prisma.timeSheet.findMany({ where: whereClause }),
            req.prisma.documentTemplate.findMany(),
        ]);
        
        const clientsForUser = isAdmin ? allClients : allClients.filter((c: any) => clientIds.includes(c.id));
        const usersForUser = isAdmin ? allUsers : allUsers.filter((u: any) => u.id === user.id || u.role.includes('Admin'));

        const formattedDocs = documents.map((doc: any) => ({
            ...doc,
            uploadDate: doc.uploadDate.toISOString(),
            file: safeJsonParse(doc.file as string | null, null),
            formData: safeJsonParse(doc.formData as string | null, null),
            workflow: safeJsonParse(doc.workflow as string | null, null),
            signatures: doc.signatures.map((s: any) => ({...s, id: String(s.id), date: s.date.toISOString(), auditTrail: safeJsonParse(s.auditTrail as string, {})})),
            requiredSignatories: (doc.requiredSignatories || []).map((rs: any) => ({ ...rs, id: String(rs.id), status: rs.status as 'pendente' | 'assinado' })),
            aiAnalysis: safeJsonParse(doc.aiAnalysis as string | null, null),
            auditLog: doc.auditLog.map((l: any) => ({...l, id: String(l.id), date: l.date.toISOString()})),
            description: doc.description ?? undefined,
            requestText: doc.requestText ?? undefined,
            templateId: doc.templateId ?? undefined,
        }));
        
        const formattedClients = clientsForUser.map((c: any) => ({
            ...c,
            cnaes: safeJsonParse(c.cnaes, []),
            keywords: safeJsonParse(c.keywords, []),
            cnpj: c.cnpj ?? undefined,
        }));

        res.json({
            currentUserId: user.id,
            activeClientId: user.activeClientId,
            users: usersForUser.map((u: any) => toAppUser(u)),
            clients: formattedClients,
            documents: formattedDocs,
            invoices: invoices.map((i: any) => ({ 
                id: i.id,
                clientId: i.clientId,
                description: i.description,
                amount: i.amount,
                dueDate: i.dueDate.toISOString(),
                status: i.status as 'Pendente' | 'Pago' | 'Atrasado',
                isRecurring: i.isRecurring,
                paymentMethods: safeJsonParse(i.boletoPdf as string | null, null)
            })),
            tasks: tasks.map((t: any) => ({ ...t, creationDate: t.creationDate.toISOString() })),
            settings: settings || { pixKey: '', paymentLink: '' },
            notifications: notifications.map((n: any) => ({...n, date: n.date.toISOString()})),
            opportunities: opportunities.map((o: any) => ({...o, dateFound: o.dateFound.toISOString(), submissionDeadline: o.submissionDeadline?.toISOString()})),
            complianceFindings: complianceFindings.map((c: any) => ({...c, dateChecked: c.dateChecked.toISOString()})),
            taskTemplateSets: taskTemplateSets.map((t: any) => ({ ...t, taskDescriptions: safeJsonParse(t.taskDescriptions, []) })),
            employees: employees.map((e: any) => ({...e, cbo: e.cbo ?? undefined})),
            timeSheets: timeSheets.map((ts: any) => ({...ts, aiAnalysisNotes: ts.aiAnalysisNotes ?? undefined, sourceFile: safeJsonParse(ts.sourceFile as string | null, null)})),
            documentTemplates: documentTemplates.map((dt: any) => ({...dt, fields: safeJsonParse(dt.fields as string | null, null), fileConfig: safeJsonParse(dt.fileConfig as string | null, null), steps: safeJsonParse(dt.steps as string | null, null)})),
        });

    } catch (error) {
        console.error("Failed to fetch all data:", error);
        res.status(500).json({ message: "Failed to load application data." });
    }
};

const setActiveClient = async (req: Request, res: Response) => {
    const user = req.user as User;
    const clientIdStr = req.params.clientId;
    const clientId = clientIdStr === 'null' ? null : parseInt(clientIdStr, 10);

    if(user.role === 'Cliente' && clientId !== null && !user.clientIds.includes(clientId)){
        return res.status(403).json({message: "Access denied"});
    }
    await req.prisma.user.update({
        where: {id: user.id},
        data: {activeClientId: clientId}
    });
    res.status(204).send();
};

const addNotification = async (req: Request, res: Response) => {
    const newNotification = await req.prisma.appNotification.create({
        data: req.body
    });
    res.status(201).json({...newNotification, date: newNotification.date.toISOString()});
};

const markNotificationRead = async (req: Request, res: Response) => {
    const user = req.user as User;
    await req.prisma.appNotification.update({
        where: {id: parseInt(req.params.id, 10)},
        data: {read: true}
    });
    const notifications = await req.prisma.appNotification.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] }, orderBy: { date: 'desc' } });
    res.json(notifications.map((n: any) => ({...n, date: n.date.toISOString()})));
};

const markAllNotificationsRead = async (req: Request, res: Response) => {
    const user = req.user as User;
    await req.prisma.appNotification.updateMany({
        where: { read: false, OR: [{ userId: null }, { userId: user.id }] },
        data: { read: true }
    });
    const notifications = await req.prisma.appNotification.findMany({ where: { OR: [{ userId: null }, { userId: user.id }] }, orderBy: { date: 'desc' } });
    res.json(notifications.map((n: any) => ({...n, date: n.date.toISOString()})));
};

router.get('/all-data', getAllData);
router.post('/active-client/:clientId', setActiveClient);
router.post('/notifications', addNotification);
router.put('/notifications/:id/read', markNotificationRead);
router.put('/notifications/read-all', markAllNotificationsRead);

export { router as mainRouter };