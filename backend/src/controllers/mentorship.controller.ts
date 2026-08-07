import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { Role } from '../types/enums';

// ── GET /api/mentorship/profile ──────────────────────────────────────
export async function getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.userId;
    const role = req.user!.role;

    if (role === Role.STUDENT) {
      // Find the student's assigned mentor
      const studentProfile = await prisma.studentProfile.findUnique({
        where: { userId },
        include: {
          mentor: {
            include: {
              user: { select: { email: true } }
            }
          }
        },
      });

      if (!studentProfile) {
        throw new AppError(404, 'Öğrenci profili bulunamadı.');
      }

      res.json({ mentor: studentProfile.mentor });
    } else if (role === Role.MENTOR) {
      // Find the mentor's assigned students
      const mentorProfile = await prisma.mentorProfile.findUnique({
        where: { userId },
        include: {
          students: {
            include: {
              user: { select: { email: true } }
            }
          }
        },
      });

      if (!mentorProfile) {
        throw new AppError(404, 'Mentör profili bulunamadı.');
      }

      res.json({ students: mentorProfile.students, profile: mentorProfile });
    } else {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }
  } catch (err) {
    next(err);
  }
}

// ── GET /api/mentorship/notes ────────────────────────────────────────
export async function getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { studentId } = req.query; // Admin or Mentor can pass studentId

    let studentProfileId = '';
    let mentorProfileId = '';

    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.userId } });
      if (!student) throw new AppError(404, 'Öğrenci bulunamadı.');
      studentProfileId = student.id;
      if (!student.mentorId) throw new AppError(404, 'Henüz atanmış bir mentörünüz yok.');
      mentorProfileId = student.mentorId;
    } else if (req.user!.role === Role.MENTOR) {
      if (!studentId) throw new AppError(400, 'Öğrenci kimliği gerekli.');
      const mentor = await prisma.mentorProfile.findUnique({ where: { userId: req.user!.userId } });
      if (!mentor) throw new AppError(404, 'Mentör bulunamadı.');
      mentorProfileId = mentor.id;
      studentProfileId = studentId as string;
    } else if (req.user!.role === Role.ADMIN) {
       if (!studentId) throw new AppError(400, 'Öğrenci kimliği gerekli.');
       const student = await prisma.studentProfile.findUnique({ where: { id: studentId as string }});
       if(!student || !student.mentorId) throw new AppError(404, 'Öğrencinin mentörü yok.');
       studentProfileId = student.id;
       mentorProfileId = student.mentorId;
    } else {
      throw new AppError(403, 'Yetkisiz erişim.');
    }

    const notes = await prisma.note.findMany({
      where: {
        studentId: studentProfileId,
        mentorId: mentorProfileId,
      },
      include: {
        createdBy: { select: { role: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json(notes);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/mentorship/notes ───────────────────────────────────────
export async function createNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { noteText, studentId } = req.body;
    if (!noteText) throw new AppError(400, 'Not metni boş olamaz.');

    let targetStudentId = '';
    let targetMentorId = '';

    if (req.user!.role === Role.STUDENT) {
      const student = await prisma.studentProfile.findUnique({ where: { userId: req.user!.userId } });
      if (!student || !student.mentorId) throw new AppError(400, 'Geçerli bir mentör eşleşmesi yok.');
      targetStudentId = student.id;
      targetMentorId = student.mentorId;
    } else if (req.user!.role === Role.MENTOR) {
      if (!studentId) throw new AppError(400, 'Öğrenci kimliği gerekli.');
      const mentor = await prisma.mentorProfile.findUnique({ where: { userId: req.user!.userId } });
      if (!mentor) throw new AppError(404, 'Mentör bulunamadı.');
      targetMentorId = mentor.id;
      targetStudentId = studentId;
    } else {
      throw new AppError(403, 'Yetkisiz erişim.');
    }

    const note = await prisma.note.create({
      data: {
        noteText,
        studentId: targetStudentId,
        mentorId: targetMentorId,
        createdById: req.user!.userId,
      },
      include: {
        createdBy: { select: { role: true, username: true } },
      },
    });

    res.status(201).json(note);
  } catch (err) {
    next(err);
  }
}
