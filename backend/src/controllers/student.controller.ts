import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { ApprovableEntityType, AuditAction, Role } from '../types/enums';

// Helper: check if user can access the student profile
function canAccessProfile(req: Request, profileId: string, profileUserId: string): boolean {
  if (!req.user) return false;
  if (req.user.role === Role.ADMIN || req.user.role === Role.REVIEWER) return true;
  // Student can only access their own profile
  return req.user.userId === profileUserId;
}

// ── Get Student Profile ──────────────────────────────────────────────
export async function getStudentProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params; // This is profileId
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, tcKimlikNo: true, email: true, role: true, isActive: true } },
        mentor: true,
        scholarshipCategory: true,
        approvableChanges: {
          where: { status: 'PENDING' },
          select: { id: true, entityType: true, fieldName: true, createdAt: true },
        },
      },
    });

    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) {
      throw new AppError(403, 'Bu profile erişim yetkiniz yok.');
    }

    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// ── Get Student Documents ────────────────────────────────────────────
export async function getStudentDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) {
      throw new AppError(403, 'Bu profile erişim yetkiniz yok.');
    }

    const documents = await prisma.document.findMany({
      where: { studentProfileId: id },
      include: { period: true },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json(documents);
  } catch (err) {
    next(err);
  }
}

// ── Helper: create approvable change + audit log ─────────────────────
async function createApprovableChange(
  studentProfileId: string,
  userId: string,
  entityType: ApprovableEntityType,
  fieldName: string,
  oldValue: string | null | undefined,
  newValue: string,
) {
  await prisma.approvableChange.create({
    data: {
      entityType,
      studentProfileId,
      fieldName,
      oldValue: oldValue ? String(oldValue) : null,
      newValue,
      changedById: userId,
      status: 'PENDING',
    },
  });

  await prisma.auditLog.create({
    data: {
      userId,
      action: AuditAction.UPDATE,
      module: entityType,
      entityId: studentProfileId,
      entityType: 'StudentProfile',
      oldValue: oldValue ? String(oldValue) : null,
      newValue,
    },
  });
}

// ── Update Contact Info (direct, no approval) ────────────────────────
export async function updateContactInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const { phone, email, address } = req.body;
    
    // Update StudentProfile
    const updated = await prisma.studentProfile.update({
      where: { id },
      data: { phone, email, address },
    });

    // Sync email to User table if provided
    if (email !== undefined) {
      const existingUserWithEmail = await prisma.user.findFirst({
        where: { email, id: { not: profile.userId } }
      });
      if (!existingUserWithEmail) {
        await prisma.user.update({
          where: { id: profile.userId },
          data: { email: email || null }
        });
      }
    }

    res.json({ message: 'İletişim bilgileri güncellendi.', profile: updated });
  } catch (err) {
    next(err);
  }
}

// ── Update Personal Info (direct update + audit log) ─────────────────────────
export async function updatePersonalInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const fields = ['firstName', 'lastName', 'gender', 'birthDate', 'birthPlace', 'registeredCity', 'scholarshipSources', 'scholarshipDate', 'scholarshipCategoryId', 'email', 'phone', 'address'];
    if (req.user?.role === Role.ADMIN || req.user?.role === Role.REVIEWER) {
      fields.push('studentStatus');
    }

    const updateData: any = {};
    const auditLogs: any[] = [];

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        const oldVal = (profile as any)[field];
        let newVal = req.body[field];
        if (field === 'birthDate' || field === 'scholarshipDate') {
          newVal = newVal ? new Date(newVal) : null;
        }
        
        const oldStr = oldVal instanceof Date ? oldVal.toISOString() : (oldVal ? String(oldVal) : null);
        const newStr = newVal instanceof Date ? newVal.toISOString() : (newVal ? String(newVal) : null);

        if (oldStr !== newStr) {
          updateData[field] = newVal;
          auditLogs.push({
            userId: req.user!.userId,
            action: 'UPDATE',
            module: 'PERSONAL_INFO',
            entityId: id,
            entityType: 'StudentProfile',
            oldValue: oldStr,
            newValue: newStr,
          });
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.$transaction([
        prisma.studentProfile.update({ where: { id }, data: updateData }),
        prisma.auditLog.createMany({ data: auditLogs }),
      ]);

      // Sync email to User table if provided
      if (updateData.email !== undefined) {
        const existingUserWithEmail = await prisma.user.findFirst({
          where: { email: updateData.email, id: { not: profile.userId } }
        });
        if (!existingUserWithEmail) {
          await prisma.user.update({
            where: { id: profile.userId },
            data: { email: updateData.email || null }
          });
        }
      }
    }

    res.json({ message: 'Kişisel bilgileriniz güncellendi.', profile: { ...profile, ...updateData } });
  } catch (err) {
    next(err);
  }
}

