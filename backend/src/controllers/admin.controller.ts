import { Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import AdmZip from 'adm-zip';
import fs from 'fs';
import path from 'path';
import { format } from 'date-fns';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditAction, Role, StudentStatus } from '../types/enums';
import { storageService } from '../lib/storage';
import {
  sendAnnouncementEmail,
  sendNewPeriodEmail,
  sendMentorAssignedEmail,
} from '../lib/email.service';
import { seedStandardDocumentTypes } from '../utils/seed_docs';


const BCRYPT_ROUNDS = 12;

const periodEmailTimeouts = new Map<string, NodeJS.Timeout>();

function cancelPeriodEmail(periodId: string) {
  if (periodEmailTimeouts.has(periodId)) {
    clearTimeout(periodEmailTimeouts.get(periodId)!);
    periodEmailTimeouts.delete(periodId);
  }
}

function schedulePeriodEmail(periodId: string, delayMs: number = 300000) {
  cancelPeriodEmail(periodId);

  const timeout = setTimeout(async () => {
    periodEmailTimeouts.delete(periodId);
    try {
      const p = await prisma.documentPeriod.findUnique({ where: { id: periodId } });
      if (!p || !p.isOpen) return; // if deleted or closed within 5 mins, skip

      const targetCatIds: string[] | null = p.categoryIds ? JSON.parse(p.categoryIds) : null;
      const students = await prisma.studentProfile.findMany({
        where: { user: { isActive: true } },
        include: { user: { select: { email: true } } },
      });
      const targets = students.filter(s => {
        if (!targetCatIds || targetCatIds.length === 0) return true;
        return s.scholarshipCategoryId ? targetCatIds.includes(s.scholarshipCategoryId) : false;
      });
      const emails = targets.map(s => s.user.email).filter(Boolean) as string[];
      if (emails.length > 0) {
        await sendNewPeriodEmail({
          to: emails,
          periodLabel: p.label,
          periodType: p.type,
          deadline: p.endDate?.toString() || null,
        });
      }
    } catch (e) {
      console.error('[Email] Delayed period email error:', e);
    }
  }, delayMs);

  periodEmailTimeouts.set(periodId, timeout);
}

// ── Dashboard ────────────────────────────────────────────────────────
export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [totalStudents, pendingChanges, openDocPeriods, recentLogs, thisMonthDocs] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.approvableChange.count({ where: { status: 'PENDING' } }),
      prisma.documentPeriod.findMany({
        where: {
          OR: [
            { isOpen: true },
            { isVolunteerFormOpen: true }
          ]
        },
        select: { label: true }
      }),
      prisma.auditLog.findMany({
        where: {
          action: { in: ['APPROVE', 'REJECT', 'UPLOAD'] },
          user: { role: 'STUDENT' }
        },
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              tcKimlikNo: true,
              email: true,
              username: true,
              role: true,
              studentProfile: { select: { id: true, firstName: true, lastName: true } }
            }
          },
          approver: { select: { email: true, username: true } },
        },
      }),
      prisma.document.count({
        where: {
          uploadedAt: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
    ]);

    const activePeriods = new Set(openDocPeriods.map(p => p.label.trim())).size;

    res.json({
      stats: {
        totalStudents,
        pendingChanges,
        activePeriods,
        thisMonthDocs,
      },
      recentActivity: recentLogs,
    });
  } catch (err) {
    next(err);
  }
}

// ── List Students ────────────────────────────────────────────────────
export async function listStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      search, university, grade, studentStatus, enrollmentStatus,
      hasPending, scholarshipGroup, page = '1', limit = '20',
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { user: { tcKimlikNo: { contains: search as string } } },
      ];
    }
    if (university) where.universityName = { contains: university as string, mode: 'insensitive' };
    if (grade) where.grade = parseInt(grade as string);
    if (studentStatus) {
      where.studentStatus = studentStatus;
    } else {
      where.studentStatus = { not: 'GRADUATED' };
    }
    if (enrollmentStatus) where.enrollmentStatus = enrollmentStatus;
    if (scholarshipGroup) where.scholarshipCategoryId = scholarshipGroup;

    let profileIds: string[] | undefined;
    if (hasPending === 'true') {
      const withPending = await prisma.approvableChange.findMany({
        where: { status: 'PENDING' },
        select: { studentProfileId: true },
        distinct: ['studentProfileId'],
      });
      profileIds = withPending.map((p) => p.studentProfileId);
      if (profileIds.length === 0) {
        res.json({ data: [], pagination: { total: 0, page: 1, limit: Number(limit), totalPages: 0 } });
        return;
      }
      where.id = { in: profileIds };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [profiles, total] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        include: {
          user: { select: { id: true, tcKimlikNo: true, isActive: true } },
          mentor: true,
          scholarshipCategory: true,
          documents: true,
          _count: { select: { approvableChanges: { where: { status: 'PENDING' } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.studentProfile.count({ where }),
    ]);

    const openPeriods = await prisma.documentPeriod.findMany({
      where: { isOpen: true },
    });

    const mappedProfiles = profiles.map(profile => {
      let pendingCount = 0;
      let missingCount = 0;

      openPeriods.forEach(p => {
        let applies = true;
        if (p.categoryIds) {
          try {
            const catIds = JSON.parse(p.categoryIds);
            if (catIds.length > 0 && profile.scholarshipCategoryId && !catIds.includes(profile.scholarshipCategoryId)) {
              applies = false;
            }
          } catch { }
        }

        if (applies) {
          const doc = profile.documents.find(d => d.type === p.type && d.periodId === p.id);
          if (!doc) {
            missingCount++;
          } else if (doc.status === 'PENDING') {
            pendingCount++;
          } else if (doc.status === 'REJECTED') {
            missingCount++;
          }
        }
      });

      const { documents, ...rest } = profile;
      return {
        ...rest,
        documentStatus: {
          completed: missingCount === 0 && pendingCount === 0,
          missingCount,
          pendingCount,
        }
      };
    });

    res.json({
      data: mappedProfiles,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Bulk Remind Students ────────────────────────────────────────────────
export async function bulkRemindStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentIds } = req.body;
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError(400, 'Geçerli öğrenci ID listesi gereklidir.');
    }

    // Fetch student profiles from the database matching either StudentProfile.id or User.id
    const profiles = await prisma.studentProfile.findMany({
      where: {
        OR: [
          { id: { in: studentIds } },
          { userId: { in: studentIds } },
        ],
      },
      include: {
        user: true,
      },
    });

    if (profiles.length === 0) {
      throw new AppError(404, 'Seçilen öğrenciler bulunamadı.');
    }

    // Send emails
    const { sendMissingDocumentReminderEmail } = await import('../lib/email.service');

    let sentCount = 0;
    const sentEmails: string[] = [];
    const missingEmails: string[] = [];

    for (const p of profiles) {
      const targetEmail = (p.email && p.email.trim()) || (p.user?.email && p.user.email.trim());
      const studentName = `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Bursiyer';

      if (targetEmail) {
        console.log(`[BulkRemind] Sending reminder to ${studentName} (${targetEmail})...`);
        try {
          await sendMissingDocumentReminderEmail({
            to: targetEmail,
            firstName: p.firstName || 'Bursiyer',
          });
          sentCount++;
          sentEmails.push(targetEmail);
          console.log(`[BulkRemind] Successfully sent reminder to ${targetEmail}`);
        } catch (mailErr) {
          console.error(`[BulkRemind] Error sending to ${targetEmail}:`, mailErr);
        }
      } else {
        missingEmails.push(studentName);
        console.warn(`[BulkRemind] No email address found for ${studentName} (Profile ID: ${p.id})`);
      }
    }

    // Log the action
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Student',
        entityId: 'BULK',
        entityType: 'User',
        oldValue: 'E-posta Hatırlatma',
        newValue: `${sentCount} öğrenciye belge hatırlatması e-postası gönderildi: ${sentEmails.join(', ')}`,
      },
    });

    if (sentCount === 0 && missingEmails.length > 0) {
      throw new AppError(400, `Seçilen ${missingEmails.length} öğrencinin kayıtlı bir e-posta adresi bulunmuyor: ${missingEmails.join(', ')}`);
    }

    let msg = `${sentCount} öğrenciye belge hatırlatması başarıyla gönderildi.`;
    if (missingEmails.length > 0) {
      msg += ` (${missingEmails.length} öğrencinin e-postası kayıtlı olmadığı için atlandı: ${missingEmails.join(', ')})`;
    }

    res.json({ message: msg, sentCount, missingCount: missingEmails.length });
  } catch (err) {
    next(err);
  }
}

// ── Create Single Student ──────────────────────────────────────────────
export async function createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tcKimlikNo, firstName, lastName, scholarshipCategoryId, isNewStudent = true } = req.body;
    if (!tcKimlikNo || !/^\d{11}$/.test(tcKimlikNo)) {
      throw new AppError(400, 'Geçersiz TC formatı (11 hane olmalı)');
    }

    const existing = await prisma.user.findUnique({ where: { tcKimlikNo } });
    if (existing) {
      throw new AppError(400, 'Bu TC Kimlik No ile kayıtlı bir kullanıcı zaten var.');
    }

    const password = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        tcKimlikNo,
        passwordHash,
        role: Role.STUDENT,
        isActive: true,
        forcePasswordChange: true,
        studentProfile: {
          create: {
            firstName: firstName || '',
            lastName: lastName || '',
            scholarshipCategoryId: scholarshipCategoryId || null,
            studentStatus: 'INCOMPLETE',
            isInitialDocsExempt: !isNewStudent,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.CREATE,
        module: 'Student',
        entityId: user.id,
        entityType: 'User',
        newValue: tcKimlikNo,
      },
    });

    res.status(201).json({ tcKimlikNo, password });
  } catch (err) {
    next(err);
  }
}

// ── Update Student Profile (Admin direct edit) ────────────────────────
export async function updateStudentProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params; // StudentProfile ID
    const data = req.body;

    // Convert string empty values to null or valid data
    const profileData: any = { ...data };

    if (profileData.scholarshipCategoryId === '') {
      profileData.scholarshipCategoryId = null;
    }

    // Format boolean fields properly if sent as string
    ['fatherAlive', 'motherAlive', 'isInitialDocsExempt'].forEach(key => {
      if (profileData[key] !== undefined) {
        profileData[key] = profileData[key] === true || profileData[key] === 'true' || profileData[key] === 'Evet';
      }
    });

    // Parse numeric fields
    ['grade', 'fatherAge', 'fatherIncome', 'motherAge', 'motherIncome', 'familyMemberCount', 'siblingCount', 'siblingsInEducation', 'highSchoolGradYear', 'graduationYear', 'universityStartYear', 'universityPlacementRank'].forEach(key => {
      if (profileData[key] !== undefined) {
        profileData[key] = profileData[key] === '' ? null : Number(profileData[key]);
      }
    });

    // Parse date fields
    ['birthDate', 'scholarshipDate'].forEach(key => {
      if (profileData[key] !== undefined) {
        profileData[key] = profileData[key] ? new Date(profileData[key]) : null;
      }
    });

    if (profileData.sicilNo && profileData.sicilNo.trim() !== '') {
      const existingSicil = await prisma.studentProfile.findFirst({
        where: { sicilNo: profileData.sicilNo.trim(), id: { not: id } }
      });
      if (existingSicil) {
        throw new AppError(400, 'Bu Sicil No başka bir öğrenci tarafından kullanılıyor.');
      }
    }

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: profileData
    });

    // Sync email to User table and StudentProfile properly if provided
    if (profileData.email !== undefined) {
      const cleanEmail = profileData.email && typeof profileData.email === 'string' && profileData.email.trim() !== ''
        ? profileData.email.trim()
        : null;

      profileData.email = cleanEmail;

      if (cleanEmail) {
        const existingUserWithEmail = await prisma.user.findFirst({
          where: { email: cleanEmail, id: { not: updated.userId } }
        });
        if (existingUserWithEmail) {
          throw new AppError(400, 'Bu e-posta adresi sistemde başka bir hesap tarafından kullanılmaktadır.');
        }
      }

      await prisma.user.update({
        where: { id: updated.userId },
        data: { email: cleanEmail }
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Student',
        entityId: id,
        entityType: 'StudentProfile',
        newValue: JSON.stringify(profileData),
      }
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── Upload Student Profile Photo (Admin) ──────────────────────────────

export async function uploadStudentPhoto(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!req.file) throw new AppError(400, 'Dosya bulunamadı.');

    const profile = await prisma.studentProfile.findUnique({ where: { id } });
    if (!profile) throw new AppError(404, 'Öğrenci bulunamadı.');

    const storedFile = await storageService.save(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    // If there was an old photo, delete it (optional)
    if (profile.photoPath) {
      await storageService.delete(profile.photoPath).catch(console.error);
    }

    const updated = await prisma.studentProfile.update({
      where: { id },
      data: { photoPath: storedFile.filePath },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Student',
        entityId: id,
        entityType: 'StudentProfile',
        newValue: 'Photo Updated',
      }
    });

    res.json({ photoPath: updated.photoPath });
  } catch (err) {
    next(err);
  }
}

// ── Bulk Create Students ─────────────────────────────────────────────
export async function bulkCreateStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    let tcsArray: string[] = [];
    let group = '';
    const isJson = !!req.body.tcs;

    if (isJson) {
      tcsArray = String(req.body.tcs)
        .split('\n')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      group = String(req.body.scholarshipCategoryId || req.body.scholarshipGroup || '').trim();
    } else if (req.file) {
      const records = parse(req.file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      tcsArray = records.map((r: any) => String(r['TC Kimlik No'] || r['tc'] || r['TC'] || '').trim()).filter((t: any) => t.length > 0);
      group = String(req.body.scholarshipCategoryId || req.body.scholarshipGroup || '').trim();
    } else {
      throw new AppError(400, 'Parametre hatası. CSV dosyası veya TC listesi gerekli.');
    }

    if (!tcsArray.length) throw new AppError(400, 'Hiçbir TC Kimlik numarası bulunamadı.');

    const results: Array<{
      tcKimlikNo: string;
      firstName: string;
      lastName: string;
      password: string;
      status: 'created' | 'existing' | 'error';
      error?: string;
    }> = [];

    for (const tc of tcsArray) {
      if (!tc || !/^\d{11}$/.test(tc)) {
        results.push({ tcKimlikNo: tc, firstName: '', lastName: '', password: '', status: 'error', error: 'Geçersiz TC formatı (11 hane olmalı)' });
        continue;
      }

      // Check if already exists
      const existing = await prisma.user.findUnique({ where: { tcKimlikNo: tc } });
      if (existing) {
        results.push({ tcKimlikNo: tc, firstName: '', lastName: '', password: '', status: 'existing' });
        continue;
      }

      // Generate random 6-digit numeric password
      const password = Math.floor(100000 + Math.random() * 900000).toString();
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const isNew = req.body.isNewStudent !== undefined ? req.body.isNewStudent : true;

      try {
        const user = await prisma.user.create({
          data: {
            tcKimlikNo: tc,
            passwordHash,
            role: Role.STUDENT,
            isActive: true,
            forcePasswordChange: true,
            studentProfile: {
              create: {
                firstName: '',
                lastName: '',
                scholarshipCategoryId: group || null,
                studentStatus: StudentStatus.INCOMPLETE,
                isInitialDocsExempt: !isNew,
              },
            },
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user!.userId,
            action: AuditAction.CREATE,
            module: 'Student',
            entityId: user.id,
            entityType: 'User',
            newValue: tc,
          },
        });

        results.push({ tcKimlikNo: tc, firstName: 'Bursiyer', lastName: 'Adayı', password, status: 'created' });
      } catch (e) {
        results.push({ tcKimlikNo: tc, firstName: '', lastName: '', password: '', status: 'error', error: 'Veritabanına eklenemedi' });
      }
    }

    if (isJson) {
      res.json({ data: results });
      return;
    }

    // Generate result CSV for file upload
    const csvData = results.map((r) => ({
      'TC Kimlik No': r.tcKimlikNo,
      'Ad': r.firstName,
      'Soyad': r.lastName,
      'Şifre': r.status === 'created' ? r.password : '',
      'Durum': r.status === 'created' ? 'Oluşturuldu' : r.status === 'existing' ? 'Zaten Kayıtlı' : `Hata: ${r.error}`,
    }));

    const csv = stringify(csvData, { header: true });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="bursiyer-olusturma-sonucu-${Date.now()}.csv"`);
    res.send('\uFEFF' + csv); // BOM for Excel
  } catch (err) {
    next(err);
  }
}

// ── CSV Template ─────────────────────────────────────────────────────
export async function getCsvTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const template = stringify(
      [{ 'TC Kimlik No': '12345678901', 'Ad': 'Örnek', 'Soyad': 'Öğrenci' }],
      { header: true },
    );
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bursiyer-sablonu.csv"');
    res.send('\uFEFF' + template);
  } catch (err) {
    next(err);
  }
}

