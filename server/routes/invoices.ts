import express, { Request, Response } from 'express';
import {} from '../types';
import { Invoice } from '../types';

const router = express.Router();

const toAppInvoice = (invoice: any): Invoice => ({
    id: invoice.id,
    clientId: invoice.clientId,
    description: invoice.description,
    amount: invoice.amount,
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status as 'Pendente' | 'Pago' | 'Atrasado',
    isRecurring: invoice.isRecurring,
    // The database schema uses 'boletoPdf' to store payment method JSON. Map it to paymentMethods.
    paymentMethods: invoice.boletoPdf ? JSON.parse(invoice.boletoPdf) : null,
});

// Get invoice updates since a specific time
const getInvoiceUpdates = async (req: Request, res: Response) => {
    const { since } = req.query;
    const user = req.user!;

    if (!since || typeof since !== 'string') {
        return res.status(400).json({ message: 'O parâmetro "since" é obrigatório.' });
    }

    try {
        const sinceDate = new Date(since as string);
        if (isNaN(sinceDate.getTime())) {
            return res.status(400).json({ message: 'Formato de data inválido para "since".' });
        }
        
        const whereClause: any = {
            // A better check would be on an `updatedAt` field, but we use dueDate as a proxy
            dueDate: { 
                gt: sinceDate 
            }
        };

        if (user.role === 'Cliente') {
            whereClause.clientId = {
                in: user.clientIds
            };
        }

        const newInvoices = await req.prisma.invoice.findMany({
            where: whereClause,
            orderBy: { dueDate: 'desc' }
        });

        res.json(newInvoices.map(toAppInvoice));

    } catch(error) {
        console.error("Error fetching invoice updates:", error);
        res.status(500).json({ message: 'Erro ao buscar atualizações de faturas.' });
    }
};


// Create invoice(s)
const createInvoice = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { clientId, description, amount, dueDate, isRecurring, paymentMethods } = req.body;
    
    const invoiceData = {
        clientId: Number(clientId),
        description,
        amount: parseFloat(amount),
        dueDate: new Date(dueDate),
        status: 'Pendente' as const,
        isRecurring,
        // The database schema uses 'boletoPdf' to store payment method JSON.
        boletoPdf: paymentMethods ? JSON.stringify(paymentMethods) : null,
    };

    const newInvoice = await req.prisma.invoice.create({
        data: invoiceData,
    });

    const notificationMessage = isRecurring 
        ? `Um novo modelo de cobrança recorrente foi criado para sua empresa: ${description}.`
        : `Uma nova fatura foi gerada para sua empresa: ${description}.`;
    
    res.status(201).json({ invoicesToAdd: [toAppInvoice(newInvoice)], notificationMessage, clientId: Number(clientId) });
};

// Update invoice amount
const updateInvoiceAmount = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;
    const { amount } = req.body;

    try {
        const updatedInvoice = await req.prisma.invoice.update({
            where: { id },
            data: { amount: parseFloat(amount) }
        });
        res.json(toAppInvoice(updatedInvoice));
    } catch(error) {
        res.status(404).json({ message: 'Fatura não encontrada.' });
    }
};

// Update invoice status
const updateInvoiceStatus = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;
    const { status } = req.body as { status: 'Pendente' | 'Pago' | 'Atrasado' };

    if (!['Pendente', 'Pago', 'Atrasado'].includes(status)) {
        return res.status(400).json({ message: 'Status inválido fornecido.' });
    }

    try {
        const updatedInvoice = await req.prisma.invoice.update({
            where: { id },
            data: { status }
        });
        res.json(toAppInvoice(updatedInvoice));
    } catch(error: any) {
        if (error.code === 'P2025') { // Prisma record to update not found
             return res.status(404).json({ message: 'Fatura não encontrada.' });
        }
        console.error("Failed to update invoice status:", error);
        res.status(500).json({ message: 'Erro ao atualizar o status da fatura.' });
    }
};


// Delete invoice
const deleteInvoice = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;

    try {
        await req.prisma.invoice.delete({
            where: { id },
        });
        res.status(200).json({ success: true });
    } catch (error: any) {
        if (error.code === 'P2025') { // Prisma record to delete not found
             return res.status(404).json({ message: 'Fatura não encontrada.' });
        }
        console.error("Failed to delete invoice:", error);
        res.status(500).json({ message: 'Erro ao excluir a fatura.' });
    }
};

router.get('/updates', getInvoiceUpdates);
router.post('/', createInvoice);
router.put('/:id/amount', updateInvoiceAmount);
router.put('/:id/status', updateInvoiceStatus);
router.delete('/:id', deleteInvoice);

export { router as invoicesRouter };