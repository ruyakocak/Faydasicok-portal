import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { Role } from '../types/enums';

// ── Validation helpers ───────────────────────────────────────────────
const TARGET_GROUPS = [
  'Eğitim & Gençlik (burslar, özel ders, mentorluk, kariyer gelişimi, liderlik, girişimcilik)',
  'İnsani Yardım & Sosyal Destek (gıda yardımı, afet desteği, temel ihtiyaçlar, aile ve çocuk destekleri)',
  'Dezavantajlı Gruplar (engelliler, dezavantajlı bireyler, kadınlar, gençler, mülteciler)',
  'Çevre, Doğa & Sürdürülebilirlik (iklim değişikliği, geri dönüşüm, sıfır atık, enerji verimliliği)',
  'Teknoloji, Bilim & İnovasyon (yapay zekâ, kodlama, STEM, girişimcilik, dijital dönüşüm)',
  'Toplumsal Gelişim (gönüllülük, sosyal sorumluluk, sosyal girişimcilik, toplumsal dayanışma)',
  'Diğer',
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PROJECT_DESC_LENGTH = 100;

function validateFormFields(body: Record<string, any>): void {
  const {
    fullName, email, scholarshipCategoryId, schoolAndDepartment,
    ngoOrProjectName, projectDescription, targetGroup, targetGroupOther,
    totalHours, personalImpactEvaluation,
  } = body;

  if (!fullName?.trim()) throw new AppError(400, 'Ad Soyad zorunludur.');
  if (!email?.trim()) throw new AppError(400, 'E-posta adresi zorunludur.');
  if (!EMAIL_RE.test(email.trim())) throw new AppError(400, 'Geçerli bir e-posta adresi giriniz.');

  if (!scholarshipCategoryId?.trim()) {
    throw new AppError(400, 'Geçerli bir gelişim programı (kategori) seçiniz.');
  }

  if (!schoolAndDepartment?.trim()) throw new AppError(400, 'Okul ve Bölüm zorunludur.');
  if (!ngoOrProjectName?.trim()) throw new AppError(400, 'STK veya Proje Adı zorunludur.');

  if (!projectDescription?.trim()) throw new AppError(400, 'Proje Detayı zorunludur.');
  if (projectDescription.trim().length < MIN_PROJECT_DESC_LENGTH) {
    throw new AppError(400, `Proje Detayı en az ${MIN_PROJECT_DESC_LENGTH} karakter olmalıdır.`);
  }

  if (!targetGroup || !TARGET_GROUPS.includes(targetGroup)) {
    throw new AppError(400, 'Geçerli bir hedef grup seçiniz.');
  }
  if (targetGroup === 'Diğer' && !targetGroupOther?.trim()) {
    throw new AppError(400, '"Diğer" seçildiğinde açıklama alanı zorunludur.');
  }

  const hours = parseInt(totalHours, 10);
  if (isNaN(hours) || hours <= 0) {
    throw new AppError(400, 'Toplam saat pozitif bir tamsayı olmalıdır.');
  }

  if (!personalImpactEvaluation?.trim()) {
    throw new AppError(400, 'Kişisel etki ve değişim değerlendirmesi zorunludur.');
  }
}

// ── Submit Volunteer Form ────────────────────────────────────────────
export async function submitVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Ensure the user is a student
    if (req.user!.role !== Role.STUDENT) {
      throw new AppError(403, 'Bu form yalnızca öğrenciler tarafından gönderilebilir.');
    }

    // Get student profile
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true, scholarshipCategoryId: true },
    });
    if (!profile) throw new AppError(404, 'Öğrenci profili bulunamadı.');

    // Validate fields
    validateFormFields(req.body);

    // Period Check
    const activePeriods = await prisma.documentPeriod.findMany({
      where: { isVolunteerFormOpen: true, isOpen: true },
    });

    if (activePeriods.length === 0) {
      throw new AppError(403, 'Şu anda açık bir gönüllülük formu dönemi bulunmamaktadır.');
    }

    // Find a period that matches the student's category (or applies to all)
    const validPeriod = activePeriods.find(p => {
      if (!p.categoryIds) return true; // applies to all
      try {
        const catIds: string[] = JSON.parse(p.categoryIds);
        return profile.scholarshipCategoryId && catIds.includes(profile.scholarshipCategoryId);
      } catch {
        return false;
      }
    });

    if (!validPeriod) {
      throw new AppError(403, 'Sizin grubunuz için açık bir gönüllülük formu dönemi bulunmamaktadır.');
    }

    // Handle files
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (!files?.document1?.length) {
      throw new AppError(400, 'En az bir belge/fotoğraf yüklemeniz gerekmektedir.');
    }

    // Save files
    const doc1 = files.document1[0];
    const stored1 = await storageService.save(doc1.buffer, doc1.originalname, doc1.mimetype);

    let stored2: { filePath: string; originalFileName: string } | null = null;
    if (files.document2?.length) {
      const doc2 = files.document2[0];
      stored2 = await storageService.save(doc2.buffer, doc2.originalname, doc2.mimetype);
    }

    let stored3: { filePath: string; originalFileName: string } | null = null;
    if (files.document3?.length) {
      const doc3 = files.document3[0];
      stored3 = await storageService.save(doc3.buffer, doc3.originalname, doc3.mimetype);
    }

    // Create DB record
    const form = await prisma.volunteerForm.create({
      data: {
        studentProfileId: profile.id,
        periodId: validPeriod.id,
        scholarshipCategoryId: req.body.scholarshipCategoryId,
        fullName: req.body.fullName.trim(),
        email: req.body.email.trim(),
        schoolAndDepartment: req.body.schoolAndDepartment.trim(),
        ngoOrProjectName: req.body.ngoOrProjectName.trim(),
        projectDescription: req.body.projectDescription.trim(),
        targetGroup: req.body.targetGroup,
        targetGroupOther: req.body.targetGroup === 'Diğer' ? req.body.targetGroupOther?.trim() || null : null,
        totalHours: parseInt(req.body.totalHours, 10),
        personalImpactEvaluation: req.body.personalImpactEvaluation.trim(),
        document1Path: stored1.filePath,
        document1OriginalName: stored1.originalFileName,
        document2Path: stored2?.filePath || null,
        document2OriginalName: stored2?.originalFileName || null,
        document3Path: stored3?.filePath || null,
        document3OriginalName: stored3?.originalFileName || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        module: 'VolunteerForm',
        entityId: form.id,
        entityType: 'VolunteerForm',
        newValue: JSON.stringify({ ngoOrProjectName: req.body.ngoOrProjectName.trim() }),
      },
    });

    res.status(201).json({
      message: 'Gönüllülük formu başarıyla gönderildi.',
      form,
    });
  } catch (err) {
    next(err);
  }
}