// ── List Periods ─────────────────────────────────────────────────────
export async function listPeriods(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const periods = await prisma.documentPeriod.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: true } },
      },
    });
    res.json(periods);
  } catch (err) {
    next(err);
  }
}

// ── Create Period ─────────────────────────────────────────────────────
export async function createPeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { type, label, semester, academicYear, grade, grades, isOpen, isVolunteerFormOpen, startDate, endDate, categoryIds } = req.body;
    if (!type || !label) throw new AppError(400, 'Tür ve etiket zorunludur.');

    // categoryIds: string[] | null → store as JSON string
    const categoryIdsStr = Array.isArray(categoryIds) && categoryIds.length > 0
      ? JSON.stringify(categoryIds)
      : null;

    const gradesStr = Array.isArray(grades) && grades.length > 0
      ? JSON.stringify(grades)
      : null;

    const period = await prisma.documentPeriod.create({
      data: { type, label, semester, academicYear, grade, grades: gradesStr, isOpen: isOpen ?? false, isVolunteerFormOpen: isVolunteerFormOpen ?? false, startDate, endDate, categoryIds: categoryIdsStr },
    });

    // Schedule email notifications if period is open
    if (period.isOpen) {
      schedulePeriodEmail(period.id);
    }

    res.status(201).json(period);
  } catch (err) {
    next(err);
  }
}

// ── Update Period ─────────────────────────────────────────────────────
export async function updatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isOpen, isVolunteerFormOpen, label, startDate, endDate, grade, grades, semester, academicYear, categoryIds } = req.body;

    const previousPeriod = await prisma.documentPeriod.findUnique({ where: { id } });

    let closedCount = 0;
    // (Auto-close logic removed per user request to allow multiple open periods simultaneously)

    // Build update data, including categoryIds if provided
    const updateData: any = { isOpen, label, startDate, endDate, grade, semester, academicYear };

    if (isVolunteerFormOpen !== undefined) {
      updateData.isVolunteerFormOpen = isVolunteerFormOpen;
    }

    if (grades !== undefined) {
      updateData.grades = Array.isArray(grades) && grades.length > 0
        ? JSON.stringify(grades)
        : null;
    }

    if (categoryIds !== undefined) {
      updateData.categoryIds = Array.isArray(categoryIds) && categoryIds.length > 0
        ? JSON.stringify(categoryIds)
        : null;
    }

    const period = await prisma.documentPeriod.update({
      where: { id },
      data: updateData,
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'DocumentPeriod',
        entityId: period.id,
        entityType: 'DocumentPeriod',
        newValue: JSON.stringify({ isOpen, isVolunteerFormOpen, label }),
      },
    });

    if (isOpen === true && previousPeriod?.isOpen === false) {
      schedulePeriodEmail(period.id);
    } else if (isOpen === false) {
      cancelPeriodEmail(period.id);
    }

    res.json({ ...period, autoClosedOtherSemesters: closedCount > 0 });
  } catch (err) {
    next(err);
  }
}

