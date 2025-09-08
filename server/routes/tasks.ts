import express, { Request, Response } from 'express';
import {} from '../types';
import { Task, TaskStatus } from '../types';

const router = express.Router();

const toAppTask = (task: any): Task => ({
    ...task,
    creationDate: task.creationDate.toISOString(),
    status: task.status as any
});

// Create task
const createTask = async (req: Request, res: Response) => {
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
    
    res.status(201).json(toAppTask(newTask));
};

// Update task description
const updateTask = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageTasks) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const taskId = parseInt(req.params.id, 10);
    const { description } = req.body;
    
    try {
        const updatedTask = await req.prisma.task.update({
            where: { id: taskId },
            data: { description },
        });
        res.json(toAppTask(updatedTask));
    } catch (error) {
        res.status(404).json({ message: 'Tarefa não encontrada.' });
    }
};

// Update task status
const updateTaskStatus = async (req: Request, res: Response) => {
    const taskId = parseInt(req.params.id, 10);
    const { status } = req.body as { status: TaskStatus };
    
    const task = await req.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
        return res.status(404).json({ message: 'Tarefa não encontrada.' });
    }

    if (req.user?.role === 'Cliente' && !req.user.clientIds?.includes(task.clientId)) {
        return res.status(403).json({ message: 'Acesso negado a esta tarefa.' });
    }
    
    const updatedTask = await req.prisma.task.update({
        where: { id: taskId },
        data: { status }
    });
    res.json(toAppTask(updatedTask));
};

// Delete a task
const deleteTask = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageTasks) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const taskId = parseInt(req.params.id, 10);
    try {
        await req.prisma.task.delete({
            where: { id: taskId },
        });
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(404).json({ message: 'Tarefa não encontrada.' });
    }
};

router.post('/', createTask);
router.put('/:id', updateTask);
router.put('/:id/status', updateTaskStatus);
router.delete('/:id', deleteTask);

export { router as tasksRouter };