import { Router, Request, Response } from 'express';
import '../types';
import { User } from '../types';

const router = Router();

const adaptUserForClient = (user: any): User => {
    return {
        ...user,
        permissions: user.permissions as any,
        clientIds: user.clientIds as number[],
    };
};

router.get('/all-data', async (req: Request, res: Response) => {
    const user = req.user!;
    const prisma = req.prisma;

    try {
        const settings = await prisma.settings.findFirst() || { pixKey: '', paymentLink: '' };
        const documentTemplates = await prisma.documentTemplate.findMany();

        if (user.role === 'Cliente') {
            const clientIds = user.clientIds || [];
            const [
                users, clients, documents, invoices, tasks, notifications, 
                opportunities, complianceFindings, employees, timeSheets
            ] = await prisma.$transaction([
                prisma.user.findMany({ where: { OR: [{ id: user.id }, { role: { contains: 'Admin' } }] } }),
                prisma.client.findMany({ where: { id: { in: clientIds } } }),
                prisma.document.findMany({ where: { clientId: { in: clientIds } } }),
                prisma.invoice.findMany({ where: { clientId: { in: clientIds } } }),
                prisma.task.findMany({ where: { clientId: { in: clientIds } } }),
                prisma.appNotification.findMany(), // Notifications are filtered client-side for now
                prisma.opportunity.findMany({ where: { clientId: { in: clientIds } } }),
                prisma.complianceFinding.findMany({ where: { clientId: { in: clientIds } } }),
                prisma.employee.findMany({ where: { clientId: { in: clientIds } } }),
                prisma.timeSheet.findMany({ where: { clientId: { in: clientIds } } })
            ]);

            const dataForClient = {
                currentUserId: user.id,
                activeClientId: user.activeClientId,
                users: users.map(adaptUserForClient),
                clients, documents, invoices, tasks, notifications, opportunities,
                complianceFindings, employees, timeSheets, documentTemplates, settings,
                taskTemplateSets: [], // This is now managed differently or needs migration
            };
            return res.json(dataForClient);
        }

        // Admin users get all data
        const [
            users, clients, documents, invoices, tasks, notifications,
            opportunities, complianceFindings, taskTemplateSets, employees, timeSheets
        ] = await prisma.$transaction([
            prisma.user.findMany(),
            prisma.client.findMany(),
            prisma.document.findMany(),
            prisma.invoice.findMany(),
            prisma.task.findMany(),
            prisma.appNotification.findMany(),
            prisma.opportunity.findMany(),
            prisma.complianceFinding.findMany(),
            prisma.taskTemplateSet.findMany(),
            prisma.employee.findMany(),
            prisma.timeSheet.findMany()
        ]);

        res.json({
            currentUserId: user.id,
            activeClientId: null,
            users: users.map(adaptUserForClient),
            clients, documents, invoices, tasks, settings, notifications,
            opportunities, complianceFindings, taskTemplateSets,
            employees, timeSheets, documentTemplates
        });
    } catch (error) {
        console.error("Error fetching all-data:", error);
        res.status(500).json({ message: "Erro ao buscar dados do servidor." });
    }
});


router.post('/active-client/:clientId', async (req: Request, res: Response) => {
    const user = req.user!;
    const clientIdParam = req.params.clientId;
    let newActiveClientId: number | null = clientIdParam === 'null' ? null : parseInt(clientIdParam, 10);
    
    await req.prisma.user.update({
        where: { id: user.id },
        data: { activeClientId: newActiveClientId }
    });
    
    res.status(204).send();
});

router.post('/notifications', async (req: Request, res: Response) => {
    const { userId, message } = req.body;
    const newNotification = await req.prisma.appNotification.create({
        data: {
            userId,
            message,
        }
    });
    res.status(201).json(newNotification);
});

router.put('/notifications/:id/read', async (req: Request, res: Response) => {
    const notificationId = parseInt(req.params.id, 10);
    await req.prisma.appNotification.update({
        where: { id: notificationId },
        data: { read: true }
    });
    const allNotifications = await req.prisma.appNotification.findMany();
    res.json(allNotifications);
});

router.put('/notifications/read-all', async (req: Request, res: Response) => {
    const userId = req.user!.id;
    await req.prisma.appNotification.updateMany({
        where: { userId, read: false },
        data: { read: true }
    });
    const allNotifications = await req.prisma.appNotification.findMany();
    res.json(allNotifications);
});

export default router;