export async function deleteSemester(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { label, force } = req.body;
    if (!label) throw new AppError(400, 'Silinecek dönemin adı (label) gerekli.');

    // Find all periods with this label
    const periods = await prisma.documentPeriod.findMany({ where: { label } });
    if (periods.length === 0) {
      res.json({ message: 'Bu ada sahip bir dönem bulunamadı.' });
      return;
    }

    const periodIds = periods.map(p => p.id);

    // Check if any documents belong to these periods
    const documentCount = await prisma.document.count({
      where: { periodId: { in: periodIds } },
    });

    if (documentCount > 0) {
      if (!force) {
        throw new AppError(400, 'Bu döneme (tüm alt evraklarına) yüklenmiş belgeler var. Önce öğrencilerin yüklediği belgeleri silmelisiniz veya zorla silme seçeneğini işaretlemelisiniz.');
      }

      // Find documents to delete files from storage
      const documents = await prisma.document.findMany({
        where: { periodId: { in: periodIds } },
        select: { id: true, filePath: true }
      });

      const docIds = documents.map(d => d.id);

      // Delete files from storage
      for (const doc of documents) {
        if (doc.filePath) {
          try {
            await storageService.delete(doc.filePath);
          } catch (err) {
            console.error(`Belge silinemedi (ID: ${doc.id}, Yol: ${doc.filePath}):`, err);
          }
        }
      }

      // Delete ApprovableChanges
      await prisma.approvableChange.deleteMany({
        where: { documentId: { in: docIds } }
      });

      // Delete Documents
      await prisma.document.deleteMany({
        where: { periodId: { in: periodIds } }
      });
    }

    await prisma.documentPeriod.deleteMany({
      where: { label },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.DELETE,
        module: 'Semester',
        entityId: label,
        entityType: 'DocumentPeriodGroup',
        newValue: JSON.stringify({ deleted: true, count: periods.length, forceDeletedDocs: documentCount }),
      },
    });

    res.json({ message: 'Dönem tüm evraklarıyla birlikte başarıyla silindi.' });
  } catch (err) {
    next(err);
  }
}

export async function updateSemester(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { oldLabel, label, semester, academicYear, startDate, endDate, grade, grades, categoryIds, isVolunteerFormOpen } = req.body;
    if (!oldLabel) throw new AppError(400, 'Güncellenecek dönemin adı (oldLabel) gerekli.');

    // If changing label, ensure new label is not conflicting if it's different
    if (label && label !== oldLabel) {
      const existing = await prisma.documentPeriod.findFirst({ where: { label } });
      if (existing) {
        throw new AppError(400, 'Bu isimde başka bir dönem zaten mevcut.');
      }
    }

    const dataToUpdate: any = {};
    if (label !== undefined) dataToUpdate.label = label;
    if (semester !== undefined) dataToUpdate.semester = semester;
    if (academicYear !== undefined) dataToUpdate.academicYear = academicYear;
    if (startDate !== undefined) dataToUpdate.startDate = startDate;
    if (endDate !== undefined) dataToUpdate.endDate = endDate;
    if (grade !== undefined) dataToUpdate.grade = grade;
    if (grades !== undefined) dataToUpdate.grades = grades;
    if (isVolunteerFormOpen !== undefined) dataToUpdate.isVolunteerFormOpen = isVolunteerFormOpen;

    let updatedCount = 0;

    if (categoryIds !== undefined) {
      // If we are updating categories, we cannot just updateMany.
      // We must intersect the new semester categories with each document's native categories.
      const periodsToUpdate = await prisma.documentPeriod.findMany({ where: { label: oldLabel } });
      const docTypes = await prisma.documentTypeConfig.findMany();

      for (const p of periodsToUpdate) {
        const dt = docTypes.find(d => d.code === p.type);
        let nativeCats: string[] = [];
        if (dt && dt.categoryIds) {
          try { nativeCats = JSON.parse(dt.categoryIds); } catch { }
        }

        let finalCatIds = categoryIds.length > 0 ? [...categoryIds] : [];
        if (nativeCats.length > 0) {
          if (categoryIds.length > 0) {
            finalCatIds = nativeCats.filter(id => categoryIds.includes(id));
          } else {
            finalCatIds = nativeCats;
          }
        }

        await prisma.documentPeriod.update({
          where: { id: p.id },
          data: {
            ...dataToUpdate,
            categoryIds: finalCatIds.length > 0 ? JSON.stringify(finalCatIds) : null,
          },
        });
      }
      updatedCount = periodsToUpdate.length;
    } else {
      const updated = await prisma.documentPeriod.updateMany({
        where: { label: oldLabel },
        data: dataToUpdate,
      });
      updatedCount = updated.count;
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Semester',
        entityId: oldLabel,
        entityType: 'DocumentPeriodGroup',
        newValue: JSON.stringify(dataToUpdate),
      },
    });

    res.json({ message: 'Dönem bilgileri başarıyla güncellendi.', updatedCount });
  } catch (err) {
    next(err);
  }
}

export async function deletePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Check if any documents belong to this period
    const documentCount = await prisma.document.count({
      where: { periodId: id },
    });

    if (documentCount > 0) {
      throw new AppError(400, 'Bu belge talebine yüklenmiş öğrenci belgeleri bulunmaktadır. Önce bu belgeleri silmeli veya talebi kapatmalısınız.');
    }

    const period = await prisma.documentPeriod.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.DELETE,
        module: 'DocumentPeriod',
        entityId: period.id,
        entityType: 'DocumentPeriod',
        newValue: JSON.stringify({ deleted: true, label: period.label, type: period.type }),
      },
    });

    res.json({ message: 'Belge talebi başarıyla kaldırıldı.' });
  } catch (err) {
    next(err);
  }
}

// ── List Users (reviewers, admins) ──────────────────────────────────
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: [Role.REVIEWER, Role.ADMIN] } },
      select: { id: true, email: true, username: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// ── Create User (reviewer, admin) ───────────────────────────────────
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, username, password, role } = req.body;
    if (!email || !password) throw new AppError(400, 'E-posta ve şifre zorunludur.');
    if (role === Role.STUDENT || role === Role.MENTOR) {
      throw new AppError(400, 'Bu yetki rolüyle kullanıcı oluşturulamaz.');
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError(400, 'Bu e-posta adresi zaten kullanımda.');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email,
        username: username || email,
        passwordHash,
        role: role || Role.REVIEWER,
        isActive: true,
      },
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    });
  } catch (err) {
    next(err);
  }
}

// ── Delete User ───────────────────────────────────────────────────────
export async function deleteUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (id === req.user!.userId) throw new AppError(400, 'Kendi hesabınızı silemezsiniz.');

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'Kullanıcı bulunamadı.');
    if (user.role === Role.STUDENT) throw new AppError(400, 'Öğrenci hesabı bu endpoint ile silinemez.');

    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ message: 'Kullanıcı devre dışı bırakıldı.' });
  } catch (err) {
    next(err);
  }
}

// ── Update User ───────────────────────────────────────────────────────
export async function updateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { email, username, role, password, isActive } = req.body;

    if (role === Role.STUDENT || role === Role.MENTOR) {
      throw new AppError(400, 'Bu yetki rolüne güncellenemez.');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, 'Kullanıcı bulunamadı.');

    if (email && email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) throw new AppError(400, 'Bu e-posta adresi zaten kullanımda.');
    }

    const dataToUpdate: any = {};
    if (email) dataToUpdate.email = email;
    if (username) dataToUpdate.username = username;
    if (role) dataToUpdate.role = role;
    if (isActive !== undefined) dataToUpdate.isActive = isActive;
    if (password) {
      dataToUpdate.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    res.json({
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      role: updatedUser.role,
    });
  } catch (err) {
    next(err);
  }
}

// ── Reset Student Password ────────────────────────────────────────────
export async function resetStudentPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params; // this is the profileId

    const profile = await prisma.studentProfile.findUnique({
      where: { id },
    });
    if (!profile) throw new AppError(404, 'Öğrenci bulunamadı.');

    const user = await prisma.user.findFirst({
      where: { id: profile.userId, role: Role.STUDENT },
    });
    if (!user) throw new AppError(404, 'Öğrenci kullanıcısı bulunamadı.');

    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Student',
        entityId: user.id,
        entityType: 'User',
        newValue: 'Password Reset',
      },
    });

    res.json({ message: 'Şifre başarıyla sıfırlandı.', password: newPassword });
  } catch (err) {
    next(err);
  }
}

// ── List Mentors ─────────────────────────────────────────────────────
export async function listMentors(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const mentors = await prisma.mentorProfile.findMany({
      include: {
        _count: { select: { students: true } },
        students: { select: { id: true, firstName: true, lastName: true, universityName: true } }
      },
      orderBy: { firstName: 'asc' },
    });
    res.json(mentors);
  } catch (err) {
    next(err);
  }
}

// ── Create Mentor ────────────────────────────────────────────────────
export async function createMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }
    const { firstName, lastName, title, company, phone, email } = req.body;
    if (!firstName || !lastName) {
      throw new AppError(400, 'Ad ve soyad zorunludur.');
    }

    let photoPath: string | undefined;
    if (req.file) {
      const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);
      photoPath = stored.filePath;
    }

    const mentor = await prisma.mentorProfile.create({
      data: {
        firstName,
        lastName,
        title: title || null,
        company: company || null,
        phone: phone || null,
        email: email || null,
        photoPath: photoPath || null,
      },
    });

    res.status(201).json(mentor);
  } catch (err) {
    next(err);
  }
}

// ── Update Mentor ────────────────────────────────────────────────────
export async function updateMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }
    const { id } = req.params;
    const { firstName, lastName, title, company, phone, email } = req.body;

    const mentor = await prisma.mentorProfile.findUnique({ where: { id } });
    if (!mentor) throw new AppError(404, 'Mentör bulunamadı.');

    let photoPath = mentor.photoPath;
    if (req.file) {
      const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);
      if (photoPath) await storageService.delete(photoPath).catch(console.error);
      photoPath = stored.filePath;
    }

    const updated = await prisma.mentorProfile.update({
      where: { id },
      data: {
        firstName: firstName || mentor.firstName,
        lastName: lastName || mentor.lastName,
        title: title !== undefined ? title : mentor.title,
        company: company !== undefined ? company : mentor.company,
        phone: phone !== undefined ? phone : mentor.phone,
        email: email !== undefined ? email : mentor.email,
        photoPath,
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// ── Delete Mentor ────────────────────────────────────────────────────
export async function deleteMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }
    const { id } = req.params;
    const mentor = await prisma.mentorProfile.findUnique({ where: { id } });
    if (!mentor) {
      throw new AppError(404, 'Mentör bulunamadı.');
    }

    if (mentor.photoPath) {
      try {
        await storageService.delete(mentor.photoPath);
      } catch (e) {
        console.error('Error deleting mentor photo:', e);
      }
    }

    await prisma.mentorProfile.delete({ where: { id } });
    res.json({ message: 'Mentör silindi.' });
  } catch (err) {
    next(err);
  }
}

