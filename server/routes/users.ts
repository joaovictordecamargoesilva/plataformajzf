import { Router, Request, Response } from 'express';
import '../types';

const router = Router();

// Create a new admin user
router.post('/', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral') {
        return res.status(403).json({ message: 'Apenas Administradores Gerais podem criar novos administradores.' });
    }

    const { name, email, username, password, permissions } = req.body;

    const existingUser = await req.prisma.user.findUnique({ where: { username } });
    if (existingUser) {
        return res.status(400).json({ message: 'Nome de usuário já existe.' });
    }

    const newAdmin = await req.prisma.user.create({
        data: {
            name,
            email,
            username,
            password, // In a real app, hash this password
            role: 'AdminLimitado',
            permissions,
            clientIds: [],
        }
    });

    res.status(201).json(newAdmin);
});

// Update an admin user
router.put('/:id', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral') {
        return res.status(403).json({ message: 'Apenas Administradores Gerais podem editar administradores.' });
    }
    const adminId = parseInt(req.params.id, 10);
    const { name, email, password, permissions } = req.body;
    
    const adminToUpdate = await req.prisma.user.findUnique({ where: { id: adminId } });
    if (!adminToUpdate) {
        return res.status(404).json({ message: 'Administrador não encontrado.' });
    }
    
    const updateData: any = { name, email };
    if (password) {
        updateData.password = password; // Again, hash in real app
    }
    if (adminToUpdate.role === 'AdminLimitado') {
        updateData.permissions = permissions;
    }

    const updatedAdmin = await req.prisma.user.update({
        where: { id: adminId },
        data: updateData
    });

    res.json(updatedAdmin);
});

// Update a user's password (used by client management screen)
router.put('/:id/password', async (req: Request, res: Response) => {
     if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const userId = parseInt(req.params.id, 10);
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ message: 'A nova senha não pode ser vazia.' });
    }
    
    try {
        const updatedUser = await req.prisma.user.update({
            where: { id: userId },
            data: { password }
        });
        res.json(updatedUser);
    } catch (error) {
        res.status(404).json({ message: 'Usuário não encontrado.' });
    }
});

// Delete a user
router.delete('/:id', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral') {
        return res.status(403).json({ message: 'Apenas Administradores Gerais podem excluir usuários.' });
    }
    const userId = parseInt(req.params.id, 10);
    
    const userToDelete = await req.prisma.user.findUnique({ where: { id: userId } });
    if (!userToDelete) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    if (userToDelete.role === 'AdminGeral') {
        return res.status(400).json({ message: 'O Administrador Geral não pode ser excluído.' });
    }

    await req.prisma.user.delete({ where: { id: userId }});
    res.status(200).json({ success: true });
});

export default router;