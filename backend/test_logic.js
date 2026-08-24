const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const periods = await prisma.documentPeriod.findMany();
  const docTypes = await prisma.documentTypeConfig.findMany({ where: { isActive: true } });
  
  const periodicDocTypes = docTypes.filter(d => d.isStatic !== true);
  
  const result = periodicDocTypes.flatMap(dt => {
    const typePeriods = periods.filter(p => p.type === dt.code);
    
    const periodsToDisplayMap = new Map();
    typePeriods.forEach(p => {
      if (p.isOpen) periodsToDisplayMap.set(p.id, p);
    });
    
    const items = [];
    Array.from(periodsToDisplayMap.values()).forEach(p => {
      items.push({ dtName: dt.name, periodLabel: p.label });
    });
    return items;
  });
  
  console.log(result);
}
main().finally(() => prisma.$disconnect());