// ── Assign Mentor ────────────────────────────────────────────────────
export async function assignMentor(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId, mentorId } = req.body;

    if (!studentId) throw new AppError(400, 'Öğrenci profil ID gerekli.');

    // Check if student exists
    const student = await prisma.studentProfile.findUnique({ where: { id: studentId } });
    if (!student) throw new AppError(404, 'Öğrenci bulunamadı.');

    if (mentorId) {
      // Assigning a mentor
      const mentor = await prisma.mentorProfile.findUnique({ where: { id: mentorId } });
      if (!mentor) throw new AppError(404, 'Mentör bulunamadı.');
    }

    const updatedStudent = await prisma.studentProfile.update({
      where: { id: studentId },
      data: { mentorId: mentorId || null },
      include: { mentor: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Student',
        entityId: studentId,
        entityType: 'StudentProfile',
        newValue: `Mentor assigned: ${mentorId || 'None'}`,
      },
    });

    // Send email to student if a mentor was assigned (fire-and-forget)
    if (mentorId && updatedStudent.mentor) {
      (async () => {
        try {
          const studentUser = await prisma.user.findUnique({
            where: { id: updatedStudent.userId },
            select: { email: true },
          });
          if (studentUser?.email) {
            await sendMentorAssignedEmail({
              to: studentUser.email,
              firstName: updatedStudent.firstName,
              mentorFirstName: updatedStudent.mentor!.firstName,
              mentorLastName: updatedStudent.mentor!.lastName,
              mentorTitle: updatedStudent.mentor!.title,
              mentorCompany: updatedStudent.mentor!.company,
              mentorEmail: updatedStudent.mentor!.email,
              mentorPhone: updatedStudent.mentor!.phone,
            });
          }
        } catch (e) {
          console.error('[Email] Mentor assign email error:', e);
        }
      })();
    }

    res.json(updatedStudent);
  } catch (err) {
    next(err);
  }
}

// ── Export Students Report ───────────────────────────────────────────
export async function exportStudentsReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      search, university, grade, studentStatus, enrollmentStatus,
      hasPending, scholarshipGroup, includeGraduates,
    } = req.query;

    const where: any = {};

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { user: { tcKimlikNo: { contains: search as string } } },
      ];
    }
    if (university) where.universityName = { contains: university as string, mode: 'insensitive' };
    if (grade) where.grade = parseInt(grade as string);

    if (studentStatus) {
      where.studentStatus = studentStatus;
    } else {
      if (includeGraduates !== 'true') {
        where.studentStatus = { not: 'GRADUATED' };
      }
    }

    if (enrollmentStatus) where.enrollmentStatus = enrollmentStatus;
    if (scholarshipGroup) where.scholarshipCategoryId = scholarshipGroup;

    if (hasPending === 'true') {
      const withPending = await prisma.approvableChange.findMany({
        where: { status: 'PENDING' },
        select: { studentProfileId: true },
        distinct: ['studentProfileId'],
      });
      const profileIds = withPending.map((p) => p.studentProfileId);
      if (profileIds.length === 0) {
        where.id = { in: [] };
      } else {
        where.id = { in: profileIds };
      }
    }

    const students = await prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { tcKimlikNo: true, email: true, isActive: true } },
        scholarshipCategory: true,
        mentor: true,
        documents: {
          include: { period: true },
        },
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });

    const activePeriods = await prisma.documentPeriod.findMany({ where: { isOpen: true } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Faydasıçok Eğitim Vakfı';
    workbook.created = new Date();

    const statusTranslations: Record<string, string> = {
      ACTIVE: 'Aktif',
      PASSIVE: 'Pasif',
      GRADUATED: 'Mezun',
      INCOMPLETE: 'İlk Kayıt / Eksik',
    };

    function applyProfessionalStyle(sheet: ExcelJS.Worksheet, headerColorArgb = 'FF1E3A8A') {
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      sheet.properties.defaultRowHeight = 26;

      const headerRow = sheet.getRow(1);
      headerRow.height = 32;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: headerColorArgb },
        };
        cell.font = {
          name: 'Calibri',
          size: 11,
          bold: true,
          color: { argb: 'FFFFFFFF' },
        };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      });

      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.height = 24;
        const isEven = rowNumber % 2 === 0;
        row.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (isEven) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF8FAFC' },
            };
          }
        });
      });
    }

    // ───────────────────────────────────────────────
    // 1. TÜM BURSİYERLER DETAYLI SAYFASI
    // ───────────────────────────────────────────────
    const allStudentsSheet = workbook.addWorksheet('Tüm Bursiyerler');
    allStudentsSheet.columns = [
      { header: 'Sicil No', key: 'sicilNo', width: 40 },
      { header: 'Program', key: 'program', width: 25 },
      { header: 'Adı', key: 'firstName', width: 20 },
      { header: 'Soyadı', key: 'lastName', width: 20 },
      { header: 'Cinsiyet', key: 'gender', width: 15 },
      { header: 'TCKN', key: 'tc', width: 20 },
      { header: 'IBAN', key: 'iban', width: 35 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Telefon', key: 'phone', width: 20 },
      { header: 'Otomatik İnci Adı', key: 'inciName', width: 25 },
      { header: 'Doğum Tarihi', key: 'birthDate', width: 20 },
      { header: 'Aile İkamet Şehri', key: 'familyCity', width: 25 },
      { header: 'Anne/Baba Sağ', key: 'parentsStatus', width: 25 },
      { header: 'Referans Bilgisi / Hasçelik Çalışanı vb.', key: 'referenceInfo', width: 40 },
      { header: 'Aile İletişim Telefonu', key: 'familyPhone', width: 25 },
      { header: 'Okulu', key: 'universityName', width: 35 },
      { header: 'Bölümü', key: 'department', width: 30 },
      { header: 'Sınıfı', key: 'grade', width: 15 },
      { header: 'Okul Başlangıç Yılı', key: 'universityStartYear', width: 20 },
      { header: 'Üniversite Yerleştirme Sırası', key: 'universityPlacementRank', width: 25 },
      { header: 'Üni.Haz.Okudu mu?', key: 'hadPrepClass', width: 20 },
      { header: 'Okul Şehri', key: 'universityCity', width: 20 },
      { header: 'Konaklama', key: 'accommodationType', width: 25 },
      { header: 'Bursiyer Sözleşmesini İmzaladı mı?', key: 'isContractSigned', width: 25 },
      { header: 'Son Durumu', key: 'studentStatus', width: 20 },
      { header: 'Askı Baslangıcı', key: 'suspensionStartDate', width: 20 },
      { header: 'Askı Sonu', key: 'suspensionEndDate', width: 20 },
      { header: 'Askı notu', key: 'suspensionNote', width: 30 },
      { header: 'Erasmus\'a Gidiş Tarihi', key: 'erasmusStartDate', width: 20 },
      { header: 'Erasmus\'dan Dönüş Tarihi', key: 'erasmusEndDate', width: 20 },
      { header: 'Erasmus Ülkesi/ Okulu', key: 'erasmusSchoolCountry', width: 25 },
      { header: 'Mezun Şehri', key: 'graduateCity', width: 20 },
      { header: 'Mezun Şirketi', key: 'graduateCompany', width: 25 },
      { header: 'Linkedin Bağlantı', key: 'linkedinUrl', width: 35 },
      { header: 'MZN NOT', key: 'graduateNote', width: 30 },
      { header: 'İlgi Alanları', key: 'interests', width: 35 },
      { header: 'Nasıl Bir Mentör İster', key: 'mentorExpectation', width: 35 }
    ];

    students.forEach((s) => {
      allStudentsSheet.addRow({
        userType: s.userType || '',
        sicilNo: s.sicilNo || '',
        program: s.scholarshipCategory?.name || s.program || 'Tanımsız / Genel',
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        gender: s.gender || '',
        tc: s.user?.tcKimlikNo || '',
        iban: s.iban || '',
        email: s.user?.email || s.email || '',
        phone: s.phone || '',
        inciName: s.inciName || '',
        birthDate: s.birthDate ? format(new Date(s.birthDate), 'dd.MM.yyyy') : '',
        familyCity: s.familyCity || '',
        parentsStatus: s.parentsStatus || '',
        referenceInfo: s.referenceInfo || '',
        familyPhone: s.familyPhone || '',
        universityName: s.universityName || '',
        department: s.department || '',
        grade: s.grade || '',
        universityStartYear: s.universityStartYear || '',
        universityPlacementRank: s.universityPlacementRank || '',
        hadPrepClass: s.hadPrepClass || '',
        universityCity: s.universityCity || '',
        accommodationType: s.accommodationType || '',
        isContractSigned: s.isContractSigned ? 'Evet' : 'Hayır',
        studentStatus: statusTranslations[s.studentStatus] || s.studentStatus || '—',
        suspensionStartDate: s.suspensionStartDate ? format(new Date(s.suspensionStartDate), 'dd.MM.yyyy') : '',
        suspensionEndDate: s.suspensionEndDate ? format(new Date(s.suspensionEndDate), 'dd.MM.yyyy') : '',
        suspensionNote: s.suspensionNote || '',
        erasmusStartDate: s.erasmusStartDate ? format(new Date(s.erasmusStartDate), 'dd.MM.yyyy') : '',
        erasmusEndDate: s.erasmusEndDate ? format(new Date(s.erasmusEndDate), 'dd.MM.yyyy') : '',
        erasmusSchoolCountry: s.erasmusSchoolCountry || '',
        graduateCity: s.graduateCity || '',
        graduateCompany: s.graduateCompany || '',
        linkedinUrl: s.linkedinUrl || '',
        graduateNote: s.graduateNote || '',
        interests: s.interests || '',
        mentorExpectation: s.mentorExpectation || '',
      });
    });

    applyProfessionalStyle(allStudentsSheet, 'FF1E3A8A');

    // ───────────────────────────────────────────────
    // 2. EKSİK BELGELİ ÖĞRENCİLER SAYFASI
    // ───────────────────────────────────────────────
    const missingDocsSheet = workbook.addWorksheet('Eksik Belgeli Öğrenciler');
    missingDocsSheet.columns = [
      { header: 'T.C. Kimlik No', key: 'tc', width: 16 },
      { header: 'Adı', key: 'firstName', width: 16 },
      { header: 'Soyadı', key: 'lastName', width: 16 },
      { header: 'Bursiyer Kategorisi', key: 'category', width: 24 },
      { header: 'Üniversite', key: 'uni', width: 30 },
      { header: 'Bölüm', key: 'dept', width: 28 },
      { header: 'Sınıf', key: 'grade', width: 10 },
      { header: 'Telefon', key: 'phone', width: 16 },
      { header: 'E-Posta', key: 'email', width: 28 },
      { header: 'Eksik Belge / Dönem', key: 'missingDoc', width: 32 },
    ];

    if (activePeriods.length > 0) {
      students.forEach((s) => {
        if (s.studentStatus !== 'GRADUATED' && s.studentStatus !== 'PASSIVE') {
          activePeriods.forEach((period) => {
            const hasDoc = s.documents.some(
              (d) => d.periodId === period.id && (d.status === 'APPROVED' || d.status === 'PENDING')
            );
            if (!hasDoc) {
              missingDocsSheet.addRow({
                tc: s.user?.tcKimlikNo || '',
                firstName: s.firstName || '',
                lastName: s.lastName || '',
                category: s.scholarshipCategory?.name || 'Genel',
                uni: s.universityName || '',
                dept: s.department || '',
                grade: s.grade ? `${s.grade}. Sınıf` : '',
                phone: s.phone || '',
                email: s.user?.email || s.email || '',
                missingDoc: `${period.label} (${period.type})`,
              });
            }
          });
        }
      });
    } else {
      missingDocsSheet.addRow({
        tc: '—',
        firstName: 'Aktif evrak yükleme dönemi bulunmuyor.',
      });
    }

    applyProfessionalStyle(missingDocsSheet, 'FFB91C1C'); // Crimson Red Header

    // ───────────────────────────────────────────────
    // 3. ÖZET İSTATİSTİKLER SAYFASI
    // ───────────────────────────────────────────────
    const statsSheet = workbook.addWorksheet('Özet İstatistikler');
    statsSheet.columns = [
      { header: 'Grup / Boyut', key: 'group', width: 24 },
      { header: 'Kategori / Değer', key: 'value', width: 36 },
      { header: 'Öğrenci Sayısı', key: 'count', width: 16 },
      { header: 'Yüzde (%)', key: 'percent', width: 14 },
    ];

    const categoryStats: Record<string, number> = {};
    const statusStats: Record<string, number> = {};
    const uniStats: Record<string, number> = {};
    const deptStats: Record<string, number> = {};
    let withMentor = 0;
    let withoutMentor = 0;

    const totalStudents = students.length;

    students.forEach((s) => {
      const cat = s.scholarshipCategory?.name || 'Tanımsız / Genel';
      const status = statusTranslations[s.studentStatus] || s.studentStatus || 'Bilinmiyor';
      const uni = s.universityName || 'Belirtilmemiş';
      const dept = s.department || 'Belirtilmemiş';

      categoryStats[cat] = (categoryStats[cat] || 0) + 1;
      statusStats[status] = (statusStats[status] || 0) + 1;
      uniStats[uni] = (uniStats[uni] || 0) + 1;
      deptStats[dept] = (deptStats[dept] || 0) + 1;

      if (s.mentorId) withMentor++;
      else withoutMentor++;
    });

    // Add Category Stats
    Object.entries(categoryStats).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Bursiyer Kategorisi',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });
    statsSheet.addRow({});

    // Add Status Stats
    Object.entries(statusStats).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Bursiyerlik Durumu',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });
    statsSheet.addRow({});

    // Mentorship Stats
    statsSheet.addRow({
      group: 'Mentörlük Eşleşmesi',
      value: 'Mentörü Olan Bursiyerler',
      count: withMentor,
      percent: totalStudents ? `%${((withMentor / totalStudents) * 100).toFixed(1)}` : '0',
    });
    statsSheet.addRow({
      group: 'Mentörlük Eşleşmesi',
      value: 'Mentör Bekleyen Bursiyerler',
      count: withoutMentor,
      percent: totalStudents ? `%${((withoutMentor / totalStudents) * 100).toFixed(1)}` : '0',
    });
    statsSheet.addRow({});

    // University Stats
    Object.entries(uniStats).sort((a, b) => b[1] - a[1]).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Üniversite Dağılımı',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });
    statsSheet.addRow({});

    // Department Stats (Top 15)
    Object.entries(deptStats).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([val, count]) => {
      statsSheet.addRow({
        group: 'Bölüm Dağılımı (İlk 15)',
        value: val,
        count,
        percent: totalStudents ? `%${((count / totalStudents) * 100).toFixed(1)}` : '0',
      });
    });

    applyProfessionalStyle(statsSheet, 'FF047857'); // Emerald Green Header

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="faydasicok_bursiyer_raporu.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// ── Document Type Config (Dynamic Document Types) ────────────────────

