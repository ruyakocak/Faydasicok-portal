import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { storageService } from '../lib/storage';
import { Role } from '../types/enums';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';

// ── Validation helpers ───────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Submit Volunteer Form ────────────────────────────────────────────
export async function submitVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Ensure the user is a student
    if (req.user!.role !== Role.STUDENT) {
      throw new AppError(403, 'Bu form yalnızca öğrenciler tarafından gönderilebilir.');
    }

    // Get student profile
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true, scholarshipCategoryId: true },
    });
    if (!profile) throw new AppError(404, 'Öğrenci profili bulunamadı.');

    // Parse dynamic fields
    const dynamicFields: Record<string, any> = {};
    if (req.body.dynamicFields) {
      try {
        const parsed = JSON.parse(req.body.dynamicFields);
        Object.assign(dynamicFields, parsed);
      } catch (e) {}
    }

    // Merge body and dynamic fields for validation
    const mergedBody = { ...req.body, ...dynamicFields };

    // Fetch schema to know which fields/docs are required
    const setting = await prisma.systemSetting.findUnique({ where: { key: 'VOLUNTEER_FORM_SCHEMA' } });
    const schema = setting ? JSON.parse(setting.value) : { fields: [], documents: [] };
    const schemaFields = schema.fields || [];
    const schemaDocs = schema.documents || [];

    if (!mergedBody.scholarshipCategoryId?.trim()) {
      throw new AppError(400, 'Geçerli bir gelişim programı seçiniz.');
    }

    // Dynamic fields validation
    for (const field of schemaFields) {
      const val = mergedBody[field.id];
      if (field.required && (val === undefined || val === null || val.toString().trim() === '')) {
        throw new AppError(400, `${field.label} alanı zorunludur.`);
      }
      if (val && field.type === 'email' && !EMAIL_RE.test(val.toString().trim())) {
        throw new AppError(400, 'Geçerli bir e-posta adresi giriniz.');
      }
    }

    // Period Check
    const activePeriods = await prisma.documentPeriod.findMany({
      where: { isVolunteerFormOpen: true, isOpen: true },
    });

    if (activePeriods.length === 0) {
      throw new AppError(403, 'Şu anda açık bir gönüllülük formu dönemi bulunmamaktadır.');
    }

    // Find a period that matches the student's category (or applies to all)
    const validPeriod = activePeriods.find(p => {
      if (!p.categoryIds) return true; // applies to all
      try {
        const catIds: string[] = JSON.parse(p.categoryIds);
        return profile.scholarshipCategoryId && catIds.includes(profile.scholarshipCategoryId);
      } catch {
        return false;
      }
    });

    if (!validPeriod) {
      throw new AppError(403, 'Sizin grubunuz için açık bir gönüllülük formu dönemi bulunmamaktadır.');
    }



    const files = req.files as Express.Multer.File[] | undefined;
    
    // Validate required documents
    for (const doc of schemaDocs) {
      if (doc.required) {
        const found = files?.find(f => f.fieldname === doc.id);
        if (!found) {
          throw new AppError(400, `${doc.label} yüklenmesi zorunludur.`);
        }
      }
    }

    // Save files
    const storedDocs: Record<string, { filePath: string; originalFileName: string }> = {};
    const otherDocsArr: any[] = [];
    
    if (files) {
      for (const f of files) {
        const stored = await storageService.save(f.buffer, f.originalname, f.mimetype);
        if (f.fieldname === 'document1' || f.fieldname === 'document2' || f.fieldname === 'document3') {
          storedDocs[f.fieldname] = stored;
        } else {
          const docDef = schemaDocs.find((d: any) => d.id === f.fieldname);
          otherDocsArr.push({
            id: f.fieldname,
            label: docDef ? docDef.label : f.fieldname,
            path: stored.filePath,
            originalName: stored.originalFileName
          });
        }
      }
    }



    // Extract default fields from body or dynamicFields (in case frontend sends them differently)
    // Actually frontend sends default fields in req.body directly, and non-default in dynamicFields
    const getFieldVal = (id: string) => req.body[id] !== undefined ? req.body[id] : dynamicFields[id];

    // Create DB record
    const form = await prisma.volunteerForm.create({
      data: {
        studentProfileId: profile.id,
        periodId: validPeriod.id,
        scholarshipCategoryId: req.body.scholarshipCategoryId,
        fullName: getFieldVal('fullName')?.trim() || req.body.fullName?.trim() || '',
        email: getFieldVal('email')?.trim() || req.body.email?.trim() || '',
        schoolAndDepartment: getFieldVal('schoolAndDepartment')?.trim() || null,
        ngoOrProjectName: getFieldVal('ngoOrProjectName')?.trim() || null,
        projectDescription: getFieldVal('projectDescription')?.trim() || null,
        targetGroup: getFieldVal('targetGroup') || null,
        targetGroupOther: getFieldVal('targetGroupOther')?.trim() || null,
        totalHours: getFieldVal('totalHours') ? parseInt(getFieldVal('totalHours'), 10) : null,
        personalImpactEvaluation: getFieldVal('personalImpactEvaluation')?.trim() || null,
        
        dynamicFields: req.body.dynamicFields || null,
        
        document1Path: storedDocs['document1']?.filePath || null,
        document1OriginalName: storedDocs['document1']?.originalFileName || null,
        document2Path: storedDocs['document2']?.filePath || null,
        document2OriginalName: storedDocs['document2']?.originalFileName || null,
        document3Path: storedDocs['document3']?.filePath || null,
        document3OriginalName: storedDocs['document3']?.originalFileName || null,
        otherDocuments: otherDocsArr.length > 0 ? JSON.stringify(otherDocsArr) : null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'CREATE',
        module: 'VolunteerForm',
        entityId: form.id,
        entityType: 'VolunteerForm',
        newValue: JSON.stringify({ fullName: form.fullName }),
      },
    });

    res.status(201).json({
      message: 'Gönüllülük formu başarıyla gönderildi.',
      form,
    });
  } catch (err) {
    next(err);
  }
}

