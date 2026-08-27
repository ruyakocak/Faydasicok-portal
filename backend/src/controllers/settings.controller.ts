import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';
import { AuditAction } from '../types/enums';

const prisma = new PrismaClient();

// Get SMTP Settings
export const getSmtpSettings = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'smtp_settings' }
    });

    if (!setting) {
      return res.status(200).json(null);
    }

    const settings = JSON.parse(setting.value);
    
    // Güvenlik amaçlı parolayı gizleyebiliriz, ancak frontend düzenlemek için görmek isteyebilir.
    // Şifreyi de gönderiyoruz, bu admin paneli sonuçta.
    res.status(200).json(settings);
  } catch (error) {
    console.error('Error fetching SMTP settings:', error);
    res.status(500).json({ error: 'Ayarlar getirilirken hata oluştu.' });
  }
};

// Save SMTP Settings
export const saveSmtpSettings = async (req: Request, res: Response) => {
  try {
    const { host, port, user, pass, from, secure } = req.body;

    const newSettings = { host, port, user, pass, from, secure };

    const oldSetting = await prisma.systemSetting.findUnique({ where: { key: 'smtp_settings' } });
    const oldValue = oldSetting ? JSON.parse(oldSetting.value) : null;
    
    await prisma.systemSetting.upsert({
      where: { key: 'smtp_settings' },
      update: { value: JSON.stringify(newSettings) },
      create: { key: 'smtp_settings', value: JSON.stringify(newSettings) }
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: AuditAction.UPDATE,
          module: 'Settings',
          entityId: 'smtp_settings',
          entityType: 'SystemSetting',
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: JSON.stringify(newSettings)
        }
      });
    }

    res.status(200).json({ message: 'E-posta ayarları başarıyla kaydedildi.' });
  } catch (error) {
    console.error('Error saving SMTP settings:', error);
    res.status(500).json({ error: 'Ayarlar kaydedilirken hata oluştu.' });
  }
};

// Get Retention Settings
export const getRetentionSettings = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'retention_years' }
    });

    const years = setting ? parseInt(setting.value, 10) : 5;
    res.status(200).json({ retentionYears: years });
  } catch (error) {
    console.error('Error fetching retention settings:', error);
    res.status(500).json({ error: 'Ayarlar getirilirken hata oluştu.' });
  }
};

// Save Retention Settings
export const saveRetentionSettings = async (req: Request, res: Response) => {
  try {
    const { retentionYears } = req.body;
    
    if (typeof retentionYears !== 'number' || retentionYears < 1) {
      return res.status(400).json({ error: 'Geçerli bir yıl giriniz.' });
    }

    const oldSetting = await prisma.systemSetting.findUnique({ where: { key: 'retention_years' } });
    
    await prisma.systemSetting.upsert({
      where: { key: 'retention_years' },
      update: { value: retentionYears.toString() },
      create: { key: 'retention_years', value: retentionYears.toString() }
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: AuditAction.UPDATE,
          module: 'Settings',
          entityId: 'retention_years',
          entityType: 'SystemSetting',
          oldValue: oldSetting ? JSON.stringify({ retentionYears: oldSetting.value }) : null,
          newValue: JSON.stringify({ retentionYears: retentionYears.toString() })
        }
      });
    }

    res.status(200).json({ message: 'Veri saklama süresi başarıyla kaydedildi.' });
  } catch (error) {
    console.error('Error saving retention settings:', error);
    res.status(500).json({ error: 'Ayarlar kaydedilirken hata oluştu.' });
  }
};

// Test SMTP Settings
export const testSmtpSettings = async (req: Request, res: Response) => {
  try {
    const { to } = req.body;
    if (!to) {
      return res.status(400).json({ error: 'Test e-postası için geçerli bir alıcı adresi belirtin.' });
    }

    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'smtp_settings' }
    });

    if (!setting) {
      return res.status(400).json({ error: 'Önce e-posta ayarlarını kaydetmelisiniz.' });
    }

    const { host, port, user, pass, from, secure } = JSON.parse(setting.value);

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port),
      secure: secure,
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: `"${from}" <${user}>`,
      to,
      subject: "Test E-postası - Faydasıçok Vakfı",
      text: "Bu bir test e-postasıdır. E-posta ayarlarınız başarıyla yapılandırılmıştır.",
      html: "<p>Bu bir test e-postasıdır. <strong>E-posta ayarlarınız başarıyla yapılandırılmıştır.</strong></p>",
    });

    res.status(200).json({ message: 'Test e-postası başarıyla gönderildi!', messageId: info.messageId });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: `E-posta gönderilemedi: ${error.message}` });
  }
};

