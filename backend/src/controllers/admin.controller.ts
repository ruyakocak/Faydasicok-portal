import { Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
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
    if (scholarshipGroup) where.scholarshipGroup = scholarshipGroup;

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
    const { tcKimlikNo, firstName, lastName } = req.body;
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
      group = String(req.body.scholarshipGroup || '').trim();
    } else if (req.file) {
      const records = parse(req.file.buffer.toString('utf-8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
      tcsArray = records.map((r: any) => String(r['TC Kimlik No'] || r['tc'] || r['TC'] || '').trim()).filter((t: any) => t.length > 0);
      group = String(req.body.scholarshipGroup || '').trim();
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
                scholarshipGroup: group || null,
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
    const { type, label, semester, academicYear, grade, isOpen, startDate, endDate } = req.body;
    if (!type || !label) throw new AppError(400, 'Tür ve etiket zorunludur.');

    const period = await prisma.documentPeriod.create({
      data: { type, label, semester, academicYear, grade, isOpen: isOpen ?? false, startDate, endDate },
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
    const { isOpen, label, startDate, endDate, grade, semester, academicYear } = req.body;

    if (isOpen === true) {
      const existing = await prisma.documentPeriod.findUnique({ where: { id } });
      if (existing) {
        await prisma.documentPeriod.updateMany({
          where: { type: existing.type, id: { not: id }, isOpen: true },
          data: { isOpen: false },
        });
      }
    }

    const period = await prisma.documentPeriod.update({
      where: { id },
      data: { isOpen, label, startDate, endDate, grade, semester, academicYear },
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

    res.json(period);
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
    const { id } = req.params;
    const user = await prisma.user.findFirst({
      where: { id, role: Role.STUDENT },
    });
    if (!user) throw new AppError(404, 'Öğrenci bulunamadı.');

    const newPassword = Math.floor(100000 + Math.random() * 900000).toString();
    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: AuditAction.UPDATE,
        module: 'Student',
        entityId: id,
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
        _count: { select: { students: true } }
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
