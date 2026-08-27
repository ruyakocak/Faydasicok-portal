import cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { storageService } from '../lib/storage';
import crypto from 'crypto';
import { AuditAction } from '../types/enums';

// This job runs every day at 03:00 AM
export const initRetentionJob = () => {
  cron.schedule('0 3 * * *', async () => {
    console.log('[Retention Job] Starting data retention check...');
    try {
      await processAnonymization();
    } catch (error) {
      console.error('[Retention Job] Error during execution:', error);
    }
  });
  console.log('[Retention Job] Cron job initialized (Runs every day at 03:00 AM)');
};

export const processAnonymization = async () => {
  // 1. Fetch retention setting
  const setting = await prisma.systemSetting.findUnique({
    where: { key: 'retention_years' }
  });
  
  const retentionYears = setting ? parseInt(setting.value, 10) : 5;
  if (isNaN(retentionYears) || retentionYears <= 0) {
    console.error('[Retention Job] Invalid retention_years setting:', setting?.value);
    return;
  }

  const cutoffDate = new Date();
  cutoffDate.setFullYear(cutoffDate.getFullYear() - retentionYears);

  // 2. Find students to anonymize
  const studentsToAnonymize = await prisma.studentProfile.findMany({
    where: {
      studentStatus: 'GRADUATED',
      isAnonymized: false,
      graduatedAt: {
        lte: cutoffDate
      }
    },
    include: {
      documents: true,
      user: true
    }
  });

  if (studentsToAnonymize.length === 0) {
    console.log('[Retention Job] No students to anonymize today.');
    return;
  }

  console.log(`[Retention Job] Found ${studentsToAnonymize.length} students to anonymize.`);

  let processedCount = 0;

  for (const student of studentsToAnonymize) {
    try {
      // 3. Delete physical document files
      for (const doc of student.documents) {
        if (doc.filePath) {
          try {
            await storageService.delete(doc.filePath);
          } catch (e) {
            console.error(`[Retention Job] Error deleting file ${doc.filePath}:`, e);
          }
        }
      }

      // 4. Delete document records and approvable changes
      await prisma.approvableChange.deleteMany({
        where: { studentProfileId: student.id }
      });
      await prisma.document.deleteMany({
        where: { studentProfileId: student.id }
      });

      // 5. Delete profile photo if exists
      if (student.photoPath) {
        try {
          await storageService.delete(student.photoPath);
        } catch (e) {
          console.error(`[Retention Job] Error deleting photo ${student.photoPath}:`, e);
        }
      }

      // 6. Anonymize user data
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      await prisma.user.update({
        where: { id: student.userId },
        data: {
          tcKimlikNo: `ANONIM_${randomSuffix}`,
          email: `anonim_${randomSuffix}@deleted.local`,
          passwordHash: 'ANONYMIZED',
          isActive: false
        }
      });

      // 7. Anonymize student profile data
      await prisma.studentProfile.update({
        where: { id: student.id },
        data: {
          isAnonymized: true,
          firstName: 'Anonim',
          lastName: 'Mezun',
          phone: null,
          email: null,
          address: null,
          photoPath: null,
          iban: null,
          bankName: null,
          birthPlace: null,
          registeredCity: null,
          fatherName: null,
          motherName: null,
          homeAddress: null,
          familyCity: null,
          familyPhone: null,
          referenceInfo: null,
          linkedinUrl: null,
          // We keep non-identifying info: universityName, department, grade, graduationYear, etc.
        }
      });

      // 8. Audit log
      await prisma.auditLog.create({
        data: {
          action: AuditAction.UPDATE,
          module: 'Retention',
          entityId: student.id,
          entityType: 'StudentProfile',
          newValue: 'Data anonymized due to retention policy'
        }
      });

      processedCount++;
    } catch (err) {
      console.error(`[Retention Job] Failed to process student ${student.id}:`, err);
    }
  }

  console.log(`[Retention Job] Successfully anonymized ${processedCount} students.`);
};
