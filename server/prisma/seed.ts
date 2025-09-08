// @ts-ignore
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log(`Start seeding ...`);

  // Upsert AdminGeral user
  const adminGeral = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: '123456', // Reset password if user exists
    },
    create: {
      username: 'admin',
      password: '123456', // In a real app, you should hash this
      name: 'Admin Geral',
      email: 'admin@jzf.com.br',
      role: 'AdminGeral',
      canManageClients: true,
      canManageDocuments: true,
      canManageBilling: true,
      canManageAdmins: true,
      canManageSettings: true,
      canViewReports: true,
      canViewDashboard: true,
      canManageTasks: true,
    },
  });

  console.log(`Created/Updated AdminGeral user: ${adminGeral.username}`);

  // Upsert Settings
  const settings = await prisma.settings.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      pixKey: 'sua-chave-pix-aqui',
      paymentLink: 'https://seu-link-de-pagamento.com',
    },
  });

  console.log(`Created/Verified settings with ID: ${settings.id}`);

  console.log(`Seeding finished.`);
}

main()
  .catch((e) => {
    console.error(e);
    (process as any).exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });