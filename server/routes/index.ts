

import { Router } from 'express';
import '../types';
import { loginHandler, logoutHandler, authMiddleware } from '../auth';
import mainRouter from './main';
import usersRouter from './users';
import clientsRouter from './clients';
import documentsRouter from './documents';
import invoicesRouter from './invoices';
import tasksRouter from './tasks';
import settingsRouter from './settings';
import employeesRouter from './employees';
import geminiRouter from './gemini';
import chatRouter from './chat';


const router = Router();

// Public routes
router.post('/login', loginHandler);
router.post('/logout', logoutHandler);

// Protected routes from here on
router.use('/', authMiddleware, mainRouter);
router.use('/users', authMiddleware, usersRouter);
router.use('/clients', authMiddleware, clientsRouter);
router.use('/documents', authMiddleware, documentsRouter);
router.use('/invoices', authMiddleware, invoicesRouter);
router.use('/tasks', authMiddleware, tasksRouter);
router.use('/settings', authMiddleware, settingsRouter);
router.use('/employees', authMiddleware, employeesRouter);
router.use('/gemini', authMiddleware, geminiRouter);
router.use('/chat', authMiddleware, chatRouter);


export default router;