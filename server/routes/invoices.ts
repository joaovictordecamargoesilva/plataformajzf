import { Router, Request, Response } from 'express';
import '../types';

const router = Router();

// Create invoice(s)
router.post('/', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { clientId, description, amount, dueDate, isRecurring } = req.body;
    
    try {
        const newInvoice = await req.prisma.invoice.create({
            data: {
                clientId: parseInt(clientId, 10),
                description,
                amount: parseFloat(amount),
                dueDate: new Date(dueDate),
                status: 'Pendente',
                recurring: { isRecurring }
            }
        });
        
        const notificationMessage = isRecurring 
            ? `Um novo modelo de cobrança recorrente foi criado para sua empresa: ${description}.`
            : `Uma nova fatura foi gerada para sua empresa: ${description}.`;

        res.status(201).json({ invoicesToAdd: [newInvoice], notificationMessage, clientId: parseInt(clientId, 10) });

    } catch (error) {
        console.error("Invoice creation error:", error);
        res.status(500).json({ message: 'Erro ao criar fatura.'});
    }
});

// Update invoice amount
router.put('/:id/amount', async (req: Request, res: Response) => {
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
        res.json(updatedInvoice);
    } catch (error) {
        res.status(404).json({ message: 'Fatura não encontrada.' });
    }
});

// Delete invoice
router.delete('/:id', async (req: Request, res: Response) => {
    if (req.user?.role !== 'AdminGeral' && !req.user?.permissions?.canManageBilling) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const { id } = req.params;
    
    try {
        await req.prisma.invoice.delete({ where: { id }});
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(404).json({ message: 'Fatura não encontrada.' });
    }
});

export default router;