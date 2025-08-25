import './types';
/// <reference types="node" />
import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import 'dotenv/config'; 
import apiRouter from './routes';
import prisma from './lib/prisma';

const app = express();
const port = process.env.PORT || 3001;

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
    // __dirname is the directory of the currently executing file (dist/server)
    // We go one level up to 'dist' which contains the frontend build
    const frontendDist = path.resolve(__dirname, '..');
    app.use(express.static(frontendDist));

    // For any route that is not an API route, serve the index.html
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
        if (req.path.startsWith('/api/')) {
            return next(); // Let API requests fall through to the router
        }
        res.sendFile(path.resolve(frontendDist, 'index.html'));
    });
}

app.listen(port, () => {
    console.log(`[Server] Servidor está rodando em http://localhost:${port}`);
});

export default app;