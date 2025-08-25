import '../types';
import { type Request, type Response, Router } from 'express';
import { Task, Client, User } from '../types';
import { toAppUser } from '../auth';
import { Prisma } from '.prisma/client';

const router = Router();

const parseStringToArray = (input: any): string[] => {
    if (Array.isArray(input)) return input.map(String);
    if (typeof input === 'string') return input.split(',').map(item => item.trim()).filter(Boolean);
    return [];
};


const toAppClient = (dbClient: any): Client => {
    return {
        id: dbClient.id,
        name: dbClient.name,
        company: dbClient.company,
        email: dbClient.email,
        phone: dbClient.phone,
        status: dbClient.status,
        taxRegime: dbClient.taxRegime,
        cnaes: parseStringToArray(dbClient.cnaes),
        keywords: parseStringToArray(dbClient.keywords),
        businessDescription: dbClient.businessDescription,
    };
};


// Onboard a new client
const onboardClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }

    const { name, company, email, phone, taxRegime, cnaes, keywords, businessDescription, username, password: clientPassword, taskTemplateSetId } = req.body;

    try {
        const result = await req.prisma.$transaction(async (prisma: any) => {
            const newUser = await prisma.user.create({
                data: {
                    username,
                    password: clientPassword,
                    role: 'Cliente',
                    name,
                    email,
                }
            });

            const newClient = await prisma.client.create({
                data: {
                    name,
                    company,
                    email,
                    phone,
                    status: 'Ativo',
                    taxRegime,
                    cnaes: parseStringToArray(cnaes),
                    keywords: parseStringToArray(keywords),
                    businessDescription,
                    users: { connect: { id: newUser.id } }
                }
            });
            
            await prisma.user.update({
                where: { id: newUser.id },
                data: { activeClientId: newClient.id }
            });

            let newTasks: Task[] = [];
            if (taskTemplateSetId) {
                const template = await prisma.taskTemplateSet.findUnique({ where: { id: taskTemplateSetId } });
                if (template) {
                    const descriptions = template.taskDescriptions as string[];
                    for (const desc of descriptions) {
                        const createdTask = await prisma.task.create({
                            data: {
                                clientId: newClient.id,
                                description: desc,
                                status: 'Pendente',
                                isRecurring: true,
                                createdBy: req.user!.name,
                            }
                        });
                        newTasks.push({...createdTask, creationDate: createdTask.creationDate.toISOString(), status: 'Pendente' as any });
                    }
                }
            }
            const fullNewUser = await prisma.user.findUnique({ where: { id: newUser.id }, include: { clients: true } });
            if (!fullNewUser) throw new Error("Failed to retrieve new user after creation.");
            return { newClient: toAppClient(newClient), newUser: toAppUser(fullNewUser), newTasks };
        });
        
        res.status(201).json(result);

    } catch (error: any) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return res.status(400).json({ message: 'Nome de usuário já existe.' });
        }
        console.error("Onboarding error:", error);
        res.status(500).json({ message: "Erro ao criar cliente." });
    }
};

// Update a client
const updateClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    
    const { id, name, company, email, phone, taxRegime, cnaes, keywords, businessDescription } = req.body;
    
    try {
        const updatedClient = await req.prisma.client.update({
            where: { id },
            data: {
                name, company, email, phone, taxRegime,
                cnaes: parseStringToArray(cnaes),
                keywords: parseStringToArray(keywords),
                businessDescription
            }
        });
        res.json(toAppClient(updatedClient));
    } catch(error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404).json({ message: 'Cliente não encontrado.' });
        } else {
             res.status(500).json({ message: 'Erro ao atualizar o cliente.' });
        }
    }
};

// Inactivate a client
const inactivateClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const clientId = parseInt(req.params.id, 10);
    
    try {
        const clientToInactivate = await req.prisma.client.update({
            where: { id: clientId },
            data: { status: 'Inativo' },
        });
        
        res.status(200).json(toAppClient(clientToInactivate));
    } catch (error) {
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
            res.status(404).json({ message: 'Cliente não encontrado.' });
        } else {
            res.status(500).json({ message: 'Erro ao inativar o cliente.' });
        }
    }
};

// Permanently delete a client
const deleteClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral') {
        return res.status(403).json({ message: 'Apenas Administradores Gerais podem excluir clientes permanentemente.' });
    }
    const clientId = parseInt(req.params.id, 10);
    
    try {
        const clientToDelete = await req.prisma.client.findUnique({ 
            where: { id: clientId },
            include: { users: true }
        });
        if (!clientToDelete) {
             return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        
        await req.prisma.$transaction(async (prisma: any) => {
            await prisma.client.delete({ where: { id: clientId } });

            for (const user of clientToDelete.users) {
                const userWithClients = await prisma.user.findUnique({
                    where: { id: user.id },
                    include: { clients: true }
                });
                if (userWithClients && userWithClients.clients.length === 0) {
                    await prisma.user.delete({ where: { id: user.id }});
                }
            }
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Erro na exclusão do cliente.' });
    }
};

router.post('/onboard-client', onboardClientHandler);
router.put('/', updateClientHandler);
router.put('/:id/inactivate', inactivateClientHandler);
router.delete('/:id', deleteClientHandler);

export { router as clientsRouter };