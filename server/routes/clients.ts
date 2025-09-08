import express, { Request, Response } from 'express';
import {} from '../types';
import { Task, Client, User } from '../types';
import { toAppUser } from '../auth';

const router = express.Router();

const csvToArray = (input: any): string[] => {
    if (Array.isArray(input)) return input.map(String);
    if (typeof input === 'string') return input.split(',').map(item => item.trim()).filter(Boolean);
    return [];
};

const toAppClient = (dbClient: any): Client => {
    return {
        id: dbClient.id,
        name: dbClient.name,
        company: dbClient.company,
        cnpj: dbClient.cnpj ?? undefined,
        email: dbClient.email,
        phone: dbClient.phone,
        status: dbClient.status,
        taxRegime: dbClient.taxRegime,
        cnaes: dbClient.cnaes ? JSON.parse(dbClient.cnaes) : [],
        keywords: dbClient.keywords ? JSON.parse(dbClient.keywords) : [],
        businessDescription: dbClient.businessDescription,
    };
};


// Onboard a new client
const onboardClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }

    const { name, company, cnpj, email, phone, taxRegime, cnaes, keywords, businessDescription, username, password: clientPassword, taskTemplateSetId } = req.body;
    const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : undefined;

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
                    cnpj: cleanCnpj,
                    email,
                    phone,
                    status: 'Ativo',
                    taxRegime,
                    cnaes: JSON.stringify(csvToArray(cnaes)),
                    keywords: JSON.stringify(csvToArray(keywords)),
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
                if (template && template.taskDescriptions) {
                    const descriptions = JSON.parse(template.taskDescriptions || '[]') as string[];
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
            
            const finalClient = { ...newClient, cnaes: csvToArray(cnaes), keywords: csvToArray(keywords) };
            return { newClient: finalClient, newUser: toAppUser(fullNewUser), newTasks };
        });
        
        res.status(201).json(result);

    } catch (error: any) {
        if (error.code === 'P2002') { // Prisma unique constraint violation
            const target = (error.meta as any)?.target || [];
            if (target.includes('username')) {
                return res.status(400).json({ message: 'Este nome de usuário já está em uso.' });
            }
            if (target.includes('email')) {
                return res.status(400).json({ message: 'Este e-mail já está em uso.' });
            }
            if (target.includes('cnpj')) {
                 return res.status(400).json({ message: 'Este CNPJ já está cadastrado.' });
            }
             return res.status(400).json({ message: 'Um cliente com estes dados já existe.' });
        }
        console.error("Failed to onboard client:", error);
        res.status(500).json({ message: 'Erro ao cadastrar novo cliente.' });
    }
};

// Update client details
const updateClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }

    const { id, name, company, cnpj, email, phone, taxRegime, cnaes, keywords, businessDescription, userId, selectedClientIds } = req.body;
    const cleanCnpj = cnpj ? String(cnpj).replace(/\D/g, '') : undefined;

    try {
        const [updatedClient, finalUser] = await req.prisma.$transaction(async (prisma: any) => {
            const clientUpdate = await prisma.client.update({
                where: { id: id },
                data: {
                    name,
                    company,
                    cnpj: cleanCnpj,
                    email,
                    phone,
                    taxRegime,
                    cnaes: JSON.stringify(csvToArray(cnaes)),
                    keywords: JSON.stringify(csvToArray(keywords)),
                    businessDescription
                } as any
            });

            let userUpdate = null;
            if (userId && Array.isArray(selectedClientIds)) {
                // Ensure the primary client being edited is always included in the user's access list
                const finalClientIds = [...new Set([...selectedClientIds, id])];
                
                userUpdate = await prisma.user.update({
                    where: { id: userId },
                    data: {
                        clients: {
                            set: finalClientIds.map((cid: number) => ({ id: cid }))
                        }
                    },
                    include: { clients: true }
                });
            } else if (userId) {
                // If no new client list is passed, just fetch the user to return it for consistency
                userUpdate = await prisma.user.findUnique({ where: { id: userId }, include: { clients: true } });
            }

            return [clientUpdate, userUpdate];
        });

        res.json({
            updatedClient: toAppClient(updatedClient),
            updatedUser: finalUser ? toAppUser(finalUser) : null,
        });

    } catch (error: any) {
        if (error.code === 'P2025') { // Prisma record to update not found
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        console.error("Error updating client:", error);
        res.status(500).json({ message: 'Erro ao atualizar o cliente.' });
    }
};

// Inactivate a client
const inactivateClientHandler = async (req: Request, res: Response) => {
     if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const clientId = parseInt(req.params.id, 10);
    try {
        const client = await req.prisma.client.update({
            where: { id: clientId },
            data: { status: 'Inativo' },
        });
        res.status(200).json(toAppClient(client));
    } catch (error) {
        res.status(500).json({ message: 'Erro ao inativar cliente.' });
    }
};

// Delete a client permanently
const deleteClientHandler = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const clientId = parseInt(req.params.id, 10);

    try {
        const client = await req.prisma.client.findUnique({ where: { id: clientId }, include: { users: true } });
        if (!client) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        
        await req.prisma.$transaction(async (prisma: any) => {
            await prisma.invoice.deleteMany({ where: { clientId } });
            await prisma.document.deleteMany({ where: { clientId } });
            await prisma.task.deleteMany({ where: { clientId } });
            await prisma.employee.deleteMany({ where: { clientId } });
            await prisma.timeSheet.deleteMany({ where: { clientId } });
            await prisma.opportunity.deleteMany({ where: { clientId } });
            await prisma.complianceFinding.deleteMany({ where: { clientId } });

            await prisma.client.delete({ where: { id: clientId } });

            for (const user of client.users) {
                const userWithClients = await prisma.user.findUnique({ where: { id: user.id }, include: { clients: true } });
                if (userWithClients && userWithClients.clients.length <= 1) {
                    await prisma.user.delete({ where: { id: user.id } });
                }
            }
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Error deleting client:", error);
        res.status(500).json({ message: 'Erro ao excluir o cliente permanentemente.' });
    }
};


router.post('/onboard-client', onboardClientHandler);
router.put('/', updateClientHandler);
router.put('/:id/inactivate', inactivateClientHandler);
router.delete('/:id', deleteClientHandler);

export { router as clientsRouter };