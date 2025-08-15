import { Router, Request, Response } from 'express';
import '../types';

const router = Router();

// Create employee
router.post('/', async (req: Request, res: Response) => {
    const { clientId, name, role, salary } = req.body;
    const newEmployee = await req.prisma.employee.create({
        data: {
            clientId,
            name,
            role,
            salary,
            status: 'Ativo',
        }
    });
    res.status(201).json(newEmployee);
});

// Update employee
router.put('/:id', async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id, 10);
    const { name, role, salary } = req.body;
    try {
        const updatedEmployee = await req.prisma.employee.update({
            where: { id: employeeId },
            data: { name, role, salary }
        });
        res.json(updatedEmployee);
    } catch (error) {
        res.status(404).json({ message: 'Funcionário não encontrado.' });
    }
});

// Inactivate employee (soft delete)
router.put('/:id/inactivate', async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id, 10);
    try {
        const inactivatedEmployee = await req.prisma.employee.update({
            where: { id: employeeId },
            data: { status: 'Inativo' }
        });
        res.json(inactivatedEmployee);
    } catch (error) {
        res.status(404).json({ message: 'Funcionário não encontrado.' });
    }
});

// Delete employee
router.delete('/:id', async (req: Request, res: Response) => {
    if (!req.user?.role.includes('Admin')) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const employeeId = parseInt(req.params.id, 10);
    try {
        await req.prisma.employee.delete({ where: { id: employeeId }});
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(404).json({ message: 'Funcionário não encontrado.' });
    }
});

// Save or update a timesheet
router.post('/timesheets', async (req: Request, res: Response) => {
    const { id: ignoredId, ...timeSheetData } = req.body;
    const { clientId, employeeId, month, year } = timeSheetData;
    
    try {
        const newTimeSheet = await req.prisma.timeSheet.upsert({
            where: { 
                clientId_employeeId_year_month: {
                    clientId, employeeId, year, month
                }
            },
            update: timeSheetData,
            create: timeSheetData,
        });
        res.status(201).json(newTimeSheet);
    } catch (error) {
        console.error("Timesheet error:", error);
        res.status(500).json({ message: "Erro ao salvar a folha de ponto." });
    }
});

export default router;