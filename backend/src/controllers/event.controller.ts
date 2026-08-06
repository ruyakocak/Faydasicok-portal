import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { Role } from '../types/enums';

// ── Create Event (Admin Only) ────────────────────────────────────────
export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const { title, description, date, meetingUrl } = req.body;
    if (!title || !date) {
      throw new AppError(400, 'Başlık ve tarih zorunludur.');
    }

    let imagePath: string | undefined;
    if (req.file) {
      const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);
      imagePath = stored.filePath;
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        meetingUrl: meetingUrl || null,
        imagePath: imagePath || null,
      },
    });

    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
}

// ── List Events (All authenticated users) ────────────────────────────
export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const events = await prisma.event.findMany({
      orderBy: { date: 'asc' },
    });
    res.json(events);
  } catch (err) {
    next(err);
  }
}

// ── Delete Event (Admin Only) ────────────────────────────────────────
export async function deleteEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const { id } = req.params;
    const event = await prisma.event.findUnique({ where: { id } });
    if (!event) {
      throw new AppError(404, 'Etkinlik bulunamadı.');
    }

    // Delete event image if exists
    if (event.imagePath) {
      try {
        await storageService.delete(event.imagePath);
      } catch (e) {
        // Log delete error but continue
        console.error('Error deleting event image:', e);
      }
    }

    await prisma.event.delete({ where: { id } });
    res.json({ message: 'Etkinlik silindi.' });
  } catch (err) {
    next(err);
  }
}
