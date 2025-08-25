import '../types';
import { type Request, type Response, Router } from 'express';
import { Invoice } from '../types';

const router = Router();

const toAppInvoice = (invoice: any): Invoice => ({
    ...invoice,
    dueDate: invoice.dueDate.toISOString(),
    status: invoice.status as any,
});

// Create invoice(s)
const createInvoice = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { clientId, description, amount, dueDate, isRecurring } = req.body;
    
    const newInvoice = await req.prisma.invoice.create({
        data: {
            clientId: Number(clientId),
            description,
            amount: parseFloat(amount),
            dueDate: new Date(dueDate),
            status: 'Pendente',
            isRecurring,
        }
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

// Delete invoice
const deleteInvoice = async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;
    
    try {
        await req.prisma.invoice.delete({ where: { id } });
        res.status(200).json({ success: true });
    } catch(error) {
        res.status(404).json({ message: 'Fatura não encontrada.' });
    }
};

router.post('/', createInvoice);
router.put('/:id/amount', updateInvoiceAmount);
router.delete('/:id', deleteInvoice);

export { router as invoicesRouter };