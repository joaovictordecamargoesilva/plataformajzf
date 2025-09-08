import express, { Request, Response } from 'express';
import {} from '../types';
import { Document, Signature, DocumentStatus } from '../types';

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

const toAppDoc = (doc: any): Document => ({
    ...doc,
    uploadDate: doc.uploadDate.toISOString(),
    file: safeJsonParse(doc.file, null),
    formData: safeJsonParse(doc.formData, null),
    workflow: safeJsonParse(doc.workflow, null),
    signatures: (doc.signatures || []).map((s: any) => ({...s, id: String(s.id), date: s.date.toISOString(), auditTrail: safeJsonParse(s.auditTrail, {})})),
    requiredSignatories: (doc.requiredSignatories || []).map((rs: any) => ({ ...rs, id: String(rs.id), status: rs.status as 'pendente' | 'assinado' })),
    aiAnalysis: safeJsonParse(doc.aiAnalysis, null),
    auditLog: (doc.auditLog || []).map((l: any) => ({...l, id: String(l.id), date: l.date.toISOString()})),
    type: doc.type as any,
    source: doc.source as any,
    status: doc.status as any,
    description: doc.description ?? undefined,
    requestText: doc.requestText ?? undefined,
    templateId: doc.templateId ?? undefined,
});

// Get document updates since a specific time
const getDocumentUpdates = async (req: Request, res: Response) => {
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
            uploadDate: {
                gt: sinceDate
            }
        };

        if (user.role === 'Cliente') {
            whereClause.clientId = {
                in: user.clientIds
            };
        }

        const newDocs = await req.prisma.document.findMany({
            where: whereClause,
            include: { signatures: true, requiredSignatories: true, auditLog: true },
            orderBy: { uploadDate: 'desc' }
        });

        res.json(newDocs.map(toAppDoc));

    } catch(error) {
        console.error("Error fetching document updates:", error);
        res.status(500).json({ message: 'Erro ao buscar atualizações de documentos.' });
    }
};


// Update document status
const updateDocumentStatus = async (req: Request, res: Response) => {
    if (!req.user?.role.includes('Admin')) {
        return res.status(403).json({ message: 'Acesso negado.' });
    }
    const docId = parseInt(req.params.id, 10);
    const { status } = req.body as { status: DocumentStatus };

    const validStatuses: DocumentStatus[] = ['Pendente', 'Recebido', 'Revisado', 'AguardandoAssinatura', 'AguardandoAprovacao', 'PendenteEtapa2', 'Concluido'];

    if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: 'Status inválido fornecido.' });
    }

    try {
        await req.prisma.$transaction(async (prisma: any) => {
            await prisma.document.update({
                where: { id: docId },
                data: { status }
            });
            await prisma.auditLog.create({
                data: {
                    documentId: docId,
                    user: req.user!.name,
                    action: `Status alterado para "${status}"`
                }
            });
        });

        const updatedDoc = await req.prisma.document.findUnique({
            where: { id: docId },
            include: { signatures: true, requiredSignatories: true, auditLog: true }
        });

        res.status(200).json(toAppDoc(updatedDoc));
    } catch (error: any) {
        if (error.code === 'P2025') { // Prisma record to update not found
            return res.status(404).json({ message: 'Documento não encontrado.' });
        }
        console.error("Error updating document status:", error);
        res.status(500).json({ message: 'Erro ao atualizar o status do documento.' });
    }
};

// Create a document request
const createDocumentRequest = async (req: Request, res: Response) => {
    const { clientId, requestText, uploadedBy, source, description } = req.body;
    
    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name: requestText,
            description,
            type: 'Outro',
            uploadedBy,
            source,
            status: 'Pendente',
            requestText,
        },
        include: { auditLog: true, signatures: true, requiredSignatories: true }
    });

    // Add initial creation log
     await req.prisma.auditLog.create({
        data: {
            documentId: newDoc.id,
            user: uploadedBy,
            action: `Documento solicitado/criado.`
        }
    });

    const docWithLog = await req.prisma.document.findUnique({ where: { id: newDoc.id }, include: { auditLog: true, signatures: true, requiredSignatories: true } });

    res.status(201).json(toAppDoc(docWithLog));
};

// Admin sends a document
const sendFromAdmin = async (req: Request, res: Response) => {
    const { clientId, docName, fileContent, uploadedBy, signatoryIds } = req.body;
    
    const users = await req.prisma.user.findMany({ where: { id: { in: (signatoryIds || []).map((id:string) => parseInt(id)) } } });

    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name: docName,
            type: 'PDF',
            uploadedBy,
            source: 'escritorio',
            status: users.length > 0 ? 'AguardandoAssinatura' : 'Recebido',
            file: JSON.stringify({
                name: `${docName}.pdf`,
                type: 'application/pdf',
                content: fileContent
            }),
            requiredSignatories: {
                create: users.map((user: any) => ({
                    userId: user.id,
                    name: user.name, // denormalized name
                    status: 'pendente'
                }))
            },
            auditLog: {
                create: { user: uploadedBy, action: 'Documento enviado pelo escritório.' }
            }
        },
        include: { requiredSignatories: true, auditLog: true, signatures: true }
    });
    
    res.status(201).json(toAppDoc(newDoc));
};