// ── Get My Volunteer Forms ───────────────────────────────────────────
export async function getMyVolunteerForms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: req.user!.userId },
      select: { id: true },
    });
    if (!profile) throw new AppError(404, 'Öğrenci profili bulunamadı.');

    const forms = await prisma.volunteerForm.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { createdAt: 'desc' },
      include: {
        scholarshipCategory: { select: { id: true, name: true } },
        period: { select: { id: true, label: true } }
      }
    });

    res.json(forms);
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] List All Volunteer Forms ─────────────────────────────────
export async function adminListVolunteerForms(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const search = (req.query.search as string)?.trim() || '';
    const categoryFilter = (req.query.scholarshipCategoryId as string)?.trim() || '';
    const targetGroupFilter = (req.query.targetGroup as string)?.trim() || '';

    const periodFilter = (req.query.periodLabel as string)?.trim() || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { ngoOrProjectName: { contains: search } },
        { schoolAndDepartment: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (categoryFilter) {
      where.scholarshipCategoryId = categoryFilter;
    }
    if (targetGroupFilter) {
      where.targetGroup = { contains: targetGroupFilter };
    }
    if (periodFilter) {
      where.period = { label: periodFilter };
    }

    const [forms, total] = await Promise.all([
      prisma.volunteerForm.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          scholarshipCategory: { select: { id: true, name: true } },
          studentProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { tcKimlikNo: true } },
            },
          },
        },
      }),
      prisma.volunteerForm.count({ where }),
    ]);

    res.json({
      data: forms,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Get Single Volunteer Form ────────────────────────────────
export async function adminGetVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const form = await prisma.volunteerForm.findUnique({
      where: { id: req.params.id },
      include: {
        scholarshipCategory: { select: { id: true, name: true } },
        studentProfile: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            user: { select: { tcKimlikNo: true } },
          },
        },
      },
    });
    if (!form) throw new AppError(404, 'Form bulunamadı.');

    res.json(form);
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Update Volunteer Form ─────────────────────────────────────
export async function adminUpdateVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const existing = await prisma.volunteerForm.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Form bulunamadı.');

    const {
      fullName, email, scholarshipCategoryId, schoolAndDepartment,
      ngoOrProjectName, projectDescription, targetGroup, targetGroupOther,
      totalHours, personalImpactEvaluation,
    } = req.body;

    // Validate only provided fields
    if (email !== undefined && email !== null) {
      if (!EMAIL_RE.test(String(email).trim())) throw new AppError(400, 'Geçerli bir e-posta adresi giriniz.');
    }

    if (totalHours !== undefined) {
      const h = parseInt(totalHours, 10);
      if (isNaN(h) || h <= 0) throw new AppError(400, 'Toplam saat pozitif bir tamsayı olmalıdır.');
    }
    const effTargetGroup = targetGroup ?? existing.targetGroup;
    if (effTargetGroup === 'Diğer') {
      const effOther = targetGroupOther ?? existing.targetGroupOther;
      if (!effOther?.trim()) throw new AppError(400, '"Diğer" seçildiğinde açıklama alanı zorunludur.');
    }

    const updated = await prisma.volunteerForm.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined && { fullName: String(fullName).trim() }),
        ...(email !== undefined && { email: String(email).trim() }),
        ...(scholarshipCategoryId !== undefined && { scholarshipCategoryId }),
        ...(schoolAndDepartment !== undefined && { schoolAndDepartment: String(schoolAndDepartment).trim() }),
        ...(ngoOrProjectName !== undefined && { ngoOrProjectName: String(ngoOrProjectName).trim() }),
        ...(projectDescription !== undefined && { projectDescription: String(projectDescription).trim() }),
        ...(targetGroup !== undefined && { targetGroup }),
        ...(targetGroupOther !== undefined && { targetGroupOther: targetGroup === 'Diğer' ? String(targetGroupOther).trim() || null : null }),
        ...(totalHours !== undefined && { totalHours: parseInt(totalHours, 10) }),
        ...(personalImpactEvaluation !== undefined && { personalImpactEvaluation: String(personalImpactEvaluation).trim() }),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'UPDATE',
        module: 'VolunteerForm',
        entityId: req.params.id,
        entityType: 'VolunteerForm',
        newValue: JSON.stringify(req.body),
      },
    });

    res.json({ message: 'Form güncellendi.', form: updated });
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Delete Volunteer Form ─────────────────────────────────────
export async function adminDeleteVolunteerForm(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const form = await prisma.volunteerForm.findUnique({ where: { id: req.params.id } });
    if (!form) throw new AppError(404, 'Form bulunamadı.');

    // We keep files in storage for audit reasons, or you can delete them here if preferred
    // For now we just delete the db record

    await prisma.volunteerForm.delete({ where: { id: req.params.id } });

    await prisma.auditLog.create({
      data: {
        userId: req.user!.userId,
        action: 'DELETE',
        module: 'VolunteerForm',
        entityId: req.params.id,
        entityType: 'VolunteerForm',
        newValue: JSON.stringify({ message: 'Form silindi.' }),
      },
    });

    res.json({ message: 'Form başarıyla silindi.' });
  } catch (err) {
    next(err);
  }
}

