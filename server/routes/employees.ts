import express, { Request, Response } from 'express';
import {} from '../types';
import { Employee, TimeSheet } from '../types';

const router = express.Router();

const safeJsonParse = <T>(jsonString: string | null | undefined, defaultValue: T): T => {
    if (jsonString === null || jsonString === undefined) {
        return defaultValue;
    }
    if (typeof jsonString === 'object') {
        return jsonString as T;
    }
    try {
        if (typeof jsonString !== 'string') {
            return defaultValue;
        }
        return JSON.parse(jsonString) as T;
    } catch (e) {
        return defaultValue;
    }
};

const toAppTimeSheet = (ts: any): TimeSheet => ({
    ...ts,
    sourceFile: safeJsonParse(ts.sourceFile, null),
    status: ts.status as any,
    aiAnalysisNotes: ts.aiAnalysisNotes ?? undefined,
});

// Create employee
const createEmployee = async (req: Request, res: Response) => {
    const employeeData = req.body as Omit<Employee, 'id' | 'status'>;
    const newEmployee = await req.prisma.employee.create({
        data: {
            ...employeeData,
            status: 'Ativo'
        }
    });
    res.status(201).json({ ...newEmployee, cbo: newEmployee.cbo ?? undefined });
};

// Create employees in batch
const createEmployeesBatch = async (req: Request, res: Response) => {
    const { clientId, employees } = req.body as { clientId: number, employees: Omit<Employee, 'id' | 'status' | 'clientId'>[] };

    // Explicitly map the data to ensure correct types and prevent TS2322 error
    const employeesData = employees.map(emp => ({
        clientId: Number(clientId),
        name: emp.name,
        role: emp.role,
        status: 'Ativo' as 'Ativo' | 'Inativo',
        salary: Number(emp.salary),
        cbo: emp.cbo || undefined,
    }));

    await req.prisma.employee.createMany({
        data: employeesData,
    });
    
    // Return the full updated list for the client as per frontend expectation
    const allClientEmployees = await req.prisma.employee.findMany({
        where: { clientId: Number(clientId) }
    });

    res.status(201).json(allClientEmployees.map((e: any) => ({ ...e, cbo: e.cbo ?? undefined })));
};

// Update employee
const updateEmployee = async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id, 10);
    const employeeData = req.body as Omit<Employee, 'id' | 'status'>;

    const updatedEmployee = await req.prisma.employee.update({
        where: { id: employeeId },
        data: employeeData,
    });
    res.json({ ...updatedEmployee, cbo: updatedEmployee.cbo ?? undefined });
};

// Inactivate employee
const inactivateEmployee = async (req: Request, res: Response) => {
    const employeeId = parseInt(req.params.id, 10);
    const updatedEmployee = await req.prisma.employee.update({
        where: { id: employeeId },
        data: { status: 'Inativo' },
    });
    res.json({ ...updatedEmployee, cbo: updatedEmployee.cbo ?? undefined });
};

// Save timesheet
const saveTimeSheet = async (req: Request, res: Response) => {
    const data = req.body as Omit<TimeSheet, 'id'>;
    const timeSheetId = `FP-${data.clientId}-${data.employeeId}-${data.year}-${data.month}`;

    const upsertedTimeSheet = await req.prisma.timeSheet.upsert({
        where: { id: timeSheetId },
        update: { ...data, sourceFile: JSON.stringify(data.sourceFile) },
        create: { ...data, id: timeSheetId, sourceFile: JSON.stringify(data.sourceFile) },
    });
    res.status(201).json(toAppTimeSheet(upsertedTimeSheet));
};

router.post('/', createEmployee);
router.post('/batch', createEmployeesBatch);
router.put('/:id', updateEmployee);
router.put('/:id/inactivate', inactivateEmployee);
router.post('/timesheets', saveTimeSheet);

export { router as employeesRouter };