// ── Update Family Info (direct update + audit log) ───────────────────────────
export async function updateFamilyInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const familyFields = [
      'fatherName', 'fatherAge', 'fatherAlive', 'fatherMaritalStatus', 'fatherOccupation', 'fatherIncome',
      'motherName', 'motherAge', 'motherAlive', 'motherMaritalStatus', 'motherOccupation', 'motherIncome',
      'familyMemberCount', 'siblingCount', 'siblingsInEducation', 'socialSecurity',
      'homeOwnership', 'homeAddress', 'familyDescription',
    ];
    const updateData: any = {};
    const auditLogs: any[] = [];

    for (const field of familyFields) {
      if (req.body[field] !== undefined) {
        const oldVal = (profile as any)[field];
        let newVal = req.body[field];

        if (field === 'fatherAge' || field === 'motherAge' || field === 'familyMemberCount' || field === 'siblingCount' || field === 'siblingsInEducation') {
          newVal = newVal !== '' ? Number(newVal) : null;
        } else if (field === 'fatherIncome' || field === 'motherIncome') {
          newVal = newVal !== '' ? parseFloat(newVal) : null;
        } else if (field === 'fatherAlive' || field === 'motherAlive') {
          newVal = newVal === true || newVal === 'true';
        }

        const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : null;
        const newStr = newVal !== null && newVal !== undefined ? String(newVal) : null;

        if (oldStr !== newStr) {
          updateData[field] = newVal;
          auditLogs.push({
            userId: req.user!.userId,
            action: 'UPDATE',
            module: 'FAMILY_INFO',
            entityId: id,
            entityType: 'StudentProfile',
            oldValue: oldStr,
            newValue: newStr,
          });
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.$transaction([
        prisma.studentProfile.update({ where: { id }, data: updateData }),
        prisma.auditLog.createMany({ data: auditLogs }),
      ]);
    }

    res.json({ message: 'Aile bilgileri güncellendi.', profile: { ...profile, ...updateData } });
  } catch (err) {
    next(err);
  }
}

// ── Update Education Info (direct update + audit log) ────────────────────────
export async function updateEducationInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const eduFields = ['universityName', 'faculty', 'department', 'grade', 'universityType', 'highSchoolName', 'highSchoolCity', 'highSchoolGradYear'];
    const updateData: any = {};
    const auditLogs: any[] = [];

    for (const field of eduFields) {
      if (req.body[field] !== undefined) {
        const oldVal = (profile as any)[field];
        let newVal = req.body[field];

        if (field === 'grade' || field === 'highSchoolGradYear') {
          newVal = newVal !== '' ? Number(newVal) : null;
        }

        const oldStr = oldVal !== null && oldVal !== undefined ? String(oldVal) : null;
        const newStr = newVal !== null && newVal !== undefined ? String(newVal) : null;

        if (oldStr !== newStr) {
          updateData[field] = newVal;
          auditLogs.push({
            userId: req.user!.userId,
            action: 'UPDATE',
            module: 'EDUCATION_INFO',
            entityId: id,
            entityType: 'StudentProfile',
            oldValue: oldStr,
            newValue: newStr,
          });
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.$transaction([
        prisma.studentProfile.update({ where: { id }, data: updateData }),
        prisma.auditLog.createMany({ data: auditLogs }),
      ]);
    }

    res.json({ message: 'Eğitim bilgileri güncellendi.', profile: { ...profile, ...updateData } });
  } catch (err) {
    next(err);
  }
}

// ── Update Bank Info (always requires approval) ──────────────────────
export async function updateBankInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const { iban, bankName } = req.body;
    if (!iban || !bankName) throw new AppError(400, 'IBAN ve banka adı zorunludur.');

    // Mask IBAN in the change value for display (last 4 visible)
    const maskedIban = iban.replace(/(.{4})(?=.{4})/g, '*'.repeat(4));

    const changes = [
      createApprovableChange(id, req.user!.userId, ApprovableEntityType.BANK_INFO, 'iban', profile.iban ? '***' + profile.iban.slice(-4) : null, maskedIban),
      createApprovableChange(id, req.user!.userId, ApprovableEntityType.BANK_INFO, 'bankName', profile.bankName, bankName),
    ];

    // Store the actual IBAN in a pending state (we store actual value, display masked)
    await prisma.approvableChange.updateMany({
      where: {
        studentProfileId: id,
        entityType: ApprovableEntityType.BANK_INFO,
        fieldName: 'iban',
        status: 'PENDING',
      },
      data: { newValue: iban }, // Overwrite with actual IBAN
    });

    await Promise.all(changes);

    res.json({ message: 'Banka bilgisi güncelleme talebi oluşturuldu. Admin onayından sonra aktif olacak.' });
  } catch (err) {
    next(err);
  }
}

// ── Upload Profile Photo ─────────────────────────────────────────────
export async function uploadProfilePhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    if (!req.file) throw new AppError(400, 'Fotoğraf dosyası bulunamadı.');

    const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);

    await prisma.studentProfile.update({
      where: { id },
      data: { photoPath: stored.filePath },
    });

    res.json({ message: 'Profil fotoğrafı güncellendi.', photoPath: stored.filePath });
  } catch (err) {
    next(err);
  }
}

// ── Get Announcements ────────────────────────────────────────────────
export async function getAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    // Fetch announcements that are active
    const announcements = await prisma.announcement.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // Filter announcements targeting this student's category or all
    const targetedAnnouncements = announcements.filter(a => {
      if (!a.categoryIds) return true; // targeted to all
      try {
        const catIds: string[] = JSON.parse(a.categoryIds);
        if (catIds.length === 0) return true;
        if (profile.scholarshipCategoryId && catIds.includes(profile.scholarshipCategoryId)) return true;
        return false;
      } catch {
        return true; // if parsing fails, assume all
      }
    });

    res.json(targetedAnnouncements);
  } catch (err) {
    next(err);
  }
}