// ── [ADMIN] Export Volunteer Forms to Excel ──────────────────────────
export async function adminExportVolunteerFormsExcel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.user!.role !== Role.ADMIN && req.user!.role !== Role.REVIEWER) {
      throw new AppError(403, 'Bu işlem için yetkiniz yok.');
    }

    const search = (req.query.search as string)?.trim() || '';
    const categoryFilter = (req.query.scholarshipCategoryId as string)?.trim() || '';
    const targetGroupFilter = (req.query.targetGroup as string)?.trim() || '';
    const periodFilter = (req.query.periodLabel as string)?.trim() || '';

    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { ngoOrProjectName: { contains: search } },
        { schoolAndDepartment: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (categoryFilter) {
      where.scholarshipCategoryId = categoryFilter;
    }
    if (targetGroupFilter) {
      where.targetGroup = { contains: targetGroupFilter };
    }
    if (periodFilter) {
      where.period = { label: periodFilter };
    }

    const [forms, setting] = await Promise.all([
      prisma.volunteerForm.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          scholarshipCategory: { select: { id: true, name: true } },
          period: { select: { id: true, label: true } },
          studentProfile: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              user: { select: { tcKimlikNo: true } },
            },
          },
        },
      }),
      prisma.systemSetting.findUnique({ where: { key: 'VOLUNTEER_FORM_SCHEMA' } }),
    ]);

    const schema = setting ? JSON.parse(setting.value) : { fields: [], documents: [] };
    const schemaFields = schema.fields || [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Faydasıçok Vakfı';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Gönüllülük Formları', {
      views: [{ state: 'frozen', ySplit: 1 }]
    });

    // Build columns
    const columns: any[] = [
      { header: 'No', key: 'index', width: 6 },
      { header: 'Öğrenci Adı Soyadı', key: 'fullName', width: 25 },
      { header: 'TC Kimlik No', key: 'tc', width: 16 },
      { header: 'E-posta', key: 'email', width: 28 },
      { header: 'Gelişim Programı', key: 'category', width: 22 },
      { header: 'Dönem', key: 'period', width: 20 },
    ];

    schemaFields.forEach((field: any) => {
      let width = 25;
      if (field.type === 'textarea') width = 45;
      else if (field.type === 'number') width = 14;
      else if (field.type === 'date') width = 16;
      columns.push({ header: field.label, key: field.id, width });
    });

    columns.push({ header: 'Yüklenen Belgeler', key: 'documents', width: 35 });
    columns.push({ header: 'Gönderim Tarihi', key: 'createdAt', width: 18 });

    sheet.columns = columns;

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.height = 32;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '1E3A8A' } // Dark Professional Blue
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFF' }
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'center',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: '0F2356' } },
        left: { style: 'thin', color: { argb: '0F2356' } },
        bottom: { style: 'medium', color: { argb: '0F2356' } },
        right: { style: 'thin', color: { argb: '0F2356' } },
      };
    });

    // Populate data
    forms.forEach((form, idx) => {
      let dynamicData: Record<string, any> = {};
      if (form.dynamicFields) {
        try {
          dynamicData = JSON.parse(form.dynamicFields);
        } catch (e) {}
      }

      // Collect documents info
      const docNames: string[] = [];
      if (form.document1OriginalName) docNames.push(form.document1OriginalName);
      if (form.document2OriginalName) docNames.push(form.document2OriginalName);
      if (form.document3OriginalName) docNames.push(form.document3OriginalName);
      if (form.otherDocuments) {
        try {
          const others = JSON.parse(form.otherDocuments);
          if (Array.isArray(others)) {
            others.forEach((o: any) => {
              if (o.originalName) docNames.push(o.originalName);
            });
          }
        } catch (e) {}
      }

      const rowData: Record<string, any> = {
        index: idx + 1,
        fullName: form.studentProfile ? `${form.studentProfile.firstName} ${form.studentProfile.lastName}` : form.fullName,
        tc: form.studentProfile?.user?.tcKimlikNo || '-',
        email: form.email,
        category: form.scholarshipCategory?.name || 'Belirtilmemiş',
        period: form.period?.label || '-',
        documents: docNames.length > 0 ? docNames.join(', ') : 'Belge yok',
        createdAt: format(new Date(form.createdAt), 'dd.MM.yyyy HH:mm'),
      };

      schemaFields.forEach((field: any) => {
        const val = field.isDefault ? (form as any)[field.id] : dynamicData[field.id];
        rowData[field.id] = val !== undefined && val !== null ? val : '-';
      });

      const row = sheet.addRow(rowData);
      row.height = 24;

      // Alternating row color
      const isEven = (idx % 2 === 0);
      const rowBgColor = isEven ? 'FFFFFF' : 'F8FAFC';

      row.eachCell((cell, colNumber) => {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: '334155' }
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'E2E8F0' } },
          left: { style: 'thin', color: { argb: 'E2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
          right: { style: 'thin', color: { argb: 'E2E8F0' } },
        };
        
        // Alignment
        const colDef = columns[colNumber - 1];
        if (colDef?.key === 'index' || colDef?.key === 'tc' || colDef?.key === 'createdAt' || colDef?.key === 'totalHours') {
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: colDef?.width > 30 };
        }
      });
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=Gonulluluk_Formlari_${format(new Date(), 'yyyy-MM-dd')}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}
