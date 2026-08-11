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
          mentor: true
        },
      });

      if (!studentProfile) {
        throw new AppError(404, 'Öğrenci profili bulunamadı.');
      }

      res.json({ mentor: studentProfile.mentor });
    } else {
      res.json({ mentor: null });
    }
  } catch (err) {
    next(err);
  }
}

// ── GET /api/mentorship/notes (Dummy) ────────────────────────────────
export async function getNotes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json([]);
  } catch (err) {
    next(err);
  }
}

// ── POST /api/mentorship/notes (Dummy) ───────────────────────────────
export async function createNote(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.status(201).json({ id: 'dummy', noteText: '' });
  } catch (err) {
    next(err);
  }
}
