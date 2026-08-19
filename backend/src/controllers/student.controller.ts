import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { ApprovableEntityType, AuditAction, Role } from '../types/enums';
import { sendStudentContactUpdatedEmail, sendBankInfoChangeRequestEmail, ContactChangeItem } from '../lib/email.service';

const CONTACT_FIELD_LABELS: Record<string, string> = {
  phone: 'Telefon Numarası',
  email: 'E-posta Adresi',
  address: 'İkamet Adresi',
};

function getContactChanges(
  oldData: { phone?: string | null; email?: string | null; address?: string | null },
  newData: { phone?: any; email?: any; address?: any }
): ContactChangeItem[] {
  const changes: ContactChangeItem[] = [];
  const fields = ['phone', 'email', 'address'] as const;

  for (const field of fields) {
    if (newData[field] === undefined) continue;

    const oldRaw = oldData[field];
    const newRaw = newData[field];

    const oldTrimmed = oldRaw !== null && oldRaw !== undefined ? String(oldRaw).trim() : '';
    const newTrimmed = newRaw !== null && newRaw !== undefined ? String(newRaw).trim() : '';

    if (oldTrimmed !== newTrimmed) {
      const hadOldValue = Boolean(oldTrimmed);
      const isFirstEntry = !hadOldValue && Boolean(newTrimmed);
      changes.push({
        field,
        label: CONTACT_FIELD_LABELS[field] || field,
        oldValue: hadOldValue ? oldTrimmed : null,
        newValue: newTrimmed || '(Boşaltıldı)',
        isFirstEntry,
      });
    }
  }

  return changes;
}

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
          select: { id: true, entityType: true, fieldName: true, oldValue: true, newValue: true, createdAt: true },
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

// ── Update Contact Info (requires approval) ────────────────────────
export async function updateContactInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const { phone, email, address } = req.body;
    
    // Detect contact changes
    const changes = getContactChanges(
      { phone: profile.phone, email: profile.email || profile.user?.email, address: profile.address },
      { phone, email, address }
    );

    if (changes.length === 0) {
      res.json({ message: 'Değişiklik yapılmadı.', profile });
      return;
    }

    // Create ApprovableChange records for each field
    const approvableChanges = [];
    const fieldsToUpdate = { phone, email, address };
    
    for (const [key, newVal] of Object.entries(fieldsToUpdate)) {
      if (newVal !== undefined) {
        let oldVal = null;
        if (key === 'phone') oldVal = profile.phone;
        if (key === 'email') oldVal = profile.email || profile.user?.email;
        if (key === 'address') oldVal = profile.address;

        if (oldVal !== newVal) {
          // Remove existing pending changes for this field
          await prisma.approvableChange.deleteMany({
            where: {
              studentProfileId: id,
              entityType: 'PERSONAL_INFO',
              fieldName: key,
              status: 'PENDING',
            },
          });

          approvableChanges.push({
            entityType: 'PERSONAL_INFO',
            studentProfileId: id,
            fieldName: key,
            oldValue: oldVal || null,
            newValue: newVal || null,
            changedById: req.user!.userId,
            status: 'PENDING',
          });
        }
      }
    }

    if (approvableChanges.length > 0) {
      await prisma.approvableChange.createMany({
        data: approvableChanges,
      });

      // Trigger admin email notification
      const studentName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Öğrenci';
      const studentIdentifier = profile.user?.tcKimlikNo ? `TC: ${profile.user.tcKimlikNo}` : `ID: ${profile.id}`;

      sendStudentContactUpdatedEmail({
        studentName,
        studentIdentifier,
        profileId: profile.id,
        changes,
        updatedAt: new Date(),
      }).catch(err => {
        console.error('[StudentController] Failed to send contact update email:', err);
      });
    }

    res.json({ message: 'İletişim bilgisi güncelleme talebiniz oluşturuldu. Yönetici onayından sonra aktif olacaktır.' });
  } catch (err) {
    next(err);
  }
}

// ── Update Personal Info (direct update + audit log) ─────────────────────────
export async function updatePersonalInfo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });
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

      // Check if student updated contact fields (phone, email, address)
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.REVIEWER) {
        const contactChanges = getContactChanges(
          { phone: profile.phone, email: profile.email || profile.user?.email, address: profile.address },
          { phone: updateData.phone, email: updateData.email, address: updateData.address }
        );

        if (contactChanges.length > 0) {
          const studentName = `${updateData.firstName || profile.firstName || ''} ${updateData.lastName || profile.lastName || ''}`.trim() || 'Öğrenci';
          const studentIdentifier = profile.user?.tcKimlikNo ? `TC: ${profile.user.tcKimlikNo}` : `ID: ${profile.id}`;

          sendStudentContactUpdatedEmail({
            studentName,
            studentIdentifier,
            profileId: profile.id,
            changes: contactChanges,
            updatedAt: new Date(),
          }).catch(err => {
            console.error('[StudentController] Failed to send contact update email:', err);
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
    const profile = await prisma.studentProfile.findUnique({
      where: { id },
      include: { user: true },
    });
    if (!profile) throw new AppError(404, 'Profil bulunamadı.');
    if (!canAccessProfile(req, id, profile.userId)) throw new AppError(403, 'Erişim reddedildi.');

    const { iban, bankName } = req.body;
    const cleanBankName = (bankName || '').trim();
    const cleanIban = (iban || '').replace(/\s+/g, '').toUpperCase();

    if (!cleanBankName) {
      throw new AppError(400, 'Banka adı zorunludur.');
    }

    // IBAN format validation: must start with TR and contain exactly 24 digits
    if (!cleanIban.startsWith('TR') || !/^TR\d{24}$/.test(cleanIban)) {
      throw new AppError(
        400,
        'Geçerli bir Türkiye IBAN numarası giriniz. IBAN "TR" ile başlamalı ve ardından 24 haneli rakam içermelidir (Örn: TR00 0000 0000 0000 0000 0000 00).'
      );
    }

    // Remove any existing PENDING bank info approval changes for this student
    await prisma.approvableChange.deleteMany({
      where: {
        studentProfileId: id,
        entityType: ApprovableEntityType.BANK_INFO,
        status: 'PENDING',
      },
    });

    // Format display / JSON values (unmasked full IBAN)
    const oldPayload = JSON.stringify({
      bankName: profile.bankName || null,
      iban: profile.iban || null,
    });

    const changePayload = JSON.stringify({
      bankName: cleanBankName,
      iban: cleanIban,
    });

    // Create a single unified approvable change record
    await prisma.approvableChange.create({
      data: {
        entityType: ApprovableEntityType.BANK_INFO,
        studentProfileId: id,
        fieldName: 'bankInfo',
        oldValue: oldPayload,
        newValue: changePayload,
        changedById: req.user!.userId,
        status: 'PENDING',
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: ApprovableEntityType.BANK_INFO,
        entityId: id,
        entityType: 'StudentProfile',
        oldValue: oldPayload,
        newValue: changePayload,
      },
    });

    // Trigger admin notification email
    const studentName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Öğrenci';
    const studentIdentifier = profile.user?.tcKimlikNo ? `TC: ${profile.user.tcKimlikNo}` : `ID: ${profile.id}`;

    sendBankInfoChangeRequestEmail({
      studentName,
      studentIdentifier,
      profileId: profile.id,
      oldBankName: profile.bankName,
      oldIban: profile.iban,
      newBankName: cleanBankName,
      newIban: cleanIban,
      requestedAt: new Date(),
    }).catch(err => {
      console.error('[StudentController] Error sending bank info approval email to admin:', err);
    });

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