// Client sends a document from a template
const createFromTemplate = async (req: Request, res: Response) => {
    const { template, clientId, uploadedBy, formData, file } = req.body;
    
    let status: Document['status'] = 'Recebido';
    let workflow = null;
    let auditLogAction = `Documento "${template.name}" enviado pelo cliente.`;
    
    if (template.id === 'rescisao-contrato') {
        status = 'AguardandoAprovacao';
        workflow = { currentStep: 1, totalSteps: 2 };
        auditLogAction = `Etapa 1 do documento "${template.name}" enviada pelo cliente.`;
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
            formData: formData ? JSON.stringify(formData) : null,
            file: file ? JSON.stringify(file) : null,
            workflow: workflow ? JSON.stringify(workflow) : null,
            auditLog: {
                create: { user: uploadedBy, action: auditLogAction }
            }
        },
        include: { auditLog: true, signatures: true, requiredSignatories: true }
    });
    
    res.status(201).json(toAppDoc(newDoc));
};

// Client updates a document from a template (e.g., step 2)
const updateFromTemplate = async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    const { template, formData, file } = req.body;
    
    const docToUpdate = await req.prisma.document.findUnique({ where: { id: docId } });
    if (!docToUpdate) return res.status(404).json({ message: 'Document not found' });

    const existingFormData = safeJsonParse(docToUpdate.formData, {});
    const combinedFormData = { ...existingFormData, ...formData };

    let status: DocumentStatus = 'Recebido';
    let workflow = docToUpdate.workflow ? safeJsonParse<{ currentStep: number, totalSteps: number } | null>(docToUpdate.workflow, null) : null;
    if (workflow) {
        workflow.currentStep += 1;
        if (workflow.currentStep >= workflow.totalSteps) {
            status = 'Recebido'; // Final step completion
        } else {
            status = docToUpdate.status as DocumentStatus; // Keep current status if more steps remain
        }
    }

    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: {
            formData: JSON.stringify(combinedFormData),
            file: file ? JSON.stringify(file) : docToUpdate.file,
            workflow: workflow ? JSON.stringify(workflow) : null,
            status,
            auditLog: {
                create: { user: req.user!.name, action: `Etapa ${workflow?.currentStep || ''} do documento "${template.name}" enviada.` }
            }
        },
        include: { auditLog: true, signatures: true, requiredSignatories: true }
    });
    
    res.json(toAppDoc(updatedDoc));
};

const approveDocumentStep = async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    
    const doc = await req.prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.status !== 'AguardandoAprovacao') return res.status(400).json({ message: 'Document not in correct state to approve' });

    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: {
            status: 'PendenteEtapa2',
            auditLog: {
                create: { user: req.user!.name, action: 'Etapa 1 aprovada.' }
            }
        },
        include: { auditLog: true, signatures: true, requiredSignatories: true }
    });

    res.json(toAppDoc(updatedDoc));
};

const signDocument = async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    const { signature, newPdfBytes } = req.body;

    const doc = await req.prisma.document.findUnique({ where: { id: docId }, include: { requiredSignatories: true } });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const updatedRequiredSignatories = doc.requiredSignatories.map((rs: any) => 
        rs.userId === req.user!.id ? { ...rs, status: 'assinado' } : rs
    );

    const allSigned = updatedRequiredSignatories.every((rs: any) => rs.status === 'assinado');

    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: {
            file: JSON.stringify({ name: safeJsonParse(doc.file, {name: 'document.pdf'}).name, type: 'application/pdf', content: newPdfBytes }),
            status: allSigned ? 'Concluido' : 'AguardandoAssinatura',
            signatures: { create: signature },
            requiredSignatories: {
                updateMany: {
                    where: { userId: req.user!.id },
                    data: { status: 'assinado' }
                }
            },
            auditLog: { create: { user: req.user!.name, action: 'Documento assinado digitalmente.' } }
        },
        include: { auditLog: true, signatures: true, requiredSignatories: true }
    });

    res.json(toAppDoc(updatedDoc));
};

// Admin's quick send (scanned docs)
const createQuickSend = async (req: Request, res: Response) => {
     const { clientId, name, description, file, uploadedBy } = req.body;
     const newDoc = await req.prisma.document.create({
         data: {
            clientId,
            name,
            description,
            type: 'PDF',
            uploadedBy,
            source: 'cliente',
            status: 'Recebido',
            file: file ? JSON.stringify(file) : null,
            auditLog: { create: { user: uploadedBy, action: 'Documento enviado via "Envio Rápido".' } }
         },
        include: { auditLog: true, signatures: true, requiredSignatories: true }
     });
     res.status(201).json(toAppDoc(newDoc));
}

router.get('/updates', getDocumentUpdates);
router.put('/:id/status', updateDocumentStatus);
router.post('/request', createDocumentRequest);
router.post('/send-from-admin', sendFromAdmin);
router.post('/from-template', createFromTemplate);
router.put('/:id/from-template', updateFromTemplate);
router.put('/:id/approve-step', approveDocumentStep);
router.put('/:id/sign', signDocument);
router.post('/quick-send', createQuickSend);

export { router as documentsRouter };