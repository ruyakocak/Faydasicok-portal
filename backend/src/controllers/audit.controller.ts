import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

export async function getAuditLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const {
      userId, studentProfileId, module, action,
      startDate, endDate,
      page = '1', limit = '50',
    } = req.query;

    const where: any = {};

    if (userId) where.userId = userId as string;
    if (module) where.module = { contains: module as string, mode: 'insensitive' };
    
    if (action) {
      where.action = action;
    } else {
      where.action = { notIn: ['LOGIN', 'LOGOUT'] };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }

    // Filter by student profile (join through entityId)
    if (studentProfileId) {
      where.OR = [
        { entityId: studentProfileId as string },
        { entityType: 'ApprovableChange', entityId: { in: await getChangeIdsForProfile(studentProfileId as string) } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { 
            select: { 
              id: true, 
              tcKimlikNo: true, 
              email: true, 
              username: true, 
              role: true,
              studentProfile: { select: { id: true, firstName: true, lastName: true } }
            } 
          },
          approver: { select: { id: true, email: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      data: logs,
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

async function getChangeIdsForProfile(profileId: string): Promise<string[]> {
  const changes = await prisma.approvableChange.findMany({
    where: { studentProfileId: profileId },
    select: { id: true },
  });
  return changes.map((c) => c.id);
}
