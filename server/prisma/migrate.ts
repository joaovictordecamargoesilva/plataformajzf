// server/prisma/migrate.ts
import { JSONFile } from 'lowdb/node';
import path from 'path';
const { PrismaClient } = require('@prisma/client');

// Define the shape of the old db.json data
interface OldDbSchema {
    users: any[];
    clients: any[];
    documents: any[];
    invoices: any[];
    payments: any[];
    tasks: any[];
    settings: any;
    notifications: any[];
    opportunities: any[];
    taskTemplateSets: any[];
    employees: any[];
    timeSheets: any[];
    documentTemplates: any[];
    complianceFindings: any[];
}

const prisma = new PrismaClient();
const file = path.join(__dirname, '..', 'db.json');
const adapter = new JSONFile<OldDbSchema>(file);

// Helper function to convert db.json string values to Prisma enum compatible values
const toPrismaEnum = (str: string | undefined): string | undefined => {
    if (!str) return str;
    // Replaces spaces, removes accents and special characters.
    // e.g. "Simples Nacional" -> "SimplesNacional"
    return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/ /g, "");
};


async function main() {
    console.log('Starting data migration from db.json to PostgreSQL...');

    try {
        const dbJsonData: OldDbSchema = await adapter.read();

        if (!dbJsonData) {
            console.log('db.json is empty or not found. No data to migrate.');
            return;
        }

        // --- Migrate Users ---
        console.log(`Migrating ${dbJsonData.users.length} users...`);
        for (const user of dbJsonData.users) {
            await prisma.user.upsert({
                where: { id: user.id },
                update: {
                    username: user.username,
                    password: user.password,
                    role: user.role, // UserRole enum names in Prisma match these strings already
                    name: user.name,
                    email: user.email,
                    permissions: user.permissions || {},
                    clientIds: user.clientIds || [],
                    activeClientId: user.activeClientId,
                },
                create: {
                    id: user.id,
                    username: user.username,
                    password: user.password,
                    role: user.role,
                    name: user.name,
                    email: user.email,
                    permissions: user.permissions || {},
                    clientIds: user.clientIds || [],
                    activeClientId: user.activeClientId,
                },
            });
        }

        // --- Migrate Clients ---
        console.log(`Migrating ${dbJsonData.clients.length} clients...`);
        for (const client of dbJsonData.clients) {
            await prisma.client.upsert({
                where: { id: client.id },
                update: {
                    name: client.name,
                    company: client.company,
                    email: client.email,
                    phone: client.phone,
                    status: toPrismaEnum(client.status),
                    userId: client.userId,
                    taxRegime: toPrismaEnum(client.taxRegime),
                    businessProfile: client.businessProfile || {},
                },
                create: {
                    id: client.id,
                    name: client.name,
                    company: client.company,
                    email: client.email,
                    phone: client.phone,
                    status: toPrismaEnum(client.status),
                    userId: client.userId,
                    taxRegime: toPrismaEnum(client.taxRegime),
                    businessProfile: client.businessProfile || {},
                },
            });
        }
        
        // --- Migrate Settings ---
        if (dbJsonData.settings) {
            console.log('Migrating settings...');
            await prisma.settings.upsert({
                where: { id: 1 },
                update: {
                    pixKey: dbJsonData.settings.pixKey,
                    paymentLink: dbJsonData.settings.paymentLink,
                },
                create: {
                    id: 1,
                    pixKey: dbJsonData.settings.pixKey,
                    paymentLink: dbJsonData.settings.paymentLink,
                },
            });
        }
        
        // --- Migrate Task Template Sets ---
        console.log(`Migrating ${dbJsonData.taskTemplateSets.length} task templates...`);
        for (const template of dbJsonData.taskTemplateSets) {
             await prisma.taskTemplateSet.upsert({
                where: { id: template.id },
                update: {
                    name: template.name,
                    taskDescriptions: template.taskDescriptions
                },
                create: {
                    id: template.id,
                    name: template.name,
                    taskDescriptions: template.taskDescriptions
                }
            });
        }
        
        // --- Migrate Document Templates ---
        console.log(`Migrating ${dbJsonData.documentTemplates.length} document templates...`);
        for (const template of dbJsonData.documentTemplates) {
            await prisma.documentTemplate.upsert({
                where: { id: template.id },
                update: {
                    name: template.name,
                    fields: template.fields || [],
                    fileConfig: template.fileConfig || {},
                    steps: template.steps || [],
                },
                create: {
                    id: template.id,
                    name: template.name,
                    fields: template.fields || [],
                    fileConfig: template.fileConfig || {},
                    steps: template.steps || [],
                },
            });
        }

        console.log('\nData migration completed successfully!');

    } catch (error) {
        console.error('An error occurred during data migration:', error);
        (process as any).exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();