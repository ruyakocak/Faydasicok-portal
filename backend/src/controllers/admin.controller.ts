import { Request, Response, NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { AuditAction, Role, StudentStatus } from '../types/enums';

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

    let closedCount = 0;
    if (isOpen === true) {
      const existing = await prisma.documentPeriod.findUnique({ where: { id } });
      if (existing) {
        // Tüm sistemde aynı anda sadece TEK BİR dönemin (label) aktif olabilmesi için,
        // başka bir döneme ait (farklı label'a sahip) açık olan tüm evrak yüklemelerini kapat.
        const r1 = await prisma.documentPeriod.updateMany({
          where: { label: { not: existing.label }, isOpen: true },
          data: { isOpen: false },
        });
        closedCount += r1.count;
        
        // Aynı dönem içinde aynı evrak türünden birden fazla varsa (olmamalı ama önlem olarak),
        // sadece mevcut olanı açık bırak.
        const r2 = await prisma.documentPeriod.updateMany({
          where: { label: existing.label, type: existing.type, id: { not: id }, isOpen: true },
          data: { isOpen: false },
        });
        closedCount += r2.count;
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

    res.json({ ...period, autoClosedOtherSemesters: closedCount > 0 });
  } catch (err) {
    next(err);
  }
}

// ── List Users (reviewers, admins, mentors) ─────────────────────────
export async function listUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: [Role.REVIEWER, Role.ADMIN, Role.MENTOR] } },
      select: { id: true, email: true, username: true, role: true, isActive: true, createdAt: true, mentorProfile: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
}

// ── Create User (reviewer, admin, mentor) ───────────────────────────
export async function createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, username, password, role, firstName, lastName, title, expertise } = req.body;
    if (!email || !password) throw new AppError(400, 'E-posta ve şifre zorunludur.');
    if (role === Role.STUDENT) throw new AppError(400, 'Bu endpoint ile öğrenci oluşturulamaz.');

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    
    let mentorProfileData = undefined;
    if (role === Role.MENTOR) {
      if (!firstName || !lastName) throw new AppError(400, 'Mentör için ad ve soyad zorunludur.');
      mentorProfileData = {
        create: {
          firstName,
          lastName,
          title,
          expertise,
        }
      };
    }

    const user = await prisma.user.create({
      data: {
        email,
        username: username || email,
        passwordHash,
        role: role || Role.REVIEWER,
        isActive: true,
        mentorProfile: mentorProfileData,
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
        user: { select: { id: true, email: true, isActive: true } },
        _count: { select: { students: true } }
      },
      orderBy: { firstName: 'asc' },
    });
    res.json(mentors);
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
