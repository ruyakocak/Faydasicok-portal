import { Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditAction, Role, StudentStatus } from '../types/enums';
import { storageService } from '../lib/storage';

const BCRYPT_ROUNDS = 12;

// ── Dashboard ────────────────────────────────────────────────────────
export async function getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const [totalStudents, pendingChanges, activePeriods, recentLogs, thisMonthDocs] = await Promise.all([
      prisma.studentProfile.count(),
      prisma.approvableChange.count({ where: { status: 'PENDING' } }),
      prisma.documentPeriod.count({ where: { isOpen: true } }),
      prisma.auditLog.findMany({
        where: { action: { in: ['APPROVE', 'REJECT', 'UPLOAD'] } },
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { tcKimlikNo: true, email: true, username: true, role: true } },
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
    if (studentStatus) where.studentStatus = studentStatus;
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
          _count: { select: { approvableChanges: { where: { status: 'PENDING' } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.studentProfile.count({ where }),
    ]);

    res.json({
      data: profiles,
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

// ── Create Single Student ──────────────────────────────────────────────
export async function createStudent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { tcKimlikNo, firstName, lastName, scholarshipCategoryId } = req.body;
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
    ['fatherAlive', 'motherAlive'].forEach(key => {
      if (profileData[key] !== undefined) {
        profileData[key] = profileData[key] === true || profileData[key] === 'true' || profileData[key] === 'Evet';
      }
    });

    // Parse numeric fields
    ['grade', 'fatherAge', 'fatherIncome', 'motherAge', 'motherIncome', 'familyMemberCount', 'siblingCount', 'siblingsInEducation', 'highSchoolGradYear'].forEach(key => {
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
    
    const updated = await prisma.studentProfile.update({
      where: { id },
      data: profileData
    });

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
    const { type, label, semester, academicYear, grade, isOpen, startDate, endDate, categoryIds } = req.body;
    if (!type || !label) throw new AppError(400, 'Tür ve etiket zorunludur.');

    // categoryIds: string[] | null → store as JSON string
    const categoryIdsStr = Array.isArray(categoryIds) && categoryIds.length > 0
      ? JSON.stringify(categoryIds)
      : null;

    const period = await prisma.documentPeriod.create({
      data: { type, label, semester, academicYear, grade, isOpen: isOpen ?? false, startDate, endDate, categoryIds: categoryIdsStr },
    });
    res.status(201).json(period);
  } catch (err) {
    next(err);
  }
}

// ── Update Period ─────────────────────────────────────────────────────
export async function updatePeriod(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { isOpen, label, startDate, endDate, grade, semester, academicYear, categoryIds } = req.body;

    let closedCount = 0;
    // (Auto-close logic removed per user request to allow multiple open periods simultaneously)

    // Build update data, including categoryIds if provided
    const updateData: any = { isOpen, label, startDate, endDate, grade, semester, academicYear };
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
        newValue: JSON.stringify({ isOpen, label }),
      },
    });

    res.json({ ...period, autoClosedOtherSemesters: closedCount > 0 });
  } catch (err) {
    next(err);
  }
}

export async function deleteSemester(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { label } = req.body;
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
      throw new AppError(400, 'Bu döneme (tüm alt evraklarına) yüklenmiş belgeler var. Önce öğrencilerin yüklediği belgeleri silmelisiniz veya dönemi pasife almalısınız.');
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
        newValue: JSON.stringify({ deleted: true, count: periods.length }),
      },
    });

    res.json({ message: 'Dönem tüm evraklarıyla birlikte başarıyla silindi.' });
  } catch (err) {
    next(err);
  }
}

export async function updateSemester(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { oldLabel, label, semester, academicYear, startDate, endDate, grade, categoryIds } = req.body;
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
          try { nativeCats = JSON.parse(dt.categoryIds); } catch {}
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

    res.json(updatedStudent);
  } catch (err) {
    next(err);
  }
}

