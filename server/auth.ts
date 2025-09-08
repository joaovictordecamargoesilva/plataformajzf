import express, { Request, Response, NextFunction } from 'express';
import {} from './types';
import { User, UserPermissions, UserRole } from './types';

const AUTH_COOKIE_NAME = 'jzf_auth_userId';

const getValidatedRole = (role: string): UserRole => {
    if (role === 'AdminGeral' || role === 'AdminLimitado' || role === 'Cliente') {
        return role;
    }
    console.error(`Invalid user role "${role}" detected in database. Defaulting to 'Cliente'.`);
    return 'Cliente'; 
};


// Helper to map prisma user to application user type
export const toAppUser = (dbUser: any): User => {
    // Explicitly build the permissions object
    const permissions: UserPermissions = {
        canManageClients: dbUser.canManageClients,
        canManageDocuments: dbUser.canManageDocuments,
        canManageBilling: dbUser.canManageBilling,
        canManageAdmins: dbUser.canManageAdmins,
        canManageSettings: dbUser.canManageSettings,
        canViewReports: dbUser.canViewReports,
        canViewDashboard: dbUser.canViewDashboard,
        canManageTasks: dbUser.canManageTasks,
    };
    
    // Explicitly construct the User object to ensure type compliance
    const appUser: User = {
        id: dbUser.id,
        username: dbUser.username,
        name: dbUser.name,
        email: dbUser.email,
        role: getValidatedRole(dbUser.role) as UserRole,
        activeClientId: dbUser.activeClientId as number | null,
        permissions: dbUser.role === 'AdminGeral' ? {
            canManageClients: true, canManageDocuments: true, canManageBilling: true,
            canManageAdmins: true, canManageSettings: true, canViewReports: true,
            canViewDashboard: true, canManageTasks: true
        } : permissions,
        clientIds: dbUser.clients?.map((c: any) => c.id) || [],
    };

    return appUser;
};


const loginHandler = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    // Find user and include their related clients
    const userFromDb = await req.prisma.user.findUnique({
        where: { username },
        include: { clients: true },
    });

    if (!userFromDb || userFromDb.password !== password) {
        return res.status(401).json({ message: 'Nome de usuário ou senha inválidos.' });
    }

    res.cookie(AUTH_COOKIE_NAME, userFromDb.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        path: '/',
    });
    
    res.json(toAppUser(userFromDb));
};

const logoutHandler = (req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
    res.status(200).json({ message: 'Logout realizado com sucesso.' });
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.cookies[AUTH_COOKIE_NAME];
    
    if (!userId) {
        return res.status(401).json({ message: 'Não autorizado: Nenhum usuário logado.' });
    }

    try {
        const userFromDb = await req.prisma.user.findUnique({
            where: { id: parseInt(userId, 10) },
            include: { clients: true }
        });
        
        if (!userFromDb) {
            // Clear the invalid cookie
            res.clearCookie(AUTH_COOKIE_NAME, { path: '/' });
            return res.status(401).json({ message: 'Não autorizado: Usuário não encontrado.' });
        }
        
        req.user = toAppUser(userFromDb);
        next();

    } catch (error) {
        console.error("Auth middleware error:", error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
};

const router = express.Router();
router.post('/login', loginHandler);
router.post('/logout', logoutHandler);

export { router as authRouter };