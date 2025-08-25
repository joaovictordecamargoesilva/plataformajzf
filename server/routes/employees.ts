import '../types';
import { type Request, type Response, Router } from 'express';
import { TimeSheet } from '../types';

const router = Router();

const toAppTimeSheet = (ts: any): TimeSheet => ({
    ...ts,
    sourceFile: ts.sourceFile as any,
    status: ts.status as any,
    aiAnalysisNotes: ts.aiAnalysisNotes ?? undefined,
})

// Create employee
const createEmployee = async (req: Request, res: Response) => {
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
};

// Update employee
const updateEmployee = async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id, 10);
    const { name, role, salary } = req.body;
    
    try {
        const updatedEmployee = await req.prisma.employee.update({
            where: { id: employeeId },
            data: { name, role, salary }
        });
        res.json(updatedEmployee);
    } catch(error) {
        res.status(404).json({ message: 'Funcionário não encontrado.' });
    }
};

// Inactivate an employee
const inactivateEmployee = async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id, 10);
    try {
        const updatedEmployee = await req.prisma.employee.update({
            where: { id: employeeId },
            data: { status: 'Inativo' }
        });
        res.json(updatedEmployee);
    } catch(error) {
        res.status(404).json({ message: 'Funcionário não encontrado.' });
    }
};


// Save or update a timesheet
const saveTimeSheet = async (req: Request, res: Response) => {
    const timeSheetData: Omit<TimeSheet, 'id'> = req.body;
    const { clientId, employeeId, month, year, ...dataToSave } = timeSheetData;
    
    const uniqueIdentifier = {
        employeeId_clientId_year_month: {
            employeeId,
            clientId,
            year,
            month
        }
    };

    const newTimeSheet = await req.prisma.timeSheet.upsert({
        where: uniqueIdentifier as any,
        update: { ...dataToSave, status: dataToSave.status as any, sourceFile: dataToSave.sourceFile ?? undefined },
        create: { ...timeSheetData, status: timeSheetData.status as any, sourceFile: dataToSave.sourceFile ?? undefined },
    });
    res.status(201).json(toAppTimeSheet(newTimeSheet));
};

router.post('/', createEmployee);
router.put('/:id', updateEmployee);
router.put('/:id/inactivate', inactivateEmployee);
router.post('/timesheets', saveTimeSheet);

export { router as employeesRouter };