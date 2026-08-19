import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { ApprovableEntityType, AuditAction, DocumentPeriodType, DocumentType, Role } from '../types/enums';

export async function getActivePeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const periods = await prisma.documentPeriod.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // If the requester is a student, filter periods by their scholarship category
    if (req.user!.role === Role.STUDENT) {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.user!.userId },
        select: { scholarshipCategoryId: true },
      });
      const studentCatId = profile?.scholarshipCategoryId;

      const filtered = periods.filter(p => {
        if (!p.categoryIds) return true; // null = all categories
        try {
          const cats: string[] = JSON.parse(p.categoryIds);
          if (cats.length === 0) return true;
          return studentCatId ? cats.includes(studentCatId) : false;
        } catch {
          return true;
        }
      });
      res.json(filtered);
      return;
    }

    res.json(periods);
  } catch (err) {
    next(err);
  }
}

// ── Get Active Document Types ────────────────────────────────────────
export async function getActiveDocumentTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const types = await prisma.documentTypeConfig.findMany({
      where: { isActive: true },
      orderBy: [{ isStatic: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(types);
  } catch (err) {
    next(err);
  }
}

// ── Helper: get student profile and validate ownership ───────────────
async function getProfileAndValidate(req: Request, profileId: string) {
  let profile = await prisma.studentProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    profile = await prisma.studentProfile.findUnique({ where: { userId: profileId } });
  }
  if (!profile) throw new AppError(404, 'Profil bulunamadı.');

  const isAdminOrReviewer = req.user!.role === Role.ADMIN || req.user!.role === Role.REVIEWER;
  const isOwner = req.user!.userId === profile.userId || req.user!.profileId === profile.id;

  if (!isAdminOrReviewer && !isOwner) {
    throw new AppError(403, 'Bu profile belge yükleme yetkiniz yok.');
  }

  return profile;
}

// ── Helper: check if period allows this student's category ────────────
function isPeriodAllowedForCategory(period: { categoryIds: string | null }, scholarshipCategoryId: string | null | undefined): boolean {
  if (!period.categoryIds) return true; // null = all categories
  try {
    const cats: string[] = JSON.parse(period.categoryIds);
    if (cats.length === 0) return true;
    return scholarshipCategoryId ? cats.includes(scholarshipCategoryId) : false;
  } catch {
    return true;
  }
}

// ── Helper: save file and create document + approvable change ─────────
async function saveDocumentWithApproval(
  req: Request,
  profileId: string,
  docData: Record<string, any>,
) {
  if (!req.file) throw new AppError(400, 'Dosya bulunamadı.');

  let dynamicFieldsStr = docData.dynamicFields;
  if (dynamicFieldsStr && typeof dynamicFieldsStr !== 'string') {
    dynamicFieldsStr = JSON.stringify(dynamicFieldsStr);
  }
  if (dynamicFieldsStr === '{}' || dynamicFieldsStr === '""' || dynamicFieldsStr === 'null') {
    dynamicFieldsStr = null;
  }
  docData.dynamicFields = dynamicFieldsStr;

  const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);

  const document = await prisma.document.create({
    data: {
      studentProfileId: profileId,
      filePath: stored.filePath,
      originalFileName: stored.originalFileName,
      mimeType: stored.mimeType,
      fileSize: stored.fileSize,
      status: 'PENDING',
      ...docData,
    } as any,
  });

  // Create approvable change record linked to this document
  await prisma.approvableChange.create({
    data: {
      entityType: ApprovableEntityType.DOCUMENT,
      studentProfileId: profileId,
      documentId: document.id,
      fieldName: docData.type,
      newValue: stored.filePath,
      changedById: req.user!.userId,
      status: 'PENDING',
    },
  });

  // Audit log
  await prisma.auditLog.create({
    data: {
      userId: req.user!.userId,
      action: AuditAction.UPLOAD,
      module: 'Document',
      entityId: document.id,
      entityType: 'Document',
      newValue: docData.type,
    },
  });

  return document;
}

// ── Upload Static Document ────────────────────────────────────────────
export async function uploadStaticDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { profileId, type, dynamicFields } = req.body;
    if (!profileId || !type) throw new AppError(400, 'profileId ve type zorunludur.');

    const profile = await getProfileAndValidate(req, profileId);

    const doc = await saveDocumentWithApproval(req, profile.id, {
      type,
      isStatic: true,
      dynamicFields: dynamicFields || null,
    });

    res.status(201).json({ message: 'Belge yüklendi, onay bekleniyor.', document: doc });
  } catch (err) {
    next(err);
  }
}

