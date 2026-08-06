import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { ApprovableEntityType, AuditAction } from '../types/enums';

// ── Get Approval Queue ────────────────────────────────────────────────
export async function getApprovalQueue(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status = 'PENDING', entityType, page = '1', limit = '20', studentId } = req.query;

    const where: any = {
      status: status as string,
    };

    if (entityType) where.entityType = entityType;
    if (studentId) where.studentProfileId = studentId as string;

    const skip = (Number(page) - 1) * Number(limit);

    const [changes, total] = await Promise.all([
      prisma.approvableChange.findMany({
        where,
        include: {
          studentProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              universityName: true,
              department: true,
            },
          },
          document: {
            select: {
              id: true,
              type: true,
              originalFileName: true,
              filePath: true,
              mimeType: true,
              grade: true,
              semester: true,
              academicYear: true,
              volunteerOrg: true,
            },
          },
          changedBy: { select: { id: true, tcKimlikNo: true, email: true, username: true } },
          approvedBy: { select: { id: true, email: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.approvableChange.count({ where }),
    ]);

    res.json({
      data: changes,
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

// ── Approve a Change ──────────────────────────────────────────────────
export async function approveChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const change = await prisma.approvableChange.findUnique({
      where: { id },
      include: { document: true },
    });

    if (!change) throw new AppError(404, 'Değişiklik kaydı bulunamadı.');
    if (change.status !== 'PENDING') throw new AppError(400, 'Bu değişiklik zaten işlenmiş.');

    // Apply the change based on entity type
    await prisma.$transaction(async (tx) => {
      // Update the approvable change record
      await tx.approvableChange.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedById: req.user!.userId,
          reviewedAt: new Date(),
        },
      });

      // Apply the actual change to the profile
      if (change.entityType === ApprovableEntityType.DOCUMENT) {
        await tx.document.update({
          where: { id: change.documentId! },
          data: { status: 'APPROVED' },
        });
      } else if (change.fieldName && change.newValue) {
        // Apply field change to student profile
        const fieldName = change.fieldName;
        let value: any = change.newValue;

        // Type coercion for known fields
        const intFields = ['fatherAge', 'motherAge', 'familyMemberCount', 'siblingCount', 'siblingsInEducation', 'grade', 'highSchoolGradYear'];
        const boolFields = ['fatherAlive', 'motherAlive'];
        const dateFields = ['birthDate', 'scholarshipDate'];
        const decimalFields = ['fatherIncome', 'motherIncome'];

        if (intFields.includes(fieldName)) value = parseInt(value);
        else if (boolFields.includes(fieldName)) value = value === 'true';
        else if (dateFields.includes(fieldName)) value = new Date(value);
        else if (decimalFields.includes(fieldName)) value = parseFloat(value);

        await tx.studentProfile.update({
          where: { id: change.studentProfileId },
          data: { [fieldName]: value },
        });
      }

      // Audit log
      await tx.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: AuditAction.APPROVE,
          module: change.entityType,
          entityId: change.id,
          entityType: 'ApprovableChange',
          oldValue: change.oldValue,
          newValue: change.newValue,
          approverId: req.user!.userId,
        },
      });
    });

    res.json({ message: 'Değişiklik onaylandı.' });
  } catch (err) {
    next(err);
  }
}

// ── Reject a Change ───────────────────────────────────────────────────
export async function rejectChange(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { rejectionNote } = req.body;

    if (!rejectionNote?.trim()) throw new AppError(400, 'Red sebebi zorunludur.');

    const change = await prisma.approvableChange.findUnique({ where: { id } });
    if (!change) throw new AppError(404, 'Değişiklik kaydı bulunamadı.');
    if (change.status !== 'PENDING') throw new AppError(400, 'Bu değişiklik zaten işlenmiş.');

    await prisma.$transaction(async (tx) => {
      await tx.approvableChange.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewNote: rejectionNote,
          approvedById: req.user!.userId,
          reviewedAt: new Date(),
        },
      });

      if (change.entityType === ApprovableEntityType.DOCUMENT && change.documentId) {
        await tx.document.update({
          where: { id: change.documentId },
          data: { status: 'REJECTED', rejectionNote },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: req.user!.userId,
          action: AuditAction.REJECT,
          module: change.entityType,
          entityId: change.id,
          entityType: 'ApprovableChange',
          oldValue: change.oldValue,
          newValue: change.newValue,
          approverId: req.user!.userId,
        },
      });
    });

    res.json({ message: 'Değişiklik reddedildi.' });
  } catch (err) {
    next(err);
  }
}

// ── Bulk Approve ──────────────────────────────────────────────────────
export async function bulkApprove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) throw new AppError(400, 'ID listesi zorunludur.');

    let approved = 0;
    let failed = 0;

    for (const id of ids) {
      try {
        const fakeReq = { ...req, params: { id } } as Request;
        const fakeRes = { json: () => {} } as any;
        // Reuse approveChange logic
        await approveChange(fakeReq, fakeRes, () => {});
        approved++;
      } catch {
        failed++;
      }
    }

    res.json({ message: `${approved} onaylandı, ${failed} başarısız.`, approved, failed });
  } catch (err) {
    next(err);
  }
}
