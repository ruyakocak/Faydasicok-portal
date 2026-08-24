const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const periods = await prisma.documentPeriod.findMany({
    select: { id: true, type: true, label: true, isOpen: true }
  });
  console.dir(periods, { depth: null });
}

main().finally(() => prisma.$disconnect());
