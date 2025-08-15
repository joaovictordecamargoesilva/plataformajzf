import { Router, Request, Response } from 'express';
import '../types';
import { Signature, Document, User } from '../types';

const router = Router();

// NOTE: Prisma handles JSON fields automatically. No need to stringify/parse.

// Create a document request
router.post('/request', async (req: Request, res: Response) => {
    const { clientId, requestText, uploadedBy, source, description, file } = req.body;
    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name: requestText,
            type: file ? 'Outro' : 'Formulário',
            uploadedBy,
            source,
            status: 'Pendente',
            requestText,
            description,
            file: file || undefined
        }
    });
    res.status(201).json(newDoc);
});

// Admin sends a document
router.post('/send-from-admin', async (req: Request, res: Response) => {
    const { clientId, docName, fileContent, uploadedBy, signatoryIds } = req.body;

    const signatoryUsers = await req.prisma.user.findMany({
        where: { id: { in: (signatoryIds || []).map((id: string) => parseInt(id, 10)) } }
    });
    
    const requiredSignatories = signatoryUsers.map((user: User) => ({
        userId: user.id,
        name: user.name,
        status: 'pendente'
    }));

    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name: docName,
            type: 'PDF',
            uploadedBy,
            source: 'escritorio',
            status: requiredSignatories.length > 0 ? 'Aguardando Assinatura' : 'Recebido',
            file: {
                name: `${docName}.pdf`,
                type: 'application/pdf',
                content: fileContent
            },
            requiredSignatories: requiredSignatories,
            signatures: [],
        }
    });
    res.status(201).json(newDoc);
});

// Client sends a document from a template
router.post('/from-template', async (req: Request, res: Response) => {
    const { template, clientId, uploadedBy, formData, file } = req.body;
    
    let status: Document['status'] = 'Recebido';
    let workflow;

    if (template.id === 'rescisao-contrato' && formData.motivo_rescisao) {
        status = 'Aguardando Aprovação';
        workflow = { currentStep: 2, totalSteps: template.steps.length };
    }

    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name: template.name,
            type: 'Formulário',
            uploadedBy,
            source: 'cliente',
            status,
            templateId: template.id,
            formData,
            file: file || undefined,
            workflow: workflow || undefined
        }
    });
    res.status(201).json(newDoc);
});

// Client updates a document from a template (e.g., step 2)
router.put('/:id/from-template', async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    const { template, formData, file } = req.body;
    const docToUpdate = await req.prisma.document.findUnique({ where: { id: docId } });
    
    if (!docToUpdate) return res.status(404).json({ message: 'Document not found' });

    let newStatus = docToUpdate.status;
    if (template.id === 'rescisao-contrato') {
        newStatus = 'Recebido';
    }

    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: {
            formData: { ...(docToUpdate.formData as any), ...formData },
            file: file || docToUpdate.file,
            workflow: { ... (docToUpdate.workflow as any), currentStep: 2 },
            status: newStatus
        }
    });
    res.status(200).json(updatedDoc);
});

// Admin approves a document step
router.put('/:id/approve-step', async (req: Request, res: Response) => {
    if (!req.user?.role.includes('Admin')) return res.status(403).json({ message: 'Acesso negado.'});
    const docId = parseInt(req.params.id, 10);
    const docToUpdate = await req.prisma.document.findUnique({ where: { id: docId }});

    if (!docToUpdate) return res.status(404).json({ message: 'Document not found' });
    
    let newStatus = docToUpdate.status;
    if (docToUpdate.templateId === 'rescisao-contrato') {
        newStatus = 'Pendente Etapa 2';
    }
    
    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: { status: newStatus }
    });
    res.status(200).json(updatedDoc);
});

// User signs a document
router.put('/:id/sign', async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    const { signature, newPdfBytes } = req.body as { signature: Signature, newPdfBytes: string };
    
    const doc = await req.prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const updatedSignatures = [...(doc.signatures as any[] || []), signature];
    const updatedRequiredSignatories = (doc.requiredSignatories as any[] || []).map(s => 
        s.userId === req.user!.id ? { ...s, status: 'assinado' } : s
    );
    
    const allSigned = updatedRequiredSignatories.every(s => s.status === 'assinado');
    const newStatus = allSigned ? 'Revisado' : doc.status;

    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: {
            signatures: updatedSignatures,
            requiredSignatories: updatedRequiredSignatories,
            file: { ...(doc.file as any), content: newPdfBytes },
            status: newStatus
        }
    });

    res.status(200).json(updatedDoc);
});

// Quick Send a document
router.post('/quick-send', async (req: Request, res: Response) => {
    const { clientId, name, description, file, uploadedBy } = req.body;
    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name,
            description,
            type: 'Outro',
            uploadedBy,
            source: 'cliente',
            status: 'Recebido',
            file: file,
        }
    });
    res.status(201).json(newDoc);
});

// Simple Send document from Client
router.post('/simple-send', async (req: Request, res: Response) => {
    const { clientId, name, file, uploadedBy, description } = req.body;
    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name,
            description,
            type: 'Outro',
            uploadedBy,
            source: 'cliente',
            status: 'Recebido',
            file,
        }
    });
    res.status(201).json(newDoc);
});

export default router;