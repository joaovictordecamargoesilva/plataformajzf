import '../types';
import { type Request, type Response, Router } from 'express';

const router = Router();

const parseStringToArray = (input: any): string[] => {
    if (typeof input === 'string') return input.split('\n').map(item => item.trim()).filter(Boolean);
    return [];
};

// Update general settings
const updateSettings = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageSettings) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { pixKey, paymentLink } = req.body;
    const updatedSettings = await req.prisma.settings.upsert({
        where: { id: 1 },
        update: { pixKey, paymentLink },
        create: { id: 1, pixKey, paymentLink },
    });
    res.json(updatedSettings);
};

// Create task template
const createTaskTemplate = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageSettings) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { name, tasks } = req.body;
    
    const newTemplate = await req.prisma.taskTemplateSet.create({
        data: {
            name,
            taskDescriptions: parseStringToArray(tasks),
        }
    });
    res.status(201).json({ ...newTemplate, taskDescriptions: parseStringToArray(newTemplate.taskDescriptions) });
};

// Delete task template
const deleteTaskTemplate = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageSettings) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;
    
    try {
        await req.prisma.taskTemplateSet.delete({ where: { id } });
        res.status(200).json({ success: true });
    } catch(error) {
        res.status(404).json({ message: 'Modelo não encontrado.' });
    }
};

router.put('/', updateSettings);
router.post('/task-templates', createTaskTemplate);
router.delete('/task-templates/:id', deleteTaskTemplate);

export { router as settingsRouter };