export async function listDocumentTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const types = await prisma.documentTypeConfig.findMany({
      orderBy: [{ isStatic: 'asc' }, { order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json(types);
  } catch (err) {
    next(err);
  }
}

export async function createDocumentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, name, description, customFields, isActive, categoryIds, isStatic, isRequired, hasTemplate, templatePath, templateName, order } = req.body;
    if (!code || !name) throw new AppError(400, 'Kod ve Ad zorunludur.');

    const existing = await prisma.documentTypeConfig.findUnique({ where: { code } });
    if (existing) throw new AppError(400, 'Bu koda sahip bir belge türü zaten var.');

    const categoryIdsStr = Array.isArray(categoryIds) && categoryIds.length > 0
      ? JSON.stringify(categoryIds)
      : null;

    const type = await prisma.documentTypeConfig.create({
      data: {
        code,
        name,
        description,
        customFields,
        isActive: isActive ?? true,
        categoryIds: categoryIdsStr,
        isStatic: isStatic ?? false,
        isRequired: isRequired ?? true,
        hasTemplate: hasTemplate ?? false,
        templatePath: templatePath || null,
        templateName: templateName || null,
        order: order ? Number(order) : 0,
      },
    });
    res.status(201).json(type);
  } catch (err) {
    next(err);
  }
}

export async function updateDocumentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { code, name, description, customFields, isActive, categoryIds, isStatic, isRequired, hasTemplate, templatePath, templateName, order } = req.body;

    if (code) {
      const existing = await prisma.documentTypeConfig.findUnique({ where: { code } });
      if (existing && existing.id !== id) {
        throw new AppError(400, 'Bu koda sahip başka bir belge türü var.');
      }
    }

    const updateData: any = { code, name, description, customFields, isActive };
    if (categoryIds !== undefined) {
      updateData.categoryIds = Array.isArray(categoryIds) && categoryIds.length > 0
        ? JSON.stringify(categoryIds)
        : null;
    }
    if (isStatic !== undefined) updateData.isStatic = isStatic;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (hasTemplate !== undefined) updateData.hasTemplate = hasTemplate;
    if (templatePath !== undefined) updateData.templatePath = templatePath;
    if (templateName !== undefined) updateData.templateName = templateName;
    if (order !== undefined) updateData.order = Number(order);

    const type = await prisma.documentTypeConfig.update({
      where: { id },
      data: updateData,
    });
    res.json(type);
  } catch (err) {
    next(err);
  }
}

export async function deleteDocumentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    await prisma.documentTypeConfig.delete({ where: { id } });
    res.json({ message: 'Belge türü silindi.' });
  } catch (err) {
    next(err);
  }
}

export async function initStandardDocumentTypes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await seedStandardDocumentTypes();

    // Set all existing students as exempt so they are not asked for static onboarding docs
    await prisma.studentProfile.updateMany({
      data: { isInitialDocsExempt: true },
    });

    res.json({ message: 'Standart belge türleri oluşturuldu ve mevcut bursiyerler muaf olarak işaretlendi.' });
  } catch (err) {
    next(err);
  }
}

// ── Scholarship Categories ─────────────────────────────────────────────

export async function listScholarshipCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const categories = await prisma.scholarshipCategory.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
}

export async function createScholarshipCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, description } = req.body;
    if (!name) throw new AppError(400, 'Kategori adı zorunludur.');

    const category = await prisma.scholarshipCategory.create({
      data: { name: name.trim(), description: description?.trim() },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.CREATE,
        module: 'ScholarshipCategory',
        entityId: category.id,
        entityType: 'ScholarshipCategory',
        newValue: category.name,
      },
    });

    res.status(201).json(category);
  } catch (err: any) {
    if (err.code === 'P2002') return next(new AppError(400, 'Bu kategori adı zaten kullanılıyor.'));
    next(err);
  }
}

export async function updateScholarshipCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { name, description, isActive } = req.body;

    const data: any = {};
    if (name !== undefined) data.name = name.trim();
    if (description !== undefined) data.description = description.trim();
    if (isActive !== undefined) data.isActive = Boolean(isActive);

    const category = await prisma.scholarshipCategory.update({
      where: { id },
      data,
    });

    res.json(category);
  } catch (err) {
    next(err);
  }
}

export async function deleteScholarshipCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    // Check if any student is using it
    const inUse = await prisma.studentProfile.count({ where: { scholarshipCategoryId: id } });
    if (inUse > 0) throw new AppError(400, 'Bu kategoriye ait öğrenciler bulunduğu için silinemez. Pasife almayı deneyin.');

    await prisma.scholarshipCategory.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.DELETE,
        module: 'ScholarshipCategory',
        entityId: id,
        entityType: 'ScholarshipCategory',
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

// ── Announcements ──────────────────────────────────────────────────────

export async function listAnnouncements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(announcements);
  } catch (err) {
    next(err);
  }
}

export async function createAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { title, content, categoryIds, isActive } = req.body;
    if (!title || !content) throw new AppError(400, 'Başlık ve içerik zorunludur.');

    const categoryIdsStr = Array.isArray(categoryIds) && categoryIds.length > 0
      ? JSON.stringify(categoryIds)
      : null;

    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        content: content.trim(),
        categoryIds: categoryIdsStr,
        isActive: isActive ?? true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.CREATE,
        module: 'Announcement',
        entityId: announcement.id,
        entityType: 'Announcement',
        newValue: announcement.title,
      },
    });

    // Send email notifications to target students (fire-and-forget)
    (async () => {
      try {
        const targetCatIds: string[] | null = categoryIdsStr ? JSON.parse(categoryIdsStr) : null;
        const students = await prisma.studentProfile.findMany({
          where: { user: { isActive: true } },
          include: { user: { select: { email: true } } },
        });
        const targets = students.filter(s => {
          if (!targetCatIds || targetCatIds.length === 0) return true;
          return s.scholarshipCategoryId ? targetCatIds.includes(s.scholarshipCategoryId) : false;
        });
        const emails = targets.map(s => s.user.email).filter(Boolean) as string[];
        if (emails.length > 0) {
          await sendAnnouncementEmail({
            to: emails,
            announcementTitle: announcement.title,
            announcementContent: announcement.content,
          });
        }
      } catch (e) {
        console.error('[Email] Announcement email error:', e);
      }
    })();

    res.status(201).json(announcement);
  } catch (err) {
    next(err);
  }
}

