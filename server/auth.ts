import { Request, Response, NextFunction } from 'express';
import './types';

const AUTH_COOKIE_NAME = 'jzf_auth_userId';

export const loginHandler = async (req: Request, res: Response) => {
    const { username, password } = req.body;
    
    const user = await req.prisma.user.findUnique({
        where: { username }
    });

    if (user && user.password === password) { // Em um app real, use bcrypt.compare
        res.cookie(AUTH_COOKIE_NAME, user.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
        });
        res.status(200).json(user);
    } else {
        res.status(401).json({ message: 'Nome de usuário ou senha inválidos.' });
    }
};

export const logoutHandler = (req: Request, res: Response) => {
    res.clearCookie(AUTH_COOKIE_NAME);
    res.status(200).json({ message: 'Logout bem-sucedido.' });
};

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.cookies[AUTH_COOKIE_NAME];
    if (!userId) {
        return res.status(401).json({ message: 'Não autorizado: Nenhum token de autenticação fornecido.' });
    }
    
    const user = await req.prisma.user.findUnique({
        where: { id: parseInt(userId, 10) }
    });

    if (!user) {
        // Clear cookie if user not found
        res.clearCookie(AUTH_COOKIE_NAME);
        return res.status(401).json({ message: 'Não autorizado: Usuário não encontrado.' });
    }

    // Adapt Prisma user to our application's User type
    req.user = {
        ...user,
        permissions: user.permissions as any,
        clientIds: user.clientIds as number[]
    };
    next();
};