// ── Get My Volunteer Forms ───────────────────────────────────────────
export async function getMyVolunteerForms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true },
    });
    if (!profile) throw new AppError(404, 'Öğrenci profili bulunamadı.');

    const forms = await prisma.volunteerForm.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        scholarshipCategory: { select: { id: true, name: true } },
        period: { select: { id: true, label: true } }
      }
    });

    res.json(forms);
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] List All Volunteer Forms ─────────────────────────────────
export async function adminListVolunteerForms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string)?.trim() || '';
    const categoryFilter = (req.query.scholarshipCategoryId as string)?.trim() || '';
    const targetGroupFilter = (req.query.targetGroup as string)?.trim() || '';

    const periodFilter = (req.query.periodId as string)?.trim() || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { ngoOrProjectName: { contains: search } },
        { schoolAndDepartment: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (categoryFilter) {
      where.scholarshipCategoryId = categoryFilter;
    }
    if (targetGroupFilter) {
      where.targetGroup = targetGroupFilter;
    }
    if (periodFilter) {
      where.periodId = periodFilter;
    }

    const [forms, total] = await Promise.all([
      prisma.volunteerForm.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          scholarshipCategory: { select: { id: true, name: true } },
          studentProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { tcKimlikNo: true } },
            },
          },
        },
      }),
      prisma.volunteerForm.count({ where }),
    ]);

    res.json({
      data: forms,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Get Single Volunteer Form ────────────────────────────────
export async function adminGetVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const form = await prisma.volunteerForm.findUnique({
      where: { id: req.params.id },
      include: {
        scholarshipCategory: { select: { id: true, name: true } },
        studentProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { tcKimlikNo: true } },
          },
        },
      },
    });
    if (!form) throw new AppError(404, 'Form bulunamadı.');

    res.json(form);
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Update Volunteer Form ─────────────────────────────────────
export async function adminUpdateVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const existing = await prisma.volunteerForm.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Form bulunamadı.');

    const {
      fullName, email, scholarshipCategoryId, schoolAndDepartment,
      ngoOrProjectName, projectDescription, targetGroup, targetGroupOther,
      totalHours, personalImpactEvaluation,
    } = req.body;

    // Validate only provided fields
    if (email !== undefined && email !== null) {
      if (!EMAIL_RE.test(String(email).trim())) throw new AppError(400, 'Geçerli bir e-posta adresi giriniz.');
    }
    if (targetGroup !== undefined && !TARGET_GROUPS.includes(targetGroup)) {
      throw new AppError(400, 'Geçerli bir hedef grup seçiniz.');
    }
    if (projectDescription !== undefined && String(projectDescription).trim().length < MIN_PROJECT_DESC_LENGTH) {
      throw new AppError(400, `Proje Detayı en az ${MIN_PROJECT_DESC_LENGTH} karakter olmalıdır.`);
    }
    if (totalHours !== undefined) {
      const h = parseInt(totalHours, 10);
      if (isNaN(h) || h <= 0) throw new AppError(400, 'Toplam saat pozitif bir tamsayı olmalıdır.');
    }
    const effTargetGroup = targetGroup ?? existing.targetGroup;
    if (effTargetGroup === 'Diğer') {
      const effOther = targetGroupOther ?? existing.targetGroupOther;
      if (!effOther?.trim()) throw new AppError(400, '"Diğer" seçildiğinde açıklama alanı zorunludur.');
    }

    const updated = await prisma.volunteerForm.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined && { fullName: String(fullName).trim() }),
        ...(email !== undefined && { email: String(email).trim() }),
        ...(scholarshipCategoryId !== undefined && { scholarshipCategoryId }),
        ...(schoolAndDepartment !== undefined && { schoolAndDepartment: String(schoolAndDepartment).trim() }),
        ...(ngoOrProjectName !== undefined && { ngoOrProjectName: String(ngoOrProjectName).trim() }),
        ...(projectDescription !== undefined && { projectDescription: String(projectDescription).trim() }),
        ...(targetGroup !== undefined && { targetGroup }),
        ...(targetGroupOther !== undefined && { targetGroupOther: targetGroup === 'Diğer' ? String(targetGroupOther).trim() || null : null }),
        ...(totalHours !== undefined && { totalHours: parseInt(totalHours, 10) }),
        ...(personalImpactEvaluation !== undefined && { personalImpactEvaluation: String(personalImpactEvaluation).trim() }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        module: 'VolunteerForm',
        entityId: req.params.id,
        entityType: 'VolunteerForm',
        newValue: JSON.stringify(req.body),
      },
    });

    res.json({ message: 'Form güncellendi.', form: updated });
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Delete Volunteer Form ─────────────────────────────────────
export async function adminDeleteVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const form = await prisma.volunteerForm.findUnique({ where: { id: req.params.id } });
    if (!form) throw new AppError(404, 'Form bulunamadı.');

    // We keep files in storage for audit reasons, or you can delete them here if preferred
    // For now we just delete the db record

    await prisma.volunteerForm.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        module: 'VolunteerForm',
        entityId: req.params.id,
        entityType: 'VolunteerForm',
        newValue: JSON.stringify({ message: 'Form silindi.' }),
      },
    });

    res.json({ message: 'Form başarıyla silindi.' });
  } catch (err) {
    next(err);
  }
}