export async function updateAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { title, content, categoryIds, isActive } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = title.trim();
    if (content !== undefined) updateData.content = content.trim();
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (categoryIds !== undefined) {
      updateData.categoryIds = Array.isArray(categoryIds) && categoryIds.length > 0
        ? JSON.stringify(categoryIds)
        : null;
    }

    const announcement = await prisma.announcement.update({
      where: { id },
      data: updateData,
    });

    res.json(announcement);
  } catch (err) {
    next(err);
  }
}

export async function deleteAnnouncement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    await prisma.announcement.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.DELETE,
        module: 'Announcement',
        entityId: id,
        entityType: 'Announcement',
      },
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function downloadDocumentsZip(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { periodLabel, entity, documentType, status, categoryId, category } = req.query;

    const docType = (documentType || entity) ? String(documentType || entity) : undefined;
    const catId = (categoryId || category) ? String(categoryId || category) : undefined;
    const statusVal = status ? String(status) : undefined;

    const where: any = {};

    // Status filter
    if (statusVal && statusVal !== 'ALL') {
      where.status = statusVal;
    }

    // Document Type filter
    if (docType && docType !== 'DOCUMENT' && docType !== 'ALL' && !['BANK_INFO', 'PERSONAL_INFO', 'FAMILY_INFO', 'EDUCATION_INFO', 'CONTACT_INFO'].includes(docType)) {
      where.type = docType;
    }

    // Period filter
    if (periodLabel && periodLabel !== 'ALL') {
      where.period = { label: String(periodLabel) };
    }

    // Category filter
    if (catId && catId !== 'ALL') {
      where.studentProfile = { scholarshipCategoryId: catId };
    }

    const documents = await prisma.document.findMany({
      where,
      include: {
        studentProfile: {
          include: { user: true, scholarshipCategory: true },
        },
        period: true,
      },
      orderBy: { uploadedAt: 'desc' },
    });

    if (documents.length === 0) {
      throw new AppError(404, 'Seçili filtrelere uygun yüklenmiş belge bulunamadı.');
    }

    const zip = new AdmZip();
    let hasFiles = false;
    const addedFileNames = new Set<string>();

    for (const doc of documents) {
      const filePath = path.join(__dirname, '../../', doc.filePath);
      if (fs.existsSync(filePath)) {
        const studentName = `${doc.studentProfile.firstName}_${doc.studentProfile.lastName}`
          .replace(/[^a-zA-Z0-9_ğüşöçİĞÜŞÖÇ]/g, '_');
        const tc = doc.studentProfile.user?.tcKimlikNo || doc.studentProfile.id.slice(0, 8);
        const docTypeName = doc.type;
        const ext = path.extname(doc.filePath) || '.pdf';

        let zipEntryName = `${studentName}_${tc}_${docTypeName}${ext}`;
        let counter = 1;
        while (addedFileNames.has(zipEntryName)) {
          zipEntryName = `${studentName}_${tc}_${docTypeName}_${counter}${ext}`;
          counter++;
        }
        addedFileNames.add(zipEntryName);

        zip.addLocalFile(filePath, '', zipEntryName);
        hasFiles = true;
      }
    }

    if (!hasFiles) {
      throw new AppError(404, 'Seçili filtrelere ait dosyalar sunucuda fiziksel olarak bulunamadı.');
    }

    const zipBuffer = zip.toBuffer();
    const safePeriodName = periodLabel ? `${String(periodLabel).replace(/[^a-zA-Z0-9_ğüşöçİĞÜŞÖÇ]/g, '_')}_` : '';
    const safeDocTypeName = docType && docType !== 'DOCUMENT' && docType !== 'ALL' ? `${docType}_` : '';
    const filename = `${safePeriodName}${safeDocTypeName}belgeleri.zip` || 'toplu_belgeler.zip';

    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.set('Content-Length', zipBuffer.length.toString());

    res.send(zipBuffer);
  } catch (err) {
    next(err);
  }
}

// ── Graduates Management ─────────────────────────────────────────────

export async function listGraduates(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { search, year, categoryId, page = '1', limit = '20' } = req.query;
    const where: any = { studentStatus: 'GRADUATED' };

    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { user: { tcKimlikNo: { contains: search as string } } },
      ];
    }
    if (year && year !== 'ALL') {
      where.graduationYear = parseInt(year as string);
    }
    if (categoryId && categoryId !== 'ALL') {
      where.scholarshipCategoryId = categoryId as string;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [profiles, total, allGradYears] = await Promise.all([
      prisma.studentProfile.findMany({
        where,
        include: {
          user: { select: { id: true, tcKimlikNo: true, email: true, isActive: true } },
          scholarshipCategory: true,
          mentor: true,
        },
        orderBy: [{ graduationYear: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
        skip,
        take: Number(limit),
      }),
      prisma.studentProfile.count({ where }),
      prisma.studentProfile.findMany({
        where: { studentStatus: 'GRADUATED', graduationYear: { not: null } },
        select: { graduationYear: true },
        distinct: ['graduationYear'],
        orderBy: { graduationYear: 'desc' },
      }),
    ]);

    const years = allGradYears.map(g => g.graduationYear).filter(Boolean) as number[];

    res.json({
      data: profiles,
      years,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function graduateStudents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentIds, graduationYear } = req.body;
    if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
      throw new AppError(400, 'Lütfen en az bir öğrenci seçiniz.');
    }
    const year = graduationYear ? parseInt(graduationYear) : new Date().getFullYear();

    const students = await prisma.studentProfile.findMany({
      where: { id: { in: studentIds } },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });

    const userIds = students.map(s => s.userId);

    await prisma.$transaction([
      prisma.studentProfile.updateMany({
        where: { id: { in: studentIds } },
        data: {
          studentStatus: 'GRADUATED',
          enrollmentStatus: 'GRADUATED',
          graduationYear: year,
          graduatedAt: new Date(),
        },
      }),
      prisma.user.updateMany({
        where: { id: { in: userIds } },
        data: { isActive: false },
      }),
    ]);

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: AuditAction.UPDATE,
          module: 'Graduates',
          newValue: `${students.length} öğrenci ${year} yılı mezunu olarak işaretlendi ve portal erişimleri kapatıldı.`,
        },
      });
    }

    res.json({ success: true, count: students.length, graduationYear: year });
  } catch (err) {
    next(err);
  }
}

export async function revertGraduation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      throw new AppError(400, 'Öğrenci ID belirtilmelidir.');
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: studentId },
      select: { id: true, userId: true, firstName: true, lastName: true },
    });

    if (!student) {
      throw new AppError(404, 'Öğrenci bulunamadı.');
    }

    await prisma.$transaction([
      prisma.studentProfile.update({
        where: { id: studentId },
        data: {
          studentStatus: 'ACTIVE',
          enrollmentStatus: 'ENROLLED',
          graduationYear: null,
          graduatedAt: null,
        },
      }),
      prisma.user.update({
        where: { id: student.userId },
        data: { isActive: true },
      }),
    ]);

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: AuditAction.UPDATE,
          module: 'Graduates',
          newValue: `${student.firstName} ${student.lastName} mezunluktan aktif bursiyerliğe geri alındı ve portal erişimi açıldı.`,
        },
      });
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

