import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ── Admin user ──────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@faydasi-cok.org',
      passwordHash: adminPassword,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`%c✅ Admin user created: username=admin (id: ${admin.id})`, 'color: green');

  // ── Reviewer user ────────────────────────────────────────────────
  const reviewerPassword = await bcrypt.hash('reviewer123', 12);
  const reviewer = await prisma.user.upsert({
    where: { email: 'reviewer@faydasi-cok.org' },
    update: {},
    create: {
      username: 'reviewer',
      email: 'reviewer@faydasi-cok.org',
      passwordHash: reviewerPassword,
      role: 'REVIEWER',
      isActive: true,
    },
  });
  console.log(`%c✅ Reviewer user created: email=reviewer@faydasi-cok.org (id: ${reviewer.id})`, 'color: green');

  // ── Test student ─────────────────────────────────────────────────
  const studentPassword = await bcrypt.hash('145325', 12);
  const student = await prisma.user.upsert({
    where: { tcKimlikNo: '10091231962' },
    update: {},
    create: {
      tcKimlikNo: '10091231962',
      passwordHash: studentPassword,
      role: 'STUDENT',
      isActive: true,
    },
  });
  console.log(`%c✅ Student user created: TC=10091231962 (id: ${student.id})`, 'color: green');

  // ── Student profile ──────────────────────────────────────────────
  const existingProfile = await prisma.studentProfile.findUnique({
    where: { userId: student.id },
  });

  if (!existingProfile) {
    await prisma.studentProfile.create({
      data: {
        userId: student.id,
        firstName: 'Test',
        lastName: 'Öğrenci',
        gender: 'Erkek',
        birthDate: new Date('2000-05-15'),
        birthPlace: 'Ankara',
        registeredCity: 'Ankara',
        scholarshipSources: JSON.stringify(['Faydasıçok Vakfı']),
        scholarshipDate: new Date('2022-09-01'),
        studentStatus: 'ACTIVE',
        enrollmentStatus: 'ENROLLED',
        phone: '05321234567',
        email: 'test.ogrenci@example.com',
        address: 'Çankaya, Ankara',
        iban: 'TR330006100519786457841326',
        bankName: 'Ziraat Bankası',
        fatherName: 'Ahmet',
        fatherAge: 52,
        fatherAlive: true,
        fatherMaritalStatus: 'Evli',
        fatherOccupation: 'Memur',
        fatherIncome: 15000,
        motherName: 'Fatma',
        motherAge: 48,
        motherAlive: true,
        motherMaritalStatus: 'Evli',
        motherOccupation: 'Ev Hanımı',
        motherIncome: 0,
        familyMemberCount: 4,
        siblingCount: 1,
        siblingsInEducation: 1,
        socialSecurity: 'SGK',
        homeOwnership: 'Kira',
        homeAddress: 'Çankaya, Ankara',
        familyDescription: 'Orta gelirli bir aile. Baba devlet memuru, anne ev hanımı.',
        universityName: 'Örnek Üniversitesi',
        faculty: 'Mühendislik Fakültesi',
        department: 'Bilgisayar Mühendisliği',
        grade: 3,
        universityType: 'Devlet',
        highSchoolName: 'Ankara Fen Lisesi',
        highSchoolCity: 'Ankara',
        highSchoolGradYear: 2022,
      },
    });
    console.log('✅ Student profile created');
  } else {
    console.log('ℹ️  Student profile already exists, skipping');
  }

  // ── Document Periods ─────────────────────────────────────────────
  const periods = [
    {
      type: 'TRANSCRIPT',
      label: '2024-2025 Güz Dönemi',
      semester: 'GUZ',
      academicYear: '2024-2025',
      isOpen: true,
    },
    {
      type: 'STUDENT_CERTIFICATE',
      label: '2024-2025 Güz Dönemi',
      semester: 'GUZ',
      academicYear: '2024-2025',
      isOpen: true,
    },
    {
      type: 'VOLUNTEER_REPORT',
      label: '2024-2025 Güz Dönemi',
      semester: 'GUZ',
      academicYear: '2024-2025',
      isOpen: false,
    },
  ];

  for (const periodData of periods) {
    const existing = await prisma.documentPeriod.findFirst({
      where: { type: periodData.type, label: periodData.label },
    });
    if (!existing) {
      await prisma.documentPeriod.create({ data: periodData });
    }
  }
  console.log('✅ Document periods seeded');

  console.log('\n🎉 Seed completed successfully!');
  console.log('\n📋 Test credentials:');
  console.log('  Admin:    username=admin      password=admin');
  console.log('  Reviewer: email=reviewer@faydasi-cok.org  password=reviewer123');
  console.log('  Student:  TC=10091231962      password=145325');
  console.log('\n⚠️  WARNING: Change admin/reviewer passwords immediately in production!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
