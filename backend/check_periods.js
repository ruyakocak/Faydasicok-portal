const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const periods = await prisma.documentPeriod.findMany();
  console.log("All Periods:", periods.map(p => ({ id: p.id, label: p.label, type: p.type })));
  
  const forms = await prisma.volunteerForm.findMany({ select: { periodId: true } });
  console.log("Forms Period IDs:", forms);
}

run().finally(() => prisma.$disconnect());
