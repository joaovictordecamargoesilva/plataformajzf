import express, { Request, Response } from 'express';
import {} from '../types';
import { toAppUser } from '../auth';

const router = express.Router();

// Create a new admin user
const createAdmin = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral') {
        return res.status(403).json({ message: 'Apenas Administradores Gerais podem criar novos administradores.' });
    }

    const { name, email, username, password, permissions } = req.body;

    const existingUser = await req.prisma.user.findUnique({ where: { username }});
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
            canManageClients: permissions.canManageClients,
            canManageDocuments: permissions.canManageDocuments,
            canManageBilling: permissions.canManageBilling,
            canManageAdmins: permissions.canManageAdmins,
            canManageSettings: permissions.canManageSettings,
            canViewReports: permissions.canViewReports,
            canViewDashboard: permissions.canViewDashboard,
            canManageTasks: permissions.canManageTasks,
        }
    });

    res.status(201).json(toAppUser(newAdmin));
};

// Update an admin user
const updateAdmin = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral') {
        return res.status(403).json({ message: 'Apenas Administradores Gerais podem editar administradores.' });
    }
    const adminId = parseInt(req.params.id, 10);
    const { name, email, password, permissions } = req.body;
    
    const adminToUpdate = await req.prisma.user.findUnique({ where: { id: adminId } });
    if (!adminToUpdate) {
        return res.status(404).json({ message: 'Administrador não encontrado.' });
    }

    const dataToUpdate: any = { name, email };
    if (password) {
        dataToUpdate.password = password; // Again, hash in real app
    }
    if (adminToUpdate.role === 'AdminLimitado') {
        Object.assign(dataToUpdate, permissions);
    }

    const updatedAdmin = await req.prisma.user.update({
        where: { id: adminId },
        data: dataToUpdate,
        include: { clients: true }
    });
    
    res.json(toAppUser(updatedAdmin));
};

// Update a user's password (used by client management screen)
const updateUserPassword = async (req: Request, res: Response) => {
     if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageClients) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const userId = parseInt(req.params.id, 10);
    const { password } = req.body;

    if (!password) {
        return res.status(400).json({ message: 'A nova senha não pode ser vazia.' });
    }
    
    try {
        const userToUpdate = await req.prisma.user.findUnique({where: {id: userId}});
        if(!userToUpdate){
             return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        
        const updatedUser = await req.prisma.user.update({
            where: { id: userId },
            data: { password },
            include: { clients: true }
        });

        res.status(200).json(toAppUser(updatedUser));
    } catch(error) {
        console.error("Error updating user password:", error);
        res.status(500).json({ message: 'Erro ao atualizar a senha do usuário.' });
    }
};

const deleteUser = async (req: Request, res: Response) => {
    const userId = parseInt(req.params.id, 10);
    // Add extra checks to prevent deleting important users
    const userToDelete = await req.prisma.user.findUnique({ where: { id: userId }});
    if (!userToDelete) {
        return res.status(404).json({ message: 'Usuário não encontrado.' });
    }
    if (userToDelete.role === 'AdminGeral') {
        return res.status(403).json({ message: 'O Administrador Geral não pode ser excluído.'});
    }

    try {
        await req.prisma.user.delete({ where: { id: userId }});
        res.status(200).json({ success: true });
    } catch(error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: 'Erro ao excluir usuário.' });
    }
};


router.post('/', createAdmin);
router.put('/:id', updateAdmin);
router.put('/:id/password', updateUserPassword);
router.delete('/:id', deleteUser);

export { router as usersRouter };