export async function exportGraduatesReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { year, categoryId } = req.query;
    const where: any = { studentStatus: 'GRADUATED' };
    if (year && year !== 'ALL') where.graduationYear = parseInt(year as string);
    if (categoryId && categoryId !== 'ALL') where.scholarshipCategoryId = categoryId as string;

    const graduates = await prisma.studentProfile.findMany({
      where,
      include: {
        user: { select: { tcKimlikNo: true, email: true } },
        scholarshipCategory: true,
        mentor: true,
      },
      orderBy: [{ graduationYear: 'desc' }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Faydasıçok Eğitim Vakfı';
    workbook.created = new Date();

    const statusTranslations: Record<string, string> = {
      ACTIVE: 'Aktif',
      PASSIVE: 'Pasif',
      GRADUATED: 'Mezun',
      INCOMPLETE: 'İlk Kayıt / Eksik',
    };

    function applyProfessionalStyle(sheet: ExcelJS.Worksheet, headerColorArgb = 'FF1E3A8A') {
      sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
      sheet.properties.defaultRowHeight = 26;
      const headerRow = sheet.getRow(1);
      headerRow.height = 32;
      headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColorArgb } };
        cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF94A3B8' } },
          left: { style: 'thin', color: { argb: 'FF94A3B8' } },
          bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
          right: { style: 'thin', color: { argb: 'FF94A3B8' } },
        };
      });
      sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        row.height = 24;
        const isEven = rowNumber % 2 === 0;
        row.eachCell((cell) => {
          cell.font = { name: 'Calibri', size: 10 };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
          if (isEven) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
          }
        });
      });
    }

    const sheet = workbook.addWorksheet('Mezunlar Listesi');
    sheet.columns = [
      { header: 'Sicil No', key: 'sicilNo', width: 40 },
      { header: 'Program', key: 'program', width: 25 },
      { header: 'Adı', key: 'firstName', width: 20 },
      { header: 'Soyadı', key: 'lastName', width: 20 },
      { header: 'Cinsiyet', key: 'gender', width: 15 },
      { header: 'TCKN', key: 'tc', width: 20 },
      { header: 'IBAN', key: 'iban', width: 35 },
      { header: 'Email', key: 'email', width: 35 },
      { header: 'Telefon', key: 'phone', width: 20 },
      { header: 'Otomatik İnci Adı', key: 'inciName', width: 25 },
      { header: 'Doğum Tarihi', key: 'birthDate', width: 20 },
      { header: 'Aile İkamet Şehri', key: 'familyCity', width: 25 },
      { header: 'Anne/Baba Sağ', key: 'parentsStatus', width: 25 },
      { header: 'Referans Bilgisi / Hasçelik Çalışanı vb.', key: 'referenceInfo', width: 40 },
      { header: 'Aile İletişim Telefonu', key: 'familyPhone', width: 25 },
      { header: 'Okulu', key: 'universityName', width: 35 },
      { header: 'Bölümü', key: 'department', width: 30 },
      { header: 'Sınıfı', key: 'grade', width: 15 },
      { header: 'Okul Başlangıç Yılı', key: 'universityStartYear', width: 20 },
      { header: 'Üniversite Yerleştirme Sırası', key: 'universityPlacementRank', width: 25 },
      { header: 'Üni.Haz.Okudu mu?', key: 'hadPrepClass', width: 20 },
      { header: 'Okul Şehri', key: 'universityCity', width: 20 },
      { header: 'Konaklama', key: 'accommodationType', width: 25 },
      { header: 'Bursiyer Sözleşmesini İmzaladı mı?', key: 'isContractSigned', width: 25 },
      { header: 'Son Durumu', key: 'studentStatus', width: 20 },
      { header: 'Askı Baslangıcı', key: 'suspensionStartDate', width: 20 },
      { header: 'Askı Sonu', key: 'suspensionEndDate', width: 20 },
      { header: 'Askı notu', key: 'suspensionNote', width: 30 },
      { header: 'Erasmus\'a Gidiş Tarihi', key: 'erasmusStartDate', width: 20 },
      { header: 'Erasmus\'dan Dönüş Tarihi', key: 'erasmusEndDate', width: 20 },
      { header: 'Erasmus Ülkesi/ Okulu', key: 'erasmusSchoolCountry', width: 25 },
      { header: 'Mezuniyet Yılı', key: 'graduationYear', width: 20 },
      { header: 'Mezun Şehri', key: 'graduateCity', width: 20 },
      { header: 'Mezun Şirketi', key: 'graduateCompany', width: 25 },
      { header: 'Linkedin Bağlantı', key: 'linkedinUrl', width: 35 },
      { header: 'MZN NOT', key: 'graduateNote', width: 30 },
      { header: 'İlgi Alanları', key: 'interests', width: 35 },
      { header: 'Nasıl Bir Mentör İster', key: 'mentorExpectation', width: 35 },
      { header: 'Mentör Adı Soyadı', key: 'mentorName', width: 28 },
      { header: 'Mezuniyete Aktarılma Tarihi', key: 'graduatedAt', width: 26 },
    ];

    graduates.forEach((s) => {
      const mentorFullName = s.mentor ? `${s.mentor.firstName} ${s.mentor.lastName}`.trim() : '—';
      sheet.addRow({
        userType: s.userType || '',
        sicilNo: s.sicilNo || '',
        program: s.scholarshipCategory?.name || s.program || 'Tanımsız / Genel',
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        gender: s.gender || '',
        tc: s.user?.tcKimlikNo || '',
        iban: s.iban || '',
        email: s.user?.email || s.email || '',
        phone: s.phone || '',
        inciName: s.inciName || '',
        birthDate: s.birthDate ? format(new Date(s.birthDate), 'dd.MM.yyyy') : '',
        familyCity: s.familyCity || '',
        parentsStatus: s.parentsStatus || '',
        referenceInfo: s.referenceInfo || '',
        familyPhone: s.familyPhone || '',
        universityName: s.universityName || '',
        department: s.department || '',
        grade: s.grade || '',
        universityStartYear: s.universityStartYear || '',
        universityPlacementRank: s.universityPlacementRank || '',
        hadPrepClass: s.hadPrepClass || '',
        universityCity: s.universityCity || '',
        accommodationType: s.accommodationType || '',
        isContractSigned: s.isContractSigned ? 'Evet' : 'Hayır',
        studentStatus: statusTranslations[s.studentStatus] || s.studentStatus || '—',
        suspensionStartDate: s.suspensionStartDate ? format(new Date(s.suspensionStartDate), 'dd.MM.yyyy') : '',
        suspensionEndDate: s.suspensionEndDate ? format(new Date(s.suspensionEndDate), 'dd.MM.yyyy') : '',
        suspensionNote: s.suspensionNote || '',
        erasmusStartDate: s.erasmusStartDate ? format(new Date(s.erasmusStartDate), 'dd.MM.yyyy') : '',
        erasmusEndDate: s.erasmusEndDate ? format(new Date(s.erasmusEndDate), 'dd.MM.yyyy') : '',
        erasmusSchoolCountry: s.erasmusSchoolCountry || '',
        graduationYear: s.graduationYear ? `${s.graduationYear} Mezunu` : 'Belirtilmedi',
        graduateCity: s.graduateCity || '',
        graduateCompany: s.graduateCompany || '',
        linkedinUrl: s.linkedinUrl || '',
        graduateNote: s.graduateNote || '',
        interests: s.interests || '',
        mentorExpectation: s.mentorExpectation || '',
        mentorName: mentorFullName,
        graduatedAt: s.graduatedAt ? format(new Date(s.graduatedAt), 'dd.MM.yyyy HH:mm') : (s.updatedAt ? format(new Date(s.updatedAt), 'dd.MM.yyyy') : '—'),
      });
    });

    applyProfessionalStyle(sheet, 'FF1E3A8A'); // Indigo Header for graduates

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const safeYear = year && year !== 'ALL' ? `_${year}` : '_tum';
    res.setHeader('Content-Disposition', `attachment; filename="faydasicok_mezunlar${safeYear}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// ── Excel Column Mapping ──────────────────────────────────────────────
type ExcelColumnDef = {
  header: string;
  aliases: string[];
  dbField: string;
  section: string;
  type: string;
  sample1?: any;
  sample2?: any;
};

const EXCEL_COLUMN_MAP: ExcelColumnDef[] = [
  // KİŞİSEL BİLGİLER
  { header: 'Sicil No', aliases: ['sicil', 'sicilno'], dbField: 'sicilNo', section: 'profile', type: 'string' },
  { header: 'Program', aliases: ['programi', 'bursprogrami', 'programadi', 'kategori'], dbField: 'program', section: 'profile', type: 'string' },

  // AİLE BİLGİLERİ
  { header: 'Adı', aliases: ['adi', 'isim', 'ogrenciadi'], dbField: 'firstName', section: 'profile', type: 'string' },
  { header: 'Soyadı', aliases: ['soyadi', 'ogrencisoyadi'], dbField: 'lastName', section: 'profile', type: 'string' },
  { header: 'Cinsiyet', aliases: ['gender'], dbField: 'gender', section: 'profile', type: 'string' },
  { header: 'TCKN', aliases: ['tc', 'tckn', 'tckimlik', 'tckimlikno', 'tcno'], dbField: 'tcKimlikNo', section: 'user', type: 'string' },
  { header: 'IBAN', aliases: ['ibanno', 'bankaiban'], dbField: 'iban', section: 'profile', type: 'string' },
  { header: 'Email', aliases: ['email', 'mail', 'eposta'], dbField: 'email', section: 'profile', type: 'string' },
  { header: 'Telefon', aliases: ['tel', 'cep', 'ceptel'], dbField: 'phone', section: 'profile', type: 'string' },
  { header: 'Otomatik İnci Adı', aliases: ['inciladi', 'inciadi', 'otomatikinci'], dbField: 'inciName', section: 'profile', type: 'string' },
  { header: 'Doğum Tarihi', aliases: ['dogum', 'dtarih'], dbField: 'birthDate', section: 'profile', type: 'date' },
  { header: 'Aile İkamet Şehri', aliases: ['aileikamet', 'ailesehir'], dbField: 'familyCity', section: 'profile', type: 'string' },
  { header: 'Anne/Baba Sağ', aliases: ['annebabasag', 'sağ', 'saglik', 'parentsstatus'], dbField: 'parentsStatus', section: 'profile', type: 'string' },
  { header: 'Referans Bilgisi / Hasçelik Çalışanı vb.', aliases: ['referansbilgisi', 'referans'], dbField: 'referenceInfo', section: 'profile', type: 'string' },
  { header: 'Aile İletişim Telefonu', aliases: ['ailetel', 'ailetelefonu'], dbField: 'familyPhone', section: 'profile', type: 'string' },

  // OKUL BİLGİLERİ
  { header: 'Okulu', aliases: ['okul', 'uni', 'üniversite', 'universityname'], dbField: 'universityName', section: 'profile', type: 'string' },
  { header: 'Bölümü', aliases: ['bolumu', 'department', 'fakulte', 'fakültesi'], dbField: 'department', section: 'profile', type: 'string' },
  { header: 'Sınıfı', aliases: ['sinifi', 'grade'], dbField: 'grade', section: 'profile', type: 'int' },
  { header: 'Okul Başlangıç Yılı', aliases: ['okulbaslangic', 'unibaslangic'], dbField: 'universityStartYear', section: 'profile', type: 'int' },
  { header: 'Üniversite Yerleştirme Sırası', aliases: ['uniyerlestirme', 'yerlestirmesirasi'], dbField: 'universityPlacementRank', section: 'profile', type: 'int' },
  { header: 'Üni.Haz.Okudu mu?', aliases: ['hazirlikokudumu', 'hazirlik'], dbField: 'hadPrepClass', section: 'profile', type: 'string' },
  { header: 'Okul Şehri', aliases: ['okulsehri', 'unisehri'], dbField: 'universityCity', section: 'profile', type: 'string' },
  { header: 'Konaklama', aliases: ['konaklamaturu', 'konaklama'], dbField: 'accommodationType', section: 'profile', type: 'string' },
  { header: 'Bursiyer Sözleşmesini İmzaladı mı?', aliases: ['sozlesme', 'sozlesmeimzaladimi'], dbField: 'isContractSigned', section: 'profile', type: 'boolean' },
  { header: 'Son Durumu', aliases: ['sondurumu', 'durumu', 'ogrencidurumu', 'bursiyerdurumu', 'statü', 'statu'], dbField: 'studentStatus', section: 'profile', type: 'string' },

  // ASKI BİLGİSİ ALANI
  { header: 'Askı Baslangıcı', aliases: ['askibaslangic', 'askibasi'], dbField: 'suspensionStartDate', section: 'profile', type: 'date' },
  { header: 'Askı Sonu', aliases: ['askisonu'], dbField: 'suspensionEndDate', section: 'profile', type: 'date' },
  { header: 'Askı notu', aliases: ['askinotu', 'askiaciklama'], dbField: 'suspensionNote', section: 'profile', type: 'string' },

  // ERASMUS BİLGİLERİ
  { header: 'Erasmus\'a Gidiş Tarihi', aliases: ['erasmusgidis'], dbField: 'erasmusStartDate', section: 'profile', type: 'date' },
  { header: 'Erasmus\'dan Dönüş Tarihi', aliases: ['erasmusdonus'], dbField: 'erasmusEndDate', section: 'profile', type: 'date' },
  { header: 'Erasmus Ülkesi/ Okulu', aliases: ['erasmusulke', 'erasmusokul'], dbField: 'erasmusSchoolCountry', section: 'profile', type: 'string' },

  // MEZUN İLETİŞİMİ
  { header: 'Mezun Şehri', aliases: ['mezunsehri'], dbField: 'graduateCity', section: 'profile', type: 'string' },
  { header: 'Mezun Şirketi', aliases: ['mezunsirket'], dbField: 'graduateCompany', section: 'profile', type: 'string' },
  { header: 'Linkedin Bağlantı', aliases: ['linkedin', 'linkedinurl'], dbField: 'linkedinUrl', section: 'profile', type: 'string' },
  { header: 'MZN NOT', aliases: ['mznnot', 'mezunnot'], dbField: 'graduateNote', section: 'profile', type: 'string' },

  // DİĞER
  { header: 'İlgi Alanları', aliases: ['ilgi'], dbField: 'interests', section: 'profile', type: 'string' },
  { header: 'Nasıl Bir Mentör İster', aliases: ['mentorister', 'mentorexpectation'], dbField: 'mentorExpectation', section: 'profile', type: 'string' }
];

function normalizeHeader(str: string): string {
  return str
    .replace(/i/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'I')
    .replace(/I/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function parseExcelCellValue(value: any, type: string): any {
  if (value === undefined || value === null || value === '') return null;
  const str = String(value).trim();
  if (str === '') return null;

  switch (type) {
    case 'int': {
      const n = parseInt(str.replace(/\\D/g, ''), 10);
      return isNaN(n) ? null : n;
    }
    case 'float': {
      const f = parseFloat(str.replace(',', '.').replace(/[^\\d.]/g, ''));
      return isNaN(f) ? null : f;
    }
    case 'date': {
      if (value instanceof Date) return value;
      if (/^\\d{1,2}[./-]\\d{1,2}[./-]\\d{4}$/.test(str)) {
        const parts = str.split(/[./-]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        const d = new Date(year, month, day);
        return isNaN(d.getTime()) ? null : d;
      }
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    case 'boolean': {
      const lower = str.toLowerCase();
      if (['evet', 'yes', 'true', '1', 'e'].includes(lower)) return true;
      if (['hayır', 'hayir', 'no', 'false', '0', 'h'].includes(lower)) return false;
      return false;
    }
    default:
      return str;
  }
}


export async function importStudentsFromExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw new AppError(400, 'Excel dosyası yüklenmedi.');

    const scholarshipCategoryId = String(req.body.scholarshipCategoryId || '').trim() || null;
    const isNewStudent = req.body.isNewStudent !== 'false' && req.body.isNewStudent !== false;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet || worksheet.rowCount < 2) throw new AppError(400, 'Excel dosyası boş veya geçersiz.');

    const headerRow = worksheet.getRow(1);
    const colToMapping = new Map<number, ExcelColumnDef>();
    let tcColNum: number | null = null;
    let firstNameColNum: number | null = null;
    let lastNameColNum: number | null = null;

    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const rawHeader = String(cell.value || '').trim();
      const norm = normalizeHeader(rawHeader);
      if (!norm) return;

      for (const colDef of EXCEL_COLUMN_MAP) {
        const matchesCanonical = normalizeHeader(colDef.header) === norm;
        const matchesAlias = colDef.aliases.some(a => norm.includes(normalizeHeader(a)) || normalizeHeader(a).includes(norm));
        if (matchesCanonical || matchesAlias) {
          colToMapping.set(colNumber, colDef);
          if (colDef.dbField === 'tcKimlikNo') tcColNum = colNumber;
          if (colDef.dbField === 'firstName') firstNameColNum = colNumber;
          if (colDef.dbField === 'lastName') lastNameColNum = colNumber;
          break;
        }
      }
    });

    if (!tcColNum) throw new AppError(400, 'Excel dosyasında "TC Kimlik No" sütunu bulunamadı.');

    const categoryCache = new Map<string, string>();
    const allCategories = await prisma.scholarshipCategory.findMany();
    for (const cat of allCategories) {
      categoryCache.set(normalizeHeader(cat.name), cat.id);
    }

    const results: Array<any> = [];

    for (let rowIdx = 2; rowIdx <= worksheet.rowCount; rowIdx++) {
      const row = worksheet.getRow(rowIdx);
      const tcRaw = row.getCell(tcColNum).value;
      const tc = String(tcRaw || '').trim().replace(/\\D/g, '');
      if (!tc) continue;

      const firstName = firstNameColNum ? String(row.getCell(firstNameColNum).value || '').trim() : '';
      const lastName = lastNameColNum ? String(row.getCell(lastNameColNum).value || '').trim() : '';

      if (tc.length !== 11) {
        results.push({ row: rowIdx, tcKimlikNo: tc, firstName, lastName, password: '', status: 'error', error: 'Geçersiz TC formatı (11 hane olmalı)' });
        continue;
      }

      const existing = await prisma.user.findUnique({ where: { tcKimlikNo: tc } });
      if (existing) {
        results.push({ row: rowIdx, tcKimlikNo: tc, firstName, lastName, password: '', status: 'existing' });
        continue;
      }

      let rowCategoryId = scholarshipCategoryId;
      const profileData: any = {
        firstName: firstName || '',
        lastName: lastName || '',
        studentStatus: 'ACTIVE',
        isInitialDocsExempt: !isNewStudent,
      };

      let emailValue: string | null = null;

      for (const [colNum, colDef] of colToMapping.entries()) {
        if (colDef.section !== 'profile') continue;
        const cellValue = row.getCell(colNum).value;
        const parsed = parseExcelCellValue(cellValue, colDef.type);
        if (parsed !== null && parsed !== undefined) {
          if (colDef.dbField === 'program' && typeof parsed === 'string' && parsed.trim() !== '') {
            const cleanProgram = parsed.trim();
            profileData.program = cleanProgram;
            const normProgram = normalizeHeader(cleanProgram);
            if (categoryCache.has(normProgram)) {
              rowCategoryId = categoryCache.get(normProgram)!;
            } else {
              try {
                const newCat = await prisma.scholarshipCategory.create({ data: { name: cleanProgram, isActive: true } });
                categoryCache.set(normProgram, newCat.id);
                rowCategoryId = newCat.id;
              } catch {
                const existingCat = await prisma.scholarshipCategory.findFirst({ where: { name: cleanProgram } });
                if (existingCat) {
                  categoryCache.set(normProgram, existingCat.id);
                  rowCategoryId = existingCat.id;
                }
              }
            }
          } else if (colDef.dbField === 'studentStatus' && typeof parsed === 'string') {
            const normStatus = normalizeHeader(parsed);
            if (['aktif', 'active'].includes(normStatus)) profileData.studentStatus = 'ACTIVE';
            else if (['mezun', 'graduated'].includes(normStatus)) profileData.studentStatus = 'GRADUATED';
            else if (['pasif', 'passive'].includes(normStatus)) profileData.studentStatus = 'PASSIVE';
            else if (['tamamlanmadi', 'incomplete'].includes(normStatus)) profileData.studentStatus = 'INCOMPLETE';
            else profileData.studentStatus = parsed;
          } else {
            profileData[colDef.dbField] = parsed;
          }

          if (colDef.dbField === 'email') emailValue = String(parsed).trim();
        }
      }

      profileData.scholarshipCategoryId = rowCategoryId || scholarshipCategoryId || null;

      const password = Math.floor(100000 + Math.random() * 900000).toString();
      const passwordHash = await bcrypt.hash(password, 10);

      try {
        if (emailValue) {
          const existingEmail = await prisma.user.findFirst({ where: { email: emailValue } });
          if (existingEmail) {
            emailValue = null;
            profileData.email = null;
          }
        }

        const user = await prisma.user.create({
          data: {
            tcKimlikNo: tc,
            passwordHash,
            role: Role.STUDENT,
            isActive: true,
            forcePasswordChange: true,
            email: emailValue,
            studentProfile: { create: profileData },
          },
        });
        results.push({ row: rowIdx, tcKimlikNo: tc, firstName, lastName, password, status: 'created' });
      } catch (e: any) {
        results.push({ row: rowIdx, tcKimlikNo: tc, firstName, lastName, password: '', status: 'error', error: e.message || 'Veritabanına eklenemedi' });
      }
    }

    res.json({
      summary: {
        total: results.length,
        created: results.filter(r => r.status === 'created').length,
        existing: results.filter(r => r.status === 'existing').length,
        errors: results.filter(r => r.status === 'error').length,
      },
      data: results,
    });
  } catch (err) {
    next(err);
  }
}

// ── Excel Template ───────────────────────────────────────────────────
export async function getExcelTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Bursiyer Şablonu');
    const headers = EXCEL_COLUMN_MAP.map(c => c.header);
    ws.addRow(headers);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bursiyer-excel-sablonu.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
}

// ── Delete Student ───────────────────────────────────────────────────
export async function deleteStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const student = await prisma.studentProfile.findUnique({
      where: { id },
      include: { documents: true }
    });
    if (!student) throw new AppError(404, 'Öğrenci bulunamadı.');

    // 1. Delete physical files from disk
    if (student.documents && student.documents.length > 0) {
      for (const doc of student.documents) {
        if (doc.filePath) {
          await storageService.delete(doc.filePath).catch((err) => {
            console.error(`Belge silinemedi (ID: ${doc.id}):`, err);
          });
        }
      }
    }

    // 2. Transaction to delete database records safely
    await prisma.$transaction([
      prisma.studentProfile.delete({ where: { id } }),
      prisma.user.delete({ where: { id: student.userId } })
    ]);

    res.json({ success: true, message: 'Öğrenci başarıyla silindi.' });
  } catch (err) {
    next(err);
  }
}

// ── Delete Document ───────────────────────────────────────────────────
export async function deleteDocument(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const document = await prisma.document.findUnique({ where: { id } });

    if (!document) {
      throw new AppError(404, 'Belge bulunamadı.');
    }

    // 1. Delete physical file if exists
    if (document.filePath) {
      try {
        await storageService.delete(document.filePath);
      } catch (err) {
        console.error(`Belge dosyası silinemedi (ID: ${document.id}):`, err);
      }
    }

    // 2. Delete ApprovableChange relation if it exists
    await prisma.approvableChange.deleteMany({
      where: { documentId: id }
    });

    // 3. Delete Document record
    await prisma.document.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.DELETE,
        module: 'Document',
        entityId: id,
        entityType: 'Document',
        newValue: `Belge silindi: ${document.originalFileName}`,
      },
    });

    res.json({ success: true, message: 'Belge başarıyla silindi.' });
  } catch (err) {
    next(err);
  }
}
