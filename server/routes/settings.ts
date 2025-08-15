import { Router, Request, Response } from 'express';
import '../types';

const router = Router();

// Update general settings
router.put('/', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageSettings) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const newSettings = req.body;
    
    const updatedSettings = await req.prisma.settings.upsert({
        where: { id: 1 },
        update: newSettings,
        create: { id: 1, ...newSettings }
    });
    res.json(updatedSettings);
});

// Create task template
router.post('/task-templates', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageSettings) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { name, tasks } = req.body;
    const taskDescriptions = tasks.split('\n').filter((t: string) => t.trim() !== '');
    
    const newTemplate = await req.prisma.taskTemplateSet.create({
        data: {
            name,
            taskDescriptions,
        }
    });
    res.status(201).json(newTemplate);
});

// Delete task template
router.delete('/task-templates/:id', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageSettings) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;
    
    try {
        await req.prisma.taskTemplateSet.delete({ where: { id }});
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(404).json({ message: 'Modelo não encontrado.' });
    }
});

export default router;