import '../types';
import { type Request, type Response, Router } from 'express';
import { Prisma, User as PrismaUser, Signature as PrismaSignature, RequiredSignatory as PrismaRequiredSignatory, AuditLog as PrismaAuditLog } from '.prisma/client';
import { Document, Signature } from '../types';

const router = Router();

const toAppDoc = (doc: any): Document => ({
    ...doc,
    uploadDate: doc.uploadDate.toISOString(),
    file: doc.file as any,
    formData: doc.formData as any,
    workflow: doc.workflow as any,
    signatures: (doc.signatures || []).map((s: PrismaSignature) => ({...s, id: String(s.id), date: s.date.toISOString(), auditTrail: s.auditTrail as any})),
    requiredSignatories: (doc.requiredSignatories || []).map((rs: PrismaRequiredSignatory) => ({ ...rs, id: String(rs.id), status: rs.status as 'pendente' | 'assinado' })),
    aiAnalysis: doc.aiAnalysis as any,
    auditLog: (doc.auditLog || []).map((l: PrismaAuditLog) => ({...l, id: String(l.id), date: l.date.toISOString()})),
    type: doc.type as any,
    source: doc.source as any,
    status: doc.status as any,
    description: doc.description ?? undefined,
    requestText: doc.requestText ?? undefined,
    templateId: doc.templateId ?? undefined,
});

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
        }
    });

    res.status(201).json(toAppDoc(newDoc));
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
            file: {
                name: `${docName}.pdf`,
                type: 'application/pdf',
                content: fileContent
            },
            requiredSignatories: {
                create: users.map((user: PrismaUser) => ({
                    userId: user.id,
                    name: user.name, // denormalized name
                    status: 'pendente'
                }))
            },
        },
        include: { requiredSignatories: true }
    });
    
    res.status(201).json(toAppDoc(newDoc));
};

// Client sends a document from a template
const createFromTemplate = async (req: Request, res: Response) => {
    const { template, clientId, uploadedBy, formData, file } = req.body;
    
    let status: Document['status'] = 'Recebido';
    let workflow;

    if (template.id === 'rescisao-contrato' && formData.motivo_rescisao) {
        status = 'AguardandoAprovacao';
        workflow = { currentStep: 1, totalSteps: template.steps?.length };
    }

    const newDoc = await req.prisma.document.create({
        data: {
            clientId,
            name: template.name,
            type: 'Formulario',
            uploadedBy,
            source: 'cliente',
            status,
            templateId: template.id,
            formData: formData,
            file: file ?? Prisma.JsonNull,
            workflow: workflow
        }
    });
    
    res.status(201).json(toAppDoc(newDoc));
};

// Client updates a document from a template (e.g., step 2)
const updateFromTemplate = async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    const { template, formData, file } = req.body;
    
    const docToUpdate = await req.prisma.document.findUnique({ where: { id: docId } });
    if (!docToUpdate) return res.status(404).json({ message: 'Document not found' });

    const newFormData = { ...(docToUpdate.formData as object || {}), ...formData };

    const dataToUpdate: Prisma.DocumentUpdateInput = {
        formData: newFormData,
        file: file ?? Prisma.JsonNull,
        status: docToUpdate.status as any,
        workflow: docToUpdate.workflow as any
    };

    if (template.id === 'rescisao-contrato') {
        dataToUpdate.status = 'Recebido';
        dataToUpdate.workflow = { currentStep: 2, totalSteps: (template.steps?.length || 2) };
    }

    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: dataToUpdate,
    });

    res.status(200).json(toAppDoc(updatedDoc));
};

// Admin approves a document step
const approveStep = async (req: Request, res: Response) => {
    if (!req.user?.role.includes('Admin')) return res.status(403).json({ message: 'Acesso negado.'});
    const docId = parseInt(req.params.id, 10);
    
    const updatedDoc = await req.prisma.document.update({
        where: { id: docId },
        data: { status: 'PendenteEtapa2' }
    });

    res.status(200).json(toAppDoc(updatedDoc));
};

// User signs a document
const signDocument = async (req: Request, res: Response) => {
    const docId = parseInt(req.params.id, 10);
    const { signature, newPdfBytes } = req.body as { signature: Omit<Signature, 'id'|'documentId'>, newPdfBytes: string };
    
    const doc = await req.prisma.document.findUnique({ 
        where: { id: docId },
        include: { requiredSignatories: true }
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    await req.prisma.$transaction(async (prisma: any) => {
        await prisma.signature.create({
            data: {
                documentId: docId,
                userId: req.user!.id,
                date: new Date(signature.date),
                signatureId: signature.signatureId,
                auditTrail: signature.auditTrail as any
            }
        });

        await prisma.requiredSignatory.updateMany({
            where: { documentId: docId, userId: req.user!.id },
            data: { status: 'assinado' }
        });

        const updatedRequiredSignatories = await prisma.requiredSignatory.findMany({
            where: { documentId: docId }
        });
        const allSigned = updatedRequiredSignatories.every((s: PrismaRequiredSignatory) => s.status === 'assinado');

        const currentFile = doc.file as any;
        
        await prisma.document.update({
            where: { id: docId },
            data: {
                status: allSigned ? 'Revisado' : doc.status,
                file: { ...currentFile, content: newPdfBytes }
            }
        });
    });

    const updatedDocWithRelations = await req.prisma.document.findUnique({
        where: {id: docId },
        include: { signatures: true, requiredSignatories: true, auditLog: true }
    });

    res.status(200).json(toAppDoc(updatedDocWithRelations));
};


// Quick Send a document
const quickSend = async (req: Request, res: Response) => {
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
            file: file ?? Prisma.JsonNull,
        }
    });
    res.status(201).json(toAppDoc(newDoc));
};

router.post('/request', createDocumentRequest);
router.post('/send-from-admin', sendFromAdmin);
router.post('/from-template', createFromTemplate);
router.put('/:id/from-template', updateFromTemplate);
router.put('/:id/approve-step', approveStep);
router.put('/:id/sign', signDocument);
router.post('/quick-send', quickSend);

export { router as documentsRouter };