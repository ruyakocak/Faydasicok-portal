import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import nodemailer from 'nodemailer';

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

    await prisma.systemSetting.upsert({
      where: { key: 'smtp_settings' },
      update: { value: JSON.stringify(newSettings) },
      create: { key: 'smtp_settings', value: JSON.stringify(newSettings) }
    });

    res.status(200).json({ message: 'E-posta ayarları başarıyla kaydedildi.' });
  } catch (error) {
    console.error('Error saving SMTP settings:', error);
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
