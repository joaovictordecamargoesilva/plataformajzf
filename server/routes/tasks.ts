import { Router, Request, Response } from 'express';
import '../types';
import { TaskStatus } from '../types';

const router = Router();

// Create task
router.post('/', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageTasks) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { clientId, description, isRecurring, createdBy } = req.body;
    
    const newTask = await req.prisma.task.create({
        data: {
            clientId,
            description,
            status: 'Pendente',
            isRecurring,
            createdBy,
        }
    });
    res.status(201).json(newTask);
});

// Update task description
router.put('/:id', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageTasks) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const taskId = parseInt(req.params.id, 10);
    const { description } = req.body;

    try {
        const updatedTask = await req.prisma.task.update({
            where: { id: taskId },
            data: { description }
        });
        res.json(updatedTask);
    } catch (error) {
        res.status(404).json({ message: 'Tarefa não encontrada.' });
    }
});

// Update task status
router.put('/:id/status', async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id, 10);
    const { status } = req.body as { status: TaskStatus };

    try {
        const task = await req.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) {
            return res.status(404).json({ message: 'Tarefa não encontrada.' });
        }

        // Security check
        if (req.user?.role === 'Cliente' && !req.user.clientIds?.includes(task.clientId)) {
            return res.status(403).json({ message: 'Acesso negado a esta tarefa.' });
        }

        const updatedTask = await req.prisma.task.update({
            where: { id: taskId },
            data: { status }
        });
        res.json(updatedTask);
    } catch (error) {
         res.status(404).json({ message: 'Tarefa não encontrada.' });
    }
});

export default router;