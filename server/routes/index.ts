import express from 'express';
import {} from '../types';
import { authRouter, authMiddleware } from '../auth';
import { mainRouter } from './main';
import { usersRouter } from './users';
import { clientsRouter } from './clients';
import { documentsRouter } from './documents';
import { invoicesRouter } from './invoices';
import { tasksRouter } from './tasks';
import { settingsRouter } from './settings';
import { employeesRouter } from './employees';
import { geminiRouter } from './gemini';
import { chatRouter } from './chat';


const router = express.Router();

// Public routes (login/logout)
router.use(authRouter);

// All subsequent routes are protected by the auth middleware
router.use(authMiddleware);

// Protected routes
router.use('/', mainRouter);
router.use('/users', usersRouter);
router.use('/clients', clientsRouter);
router.use('/documents', documentsRouter);
router.use('/invoices', invoicesRouter);
router.use('/tasks', tasksRouter);
router.use('/settings', settingsRouter);
router.use('/employees', employeesRouter);
router.use('/gemini', geminiRouter);
router.use('/chat', chatRouter);


export default router;