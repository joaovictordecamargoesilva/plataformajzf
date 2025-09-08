import express, { Request, Response, NextFunction } from 'express';
import {} from './types';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import 'dotenv/config'; 
import apiRouter from './routes/index';
import prisma from './lib/prisma';

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

// --- Scheduled Job for Notifications ---
const runScheduledChecks = async () => {
    console.log(`[Scheduler] Running scheduled checks at ${new Date().toISOString()}`);
    try {
        const prismaForJob = prisma; // Use the existing prisma instance

        // 1. Find pending invoices and notify clients
        const pendingInvoices = await prismaForJob.invoice.findMany({
            where: {
                OR: [{ status: 'Pendente' }, { status: 'Atrasado' }]
            },
            include: {
                client: {
                    include: {
                        users: true
                    }
                }
            }
        });

        for (const invoice of pendingInvoices) {
            for (const user of invoice.client.users) {
                 await prismaForJob.appNotification.create({
                    data: {
                        userId: user.id,
                        message: `Lembrete: A fatura "${invoice.description}" está pendente de pagamento.`,
                        link: '/cobranca'
                    }
                });
            }
        }
        if (pendingInvoices.length > 0) {
            console.log(`[Scheduler] Sent reminders for ${pendingInvoices.length} pending invoices.`);
        }


        // 2. Find clients with pending tasks and notify them
        const pendingTasks = await prismaForJob.task.findMany({
            where: { status: 'Pendente' }
        });

        const tasksByClient: { [key: number]: number } = {};
        pendingTasks.forEach((task: any) => {
            tasksByClient[task.clientId] = (tasksByClient[task.clientId] || 0) + 1;
        });

        for (const clientIdStr in tasksByClient) {
            const clientId = parseInt(clientIdStr, 10);
            const taskCount = tasksByClient[clientId];

            const clientWithUsers = await prismaForJob.client.findUnique({
                where: { id: clientId },
                include: { users: true }
            });

            if (clientWithUsers) {
                for (const user of clientWithUsers.users) {
                    await prismaForJob.appNotification.create({
                        data: {
                            userId: user.id,
                            message: `Lembrete: Você possui ${taskCount} tarefa(s) pendente(s). Por favor, verifique a seção de tarefas.`,
                            link: '/tarefas'
                        }
                    });
                }
            }
        }
        if (Object.keys(tasksByClient).length > 0) {
            console.log(`[Scheduler] Sent reminders to ${Object.keys(tasksByClient).length} clients about pending tasks.`);
        }


    } catch (error) {
        console.error("[Scheduler] Error running scheduled checks:", error);
    }
};

// Run the check every 8 hours (3 times a day)
const EIGHT_HOURS_IN_MS = 8 * 60 * 60 * 1000;
setInterval(runScheduledChecks, EIGHT_HOURS_IN_MS);
// --- End of Scheduled Job ---


// Middleware to attach Prisma client to each request
const prismaMiddleware = (req: Request, res: Response, next: NextFunction) => {
    req.prisma = prisma;
    next();
};

// Core Middlewares
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser());
app.use(prismaMiddleware);

// API Routes
app.use('/api', apiRouter);

// Serve Frontend in Production
if (process.env.NODE_ENV === 'production') {
    // __dirname is dist/server. We go up one level to dist.
    const frontendDist = path.resolve(__dirname, '..');
    app.use(express.static(frontendDist));

    const frontendHandler = (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api/')) {
            return next(); // Let API requests fall through to the router
        }
        res.sendFile(path.resolve(frontendDist, 'index.html'));
    };
    
    // For any route that is not an API route, serve the index.html
    app.get('*', frontendHandler);
}

app.listen(port, '0.0.0.0', () => {
    console.log(`[Server] Servidor está rodando na porta: ${port}`);
    // Optional: Run on startup as well
    // runScheduledChecks(); 
});

export default app;