// ── Export Students Report ───────────────────────────────────────────
export async function exportStudentsReport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const students = await prisma.studentProfile.findMany({
      include: {
        user: { select: { tcKimlikNo: true, email: true, isActive: true } },
        documents: true,
      },
      orderBy: { firstName: 'asc' },
    });

    const activePeriods = await prisma.documentPeriod.findMany({ where: { isOpen: true } });
    
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Faydasıçok Vakfı';
    workbook.created = new Date();

    // 1. Tüm Bursiyerler
    const allStudentsSheet = workbook.addWorksheet('Tüm Bursiyerler');
    allStudentsSheet.columns = [
      { header: 'TC Kimlik No', key: 'tc', width: 15 },
      { header: 'Ad', key: 'firstName', width: 20 },
      { header: 'Soyad', key: 'lastName', width: 20 },
      { header: 'Üniversite', key: 'uni', width: 30 },
      { header: 'Bölüm', key: 'dept', width: 30 },
      { header: 'Sınıf', key: 'grade', width: 10 },
      { header: 'E-posta', key: 'email', width: 30 },
      { header: 'Telefon', key: 'phone', width: 15 },
      { header: 'Burs Durumu', key: 'status', width: 15 },
    ];
    
    allStudentsSheet.getRow(1).font = { bold: true };
    
    students.forEach(s => {
      allStudentsSheet.addRow({
        tc: s.user?.tcKimlikNo || '',
        firstName: s.firstName,
        lastName: s.lastName,
        uni: s.universityName || '',
        dept: s.department || '',
        grade: s.grade || '',
        email: s.user?.email || s.email || '',
        phone: s.phone || '',
        status: s.studentStatus,
      });
    });

    // 2. Eksik Belgeli Öğrenciler
    const missingDocsSheet = workbook.addWorksheet('Eksik Belgeli Öğrenciler');
    missingDocsSheet.columns = [
      { header: 'TC Kimlik No', key: 'tc', width: 15 },
      { header: 'Ad', key: 'firstName', width: 20 },
      { header: 'Soyad', key: 'lastName', width: 20 },
      { header: 'Eksik Belge', key: 'missingDoc', width: 30 },
      { header: 'E-posta', key: 'email', width: 30 },
      { header: 'Telefon', key: 'phone', width: 15 },
    ];
    missingDocsSheet.getRow(1).font = { bold: true };

    if (activePeriods.length > 0) {
      students.forEach(s => {
        activePeriods.forEach(period => {
          const hasDoc = s.documents.some(d => d.periodId === period.id && (d.status === 'APPROVED' || d.status === 'PENDING'));
          if (!hasDoc && s.studentStatus !== 'GRADUATED' && s.studentStatus !== 'PASSIVE') {
            missingDocsSheet.addRow({
              tc: s.user?.tcKimlikNo || '',
              firstName: s.firstName,
              lastName: s.lastName,
              missingDoc: period.label,
              email: s.user?.email || s.email || '',
              phone: s.phone || '',
            });
          }
        });
      });
    } else {
      missingDocsSheet.addRow({ tc: 'Aktif belge dönemi bulunmuyor.' });
    }

    // 3. İstatistikler
    const statsSheet = workbook.addWorksheet('İstatistikler');
    statsSheet.columns = [
      { header: 'Kategori', key: 'category', width: 25 },
      { header: 'Değer', key: 'value', width: 40 },
      { header: 'Kişi Sayısı', key: 'count', width: 15 },
    ];
    statsSheet.getRow(1).font = { bold: true };

    const uniStats: Record<string, number> = {};
    const deptStats: Record<string, number> = {};
    const statusStats: Record<string, number> = {};

    students.forEach(s => {
      const uni = s.universityName || 'Belirtilmemiş';
      const dept = s.department || 'Belirtilmemiş';
      const status = s.studentStatus || 'Bilinmiyor';

      uniStats[uni] = (uniStats[uni] || 0) + 1;
      deptStats[dept] = (deptStats[dept] || 0) + 1;
      statusStats[status] = (statusStats[status] || 0) + 1;
    });

    Object.entries(statusStats).sort((a,b) => b[1]-a[1]).forEach(([val, count]) => {
      statsSheet.addRow({ category: 'Bursiyer Durumu', value: val, count });
    });
    statsSheet.addRow({}); // boş satır
    Object.entries(uniStats).sort((a,b) => b[1]-a[1]).forEach(([val, count]) => {
      statsSheet.addRow({ category: 'Üniversite', value: val, count });
    });
    statsSheet.addRow({}); // boş satır
    Object.entries(deptStats).sort((a,b) => b[1]-a[1]).forEach(([val, count]) => {
      statsSheet.addRow({ category: 'Bölüm', value: val, count });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="bursiyer-raporu.xlsx"');
    
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
      orderBy: { createdAt: 'desc' },
    });
    res.json(types);
  } catch (err) {
    next(err);
  }
}

export async function createDocumentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, name, description, customFields, isActive, categoryIds } = req.body;
    if (!code || !name) throw new AppError(400, 'Kod ve Ad zorunludur.');

    const existing = await prisma.documentTypeConfig.findUnique({ where: { code } });
    if (existing) throw new AppError(400, 'Bu koda sahip bir belge türü zaten var.');

    const categoryIdsStr = Array.isArray(categoryIds) && categoryIds.length > 0
      ? JSON.stringify(categoryIds)
      : null;

    const type = await prisma.documentTypeConfig.create({
      data: { code, name, description, customFields, isActive: isActive ?? true, categoryIds: categoryIdsStr },
    });
    res.status(201).json(type);
  } catch (err) {
    next(err);
  }
}

export async function updateDocumentType(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { code, name, description, customFields, isActive, categoryIds } = req.body;

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
