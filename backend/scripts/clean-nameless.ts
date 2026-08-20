import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const students = await prisma.studentProfile.findMany({
    include: {
      user: true,
    },
  });

  const nameless = students.filter(s => {
    const fn = (s.firstName || '').trim();
    const ln = (s.lastName || '').trim();
    return fn === '' && ln === '';
  });

  console.log(`Found ${nameless.length} students without first/last name.`);

  for (const s of nameless) {
    console.log(`Cleaning child records for student ${s.id} (TC: ${s.user.tcKimlikNo || 'N/A'}, userId: ${s.userId})`);

    // Clean ApprovableChanges
    await prisma.approvableChange.deleteMany({
      where: {
        OR: [
          { studentProfileId: s.id },
          { changedById: s.userId },
          { approvedById: s.userId },
        ],
      },
    });

    // Clean Documents
    await prisma.document.deleteMany({
      where: { studentProfileId: s.id },
    });

    // Clean VolunteerForms
    await prisma.volunteerForm.deleteMany({
      where: { studentProfileId: s.id },
    });

    // Clean Notes
    await prisma.note.deleteMany({
      where: {
        OR: [
          { studentId: s.id },
          { createdById: s.userId },
        ],
      },
    });

    // Clean AuditLogs
    await prisma.auditLog.deleteMany({
      where: {
        OR: [
          { userId: s.userId },
          { approverId: s.userId },
        ],
      },
    });

    // Clean Refresh Tokens & Password Resets
    await prisma.refreshToken.deleteMany({
      where: { userId: s.userId },
    });
    await prisma.passwordReset.deleteMany({
      where: { userId: s.userId },
    });

    // Delete StudentProfile
    await prisma.studentProfile.delete({
      where: { id: s.id },
    });

    // Delete User
    await prisma.user.delete({
      where: { id: s.userId },
    });

    console.log(`Successfully deleted student and user for TC: ${s.user.tcKimlikNo || 'N/A'}`);
  }

  console.log('All nameless students deleted successfully.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
