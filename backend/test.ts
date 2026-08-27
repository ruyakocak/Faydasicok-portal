import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.studentProfile.findFirst().then(console.log).catch(console.error).finally(() => prisma.$disconnect());
