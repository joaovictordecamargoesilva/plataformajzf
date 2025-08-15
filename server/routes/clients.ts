import { Router, Request, Response } from 'express';
import '../types';

const router = Router();

// Onboard a new client
router.post('/onboard-client', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }

    const { name, company, email, phone, taxRegime, cnaes, keywords, businessDescription, username, password, taskTemplateSetId } = req.body;
    
    try {
        const existingUser = await req.prisma.user.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ message: 'Este nome de usuário já está em uso.' });
        }
        
        const result = await req.prisma.$transaction(async (prisma: any) => {
            const newUser = await prisma.user.create({
                data: {
                    username,
                    password, // HASH in real app
                    role: 'Cliente',
                    name,
                    email,
                    clientIds: [],
                    activeClientId: null,
                    permissions: {},
                }
            });

            const newClient = await prisma.client.create({
                data: {
                    name,
                    company,
                    email,
                    phone,
                    status: 'Ativo',
                    userId: newUser.id,
                    taxRegime,
                    businessProfile: {
                        cnaes: (cnaes || '').split(',').map((c: string) => c.trim()).filter(Boolean),
                        keywords: (keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
                        description: businessDescription
                    }
                }
            });

            const finalUser = await prisma.user.update({
                where: { id: newUser.id },
                data: {
                    clientIds: [newClient.id],
                    activeClientId: newClient.id
                }
            });

            const newTasks = [];
            if (taskTemplateSetId) {
                const template = await prisma.taskTemplateSet.findUnique({ where: { id: taskTemplateSetId }});
                if (template) {
                   for (const desc of template.taskDescriptions) {
                        const task = await prisma.task.create({
                            data: {
                                clientId: newClient.id,
                                description: desc,
                                status: 'Pendente',
                                isRecurring: true,
                                createdBy: req.user!.name,
                            }
                        });
                        newTasks.push(task);
                   }
                }
            }
            
            return { newClient, newUser: finalUser, newTasks };
        });

        res.status(201).json(result);

    } catch (error) {
        console.error("Onboarding error:", error);
        res.status(500).json({ message: 'Erro ao cadastrar novo cliente.' });
    }
});

// Update an existing client
router.put('/', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id, name, company, email, phone, taxRegime, cnaes, keywords, businessDescription } = req.body;
    
    try {
        const updatedClient = await req.prisma.client.update({
            where: { id },
            data: {
                name,
                company,
                email,
                phone,
                taxRegime,
                businessProfile: {
                    cnaes: (cnaes || '').split(',').map((c: string) => c.trim()).filter(Boolean),
                    keywords: (keywords || '').split(',').map((k: string) => k.trim()).filter(Boolean),
                    description: businessDescription
                }
            }
        });

        // Also update the associated user's name and email
        await req.prisma.user.update({
            where: { id: updatedClient.userId },
            data: { name, email }
        });

        res.json(updatedClient);

    } catch (error) {
        console.error("Client update error:", error);
        res.status(404).json({ message: 'Cliente não encontrado ou erro ao atualizar.' });
    }
});


// Inactivate a client
router.put('/:clientId/inactivate', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const clientId = parseInt(req.params.clientId, 10);
    
    try {
        const inactivatedClient = await req.prisma.client.update({
            where: { id: clientId },
            data: { status: 'Inativo' }
        });

        const user = await req.prisma.user.findUnique({ where: { id: inactivatedClient.userId } });
        if (user) {
            await req.prisma.user.update({
                where: { id: user.id },
                data: {
                    clientIds: (user.clientIds as number[]).filter(id => id !== clientId),
                    activeClientId: user.activeClientId === clientId ? null : user.activeClientId,
                }
            });
        }
        res.json(inactivatedClient);
    } catch (error) {
        res.status(404).json({ message: 'Cliente não encontrado.' });
    }
});

// Delete a client
router.delete('/:clientId', async (req: Request, res: Response) => {
     if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const clientId = parseInt(req.params.clientId, 10);
    try {
        const clientToDelete = await req.prisma.client.findUnique({ where: { id: clientId } });
        if (!clientToDelete) {
            return res.status(404).json({ message: 'Cliente não encontrado.' });
        }
        // This should cascade delete related data if configured in schema, or be handled in a transaction
        // For now, we delete the user and client separately.
        await req.prisma.client.delete({ where: { id: clientId } });
        await req.prisma.user.delete({ where: { id: clientToDelete.userId } });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Client delete error:", error);
        res.status(500).json({ message: 'Erro ao excluir cliente.' });
    }
});

export default router;