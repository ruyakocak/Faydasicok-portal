import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { Role } from '../types/enums';
import { sendEventEmail } from '../lib/email.service';

// ── Create Event (Admin Only) ────────────────────────────────────────
export async function createEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const { title, description, date, meetingUrl, categoryIds } = req.body;
    if (!title || !date) {
      throw new AppError(400, 'Başlık ve tarih zorunludur.');
    }

    let imagePath: string | undefined;
    if (req.file) {
      const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);
      imagePath = stored.filePath;
    }

    // Normalize categoryIds: can come as JSON string, array, or empty
    let categoryIdsStr: string | null = null;
    if (categoryIds) {
      try {
        const parsed = typeof categoryIds === 'string' ? JSON.parse(categoryIds) : categoryIds;
        if (Array.isArray(parsed) && parsed.length > 0) {
          categoryIdsStr = JSON.stringify(parsed);
        }
      } catch {
        // ignore
      }
    }

    const event = await prisma.event.create({
      data: {
        title,
        description,
        date: new Date(date),
        meetingUrl: meetingUrl || null,
        imagePath: imagePath || null,
        categoryIds: categoryIdsStr,
      },
    });

    res.status(201).json(event);

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
          await sendEventEmail({
            to: emails,
            eventTitle: event.title,
            eventDescription: event.description,
            eventDate: event.date,
            meetingUrl: event.meetingUrl,
          });
        }
      } catch (e) {
        console.error('[Email] Event email error:', e);
      }
    })();
  } catch (err) {
    next(err);
  }
}

// ── List Events (All authenticated users — students get filtered) ──────
export async function listEvents(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const allEvents = await prisma.event.findMany({
      orderBy: { date: 'asc' },
    });

    // Admins / reviewers / mentors see all events
    if (req.user!.role !== Role.STUDENT) {
      res.json(allEvents);
      return;
    }

    // Students: filter by their scholarship category
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { scholarshipCategoryId: true },
    });

    const studentCatId = profile?.scholarshipCategoryId ?? null;

    const filtered = allEvents.filter(ev => {
      if (!ev.categoryIds) return true; // no restriction → show to all
      try {
        const catIds: string[] = JSON.parse(ev.categoryIds);
        if (catIds.length === 0) return true;
        if (studentCatId && catIds.includes(studentCatId)) return true;
        return false;
      } catch {
        return true;
      }
    });

    res.json(filtered);
  } catch (err) {
    next(err);
  }
}

// ── Update Event (Admin Only) ────────────────────────────────────────
export async function updateEvent(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const { id } = req.params;
    const { title, description, date, meetingUrl, categoryIds, removeImage } = req.body;

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      throw new AppError(404, 'Etkinlik bulunamadı.');
    }

    let imagePath = existing.imagePath;

    // Handle image removal
    if (removeImage === 'true' && existing.imagePath) {
      try {
        await storageService.delete(existing.imagePath);
      } catch (e) {
        console.error('Error deleting old event image:', e);
      }
      imagePath = null;
    }

    // Handle new image upload
    if (req.file) {
      // If there's an existing image that wasn't marked for removal, delete it first to avoid orphans
      if (existing.imagePath && imagePath === existing.imagePath) {
         try {
           await storageService.delete(existing.imagePath);
         } catch (e) {
           console.error('Error deleting old event image:', e);
         }
      }
      const stored = await storageService.save(req.file.buffer, req.file.originalname, req.file.mimetype);
      imagePath = stored.filePath;
    }

    // Normalize categoryIds
    let categoryIdsStr: string | null = existing.categoryIds;
    if (categoryIds !== undefined) {
      try {
        const parsed = typeof categoryIds === 'string' ? JSON.parse(categoryIds) : categoryIds;
        if (Array.isArray(parsed)) {
          categoryIdsStr = parsed.length > 0 ? JSON.stringify(parsed) : null;
        } else if (parsed === null) {
          categoryIdsStr = null;
        }
      } catch {
        // ignore
      }
    }

    const updated = await prisma.event.update({
      where: { id },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(date && { date: new Date(date) }),
        ...(meetingUrl !== undefined && { meetingUrl: meetingUrl || null }),
        imagePath,
        ...(categoryIds !== undefined && { categoryIds: categoryIdsStr }),
      },
    });

    res.json(updated);
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