// ── Upload Transcript ─────────────────────────────────────────────────
export async function uploadTranscript(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { profileId, grade, semester, academicYear, note, periodId } = req.body;
    if (!profileId) throw new AppError(400, 'profileId zorunludur.');

    const profile = await getProfileAndValidate(req, profileId);

    // Check if the period is open
    if (periodId) {
      const period = await prisma.documentPeriod.findUnique({ where: { id: periodId } });
      if (!period?.isOpen) {
        throw new AppError(400, 'Bu dönem için transkript yükleme şu anda kapalı.');
      }
      // Check category restriction
      if (!isPeriodAllowedForCategory(period, profile.scholarshipCategoryId)) {
        throw new AppError(403, 'Bu dönem sizin burs kategoriniz için açık değil.');
      }
    } else {
      // Check if there's any open transcript period matching this student's category
      const openPeriods = await prisma.documentPeriod.findMany({
        where: { type: DocumentPeriodType.TRANSCRIPT, isOpen: true },
      });
      if (req.user!.role === Role.STUDENT) {
        const hasMatch = openPeriods.some(p => isPeriodAllowedForCategory(p, profile.scholarshipCategoryId));
        if (!hasMatch) {
          throw new AppError(400, 'Transkript yükleme şu anda kapalı.');
        }
      }
    }

    const doc = await saveDocumentWithApproval(req, profile.id, {
      type: DocumentType.TRANSCRIPT,
      isStatic: false,
      periodId: periodId || null,
      grade: grade ? parseInt(grade) : null,
      semester: semester || null,
      academicYear: academicYear || null,
      transcriptNote: note || null,
    });

    res.status(201).json({ message: 'Transkript yüklendi, onay bekleniyor.', document: doc });
  } catch (err) {
    next(err);
  }
}

// ── Upload Student Certificate ────────────────────────────────────────
export async function uploadStudentCertificate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { profileId, grade, academicYear, periodId } = req.body;
    if (!profileId) throw new AppError(400, 'profileId zorunludur.');

    const profile = await getProfileAndValidate(req, profileId);

    if (periodId) {
      const period = await prisma.documentPeriod.findUnique({ where: { id: periodId } });
      if (!period?.isOpen) throw new AppError(400, 'Bu dönem için öğrenci belgesi yükleme kapalı.');
      if (!isPeriodAllowedForCategory(period, profile.scholarshipCategoryId)) {
        throw new AppError(403, 'Bu dönem sizin burs kategoriniz için açık değil.');
      }
    } else if (req.user!.role === Role.STUDENT) {
      const openPeriods = await prisma.documentPeriod.findMany({
        where: { type: DocumentPeriodType.STUDENT_CERTIFICATE, isOpen: true },
      });
      const hasMatch = openPeriods.some(p => isPeriodAllowedForCategory(p, profile.scholarshipCategoryId));
      if (!hasMatch) throw new AppError(400, 'Öğrenci belgesi yükleme şu anda kapalı.');
    }

    const doc = await saveDocumentWithApproval(req, profile.id, {
      type: DocumentType.STUDENT_CERTIFICATE,
      isStatic: false,
      periodId: periodId || null,
      grade: grade ? parseInt(grade) : null,
      academicYear: academicYear || null,
    });

    res.status(201).json({ message: 'Öğrenci belgesi yüklendi, onay bekleniyor.', document: doc });
  } catch (err) {
    next(err);
  }
}

// ── Upload Volunteer Report ───────────────────────────────────────────
export async function uploadVolunteerReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { profileId, grade, academicYear, semester, volunteerOrg, note, periodId } = req.body;
    if (!profileId) throw new AppError(400, 'profileId zorunludur.');
    if (!volunteerOrg) throw new AppError(400, 'Gönüllülük yapılan kurum adı zorunludur.');

    const profile = await getProfileAndValidate(req, profileId);

    if (periodId) {
      const period = await prisma.documentPeriod.findUnique({ where: { id: periodId } });
      if (!period?.isOpen) throw new AppError(400, 'Bu dönem için STK raporu yükleme kapalı.');
      if (!isPeriodAllowedForCategory(period, profile.scholarshipCategoryId)) {
        throw new AppError(403, 'Bu dönem sizin burs kategoriniz için açık değil.');
      }
    } else if (req.user!.role === Role.STUDENT) {
      const openPeriods = await prisma.documentPeriod.findMany({
        where: { type: DocumentPeriodType.VOLUNTEER_REPORT, isOpen: true },
      });
      const hasMatch = openPeriods.some(p => isPeriodAllowedForCategory(p, profile.scholarshipCategoryId));
      if (!hasMatch) throw new AppError(400, 'STK Gönüllülük Raporu yükleme şu anda kapalı.');
    }

    const doc = await saveDocumentWithApproval(req, profile.id, {
      type: DocumentType.VOLUNTEER_REPORT,
      isStatic: false,
      periodId: periodId || null,
      grade: grade ? parseInt(grade) : null,
      semester: semester || null,
      academicYear: academicYear || null,
      volunteerOrg,
      volunteerNote: note || null,
    });

    res.status(201).json({ message: 'STK Gönüllülük Raporu yüklendi, onay bekleniyor.', document: doc });
  } catch (err) {
    next(err);
  }
}

// ── Upload Dynamic Document ───────────────────────────────────────────
export async function uploadDynamicDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { profileId, periodId, type, dynamicFields } = req.body;
    if (!profileId || !periodId || !type) throw new AppError(400, 'profileId, periodId ve type zorunludur.');

    const profile = await getProfileAndValidate(req, profileId);

    const period = await prisma.documentPeriod.findUnique({ where: { id: periodId } });
    if (!period?.isOpen) throw new AppError(400, 'Bu dönem için yükleme kapalı.');

    // Check category restriction
    if (!isPeriodAllowedForCategory(period, profile.scholarshipCategoryId)) {
      throw new AppError(403, 'Bu dönem sizin burs kategoriniz için açık değil.');
    }

    // Save with approval
    const doc = await saveDocumentWithApproval(req, profile.id, {
      type,
      isStatic: false,
      periodId,
      dynamicFields: dynamicFields || null,
    });

    res.status(201).json({ message: 'Belge yüklendi, onay bekleniyor.', document: doc });
  } catch (err) {
    next(err);
  }
}