const DEFAULT_VOLUNTEER_FORM_SCHEMA = {
  fields: [
    { id: 'fullName', label: 'Ad Soyad', type: 'text', required: true, isDefault: true },
    { id: 'email', label: 'E-posta', type: 'email', required: true, isDefault: true },
    { id: 'schoolAndDepartment', label: 'Okul ve Bölüm', type: 'text', required: true, isDefault: true },
    { id: 'ngoOrProjectName', label: 'STK / Proje Adı', type: 'text', required: true, isDefault: true },
    { id: 'projectDescription', label: 'Proje Detayı', type: 'textarea', required: true, isDefault: true },
    { id: 'targetGroup', label: 'Hedef Grup', type: 'select', required: true, isDefault: true, options: 'Çocuklar, Gençler, Kadınlar, Yaşlılar, Engelliler, Hayvanlar, Çevre, Toplumsal Gelişim (gönüllülük sosyal sorumluluk sosyal girişimcilik toplumsal dayanışma), Diğer' },
    { id: 'targetGroupOther', label: 'Hedef Grup - Diğer (Açıklama)', type: 'text', required: false, isDefault: true },
    { id: 'totalHours', label: 'Dönem Boyunca Ayrılan Toplam Saat', type: 'number', required: true, isDefault: true },
    { id: 'personalImpactEvaluation', label: 'Kişisel Etki ve Değişim Değerlendirmesi', type: 'textarea', required: true, isDefault: true },
  ],
  documents: [
    { id: 'document1', label: 'Belge / Fotoğraf 1', required: true, isDefault: true },
    { id: 'document2', label: 'Belge / Fotoğraf 2', required: false, isDefault: true },
    { id: 'document3', label: 'Belge / Fotoğraf 3', required: false, isDefault: true },
  ]
};

export const getVolunteerFormSchema = async (req: Request, res: Response) => {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: 'VOLUNTEER_FORM_SCHEMA' }
    });

    let schemaData = setting ? JSON.parse(setting.value) : DEFAULT_VOLUNTEER_FORM_SCHEMA;
    
    // Check if form is open in any active period
    const activePeriods = await prisma.documentPeriod.findMany({
      where: { isVolunteerFormOpen: true, isOpen: true }
    });
    
    let isOpen = false;
    
    if (req.user?.role === 'STUDENT') {
      const profile = await prisma.studentProfile.findUnique({
        where: { userId: req.user.userId },
        select: { scholarshipCategoryId: true }
      });
      
      isOpen = activePeriods.some(p => {
        if (!p.categoryIds) return true;
        try {
          const catIds = JSON.parse(p.categoryIds);
          return profile?.scholarshipCategoryId && catIds.includes(profile.scholarshipCategoryId);
        } catch {
          return false;
        }
      });
    } else {
      isOpen = activePeriods.length > 0;
    }
    
    res.status(200).json({ ...schemaData, isOpen });
  } catch (error) {
    res.status(500).json({ error: 'Form ayarları getirilirken hata oluştu.' });
  }
};

export const saveVolunteerFormSchema = async (req: Request, res: Response) => {
  try {
    const { fields, documents } = req.body;
    const value = JSON.stringify({ fields: fields || [], documents: documents || [] });
    const oldSetting = await prisma.systemSetting.findUnique({ where: { key: 'VOLUNTEER_FORM_SCHEMA' } });
    
    await prisma.systemSetting.upsert({
      where: { key: 'VOLUNTEER_FORM_SCHEMA' },
      update: { value },
      create: { key: 'VOLUNTEER_FORM_SCHEMA', value }
    });

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'UPDATE',
          module: 'Settings',
          entityId: 'VOLUNTEER_FORM_SCHEMA',
          entityType: 'SystemSetting',
          oldValue: oldSetting ? oldSetting.value : null,
          newValue: value
        }
      });
    }

    res.status(200).json({ message: 'Form ayarları kaydedildi.' });
  } catch (error) {
    res.status(500).json({ error: 'Form ayarları kaydedilirken hata oluştu.' });
  }
};
