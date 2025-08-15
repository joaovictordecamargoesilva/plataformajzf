
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
const { PrismaClient } = require('@prisma/client');
import apiRouter from './routes/index';
import './types';

console.log('[Server] Starting up...');

// --- Prisma Client Initialization ---
const prisma = new PrismaClient();

// --- Express App & Core Middleware Setup ---
const app = express();
const port = process.env.PORT || 3001;

console.log('[Server] Express app created. Configuring core middleware...');
app.use(cors({ origin: true, credentials: true }));
console.log('[Server] Core middleware applied.');


// --- Async Server Startup Function ---
const startServer = async () => {
    try {
        console.log('[Server] In startServer(), connecting to the database...');
        await prisma.$connect();
        console.log('[Server] Database connected successfully.');
        
        // --- DYNAMIC MIDDLEWARE (depends on DB) ---
        // Attaches DB to requests and sets up API routes
        app.use('/api',
            express.json({ limit: '20mb' }),
            express.urlencoded({ extended: true, limit: '20mb' }),
            cookieParser(),
            (req: Request, res: Response, next: NextFunction) => {
                req.prisma = prisma;
                next();
            },
            apiRouter
        );
        console.log('[Server] API router and Prisma middleware applied.');

        // --- SERVE FRONTEND IN PRODUCTION ---
        if (process.env.NODE_ENV === 'production') {
            const frontendDist = path.join(__dirname, '..', '..', 'dist');
            app.use(express.static(frontendDist));
            app.get('*', (req: Request, res: Response) => {
                res.sendFile(path.join(frontendDist, 'index.html'));
            });
            console.log(`[Server] Serving static files from ${frontendDist}`);
        }

        // --- START LISTENING ---
        app.listen(Number(port), '0.0.0.0', () => {
            console.log(`[Server] Backend server is running on http://localhost:${port} and accessible on the network.`);
        });

    } catch (error) {
        console.error('[Server] CRITICAL ERROR DURING STARTUP:', error);
        await prisma.$disconnect();
        (process as any).exit(1);
    }
};

console.log('[Server] Calling startServer()...');
startServer();