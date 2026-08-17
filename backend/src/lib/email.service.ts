import nodemailer from 'nodemailer';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';

// ── Transporter ─────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'ruyakocak11@gmail.com',
    pass: process.env.EMAIL_PASS || 'jhgsapwpjdcvvedc',
  },
});

const FROM = process.env.EMAIL_FROM || 'Faydasıçok Vakfı <ruyakocak11@gmail.com>';

// ── Base HTML Template ───────────────────────────────────────────────────
function baseTemplate(title: string, content: string): string {
  return `
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f0f2f5;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f0f2f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;">
          
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#C62828 0%,#8B0000 100%);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;color:rgba(255,255,255,0.8);font-size:13px;font-weight:500;letter-spacing:1px;text-transform:uppercase;">Faydasıçok Burs Portalı</p>
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;line-height:1.3;">${title}</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;padding:40px;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              ${content}

              <!-- Footer -->
              <hr style="border:none;border-top:1px solid #f0f0f0;margin:32px 0 24px;"/>
              <p style="margin:0;color:#9ca3af;font-size:12px;text-align:center;line-height:1.6;">
                Bu e-posta Faydasıçok Vakfı Burs Portalı tarafından otomatik olarak gönderilmiştir.<br/>
                Lütfen bu e-postaya yanıt vermeyiniz. Sorularınız için vakıfla iletişime geçiniz.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ── Send helper ──────────────────────────────────────────────────────────
async function sendMail(to: string | string[], subject: string, html: string) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
  } catch (err) {
    // Log but never throw – email failure should never break the main flow
    console.error('[EmailService] Failed to send email:', err);
  }
}

// ── Greeting helper ──────────────────────────────────────────────────────
function greet(firstName?: string | null) {
  return firstName ? `Sayın <strong>${firstName}</strong>,` : 'Sayın Bursiyerimiz,';
}

// ─────────────────────────────────────────────────────────────────────────
// EMAIL SENDERS
// ─────────────────────────────────────────────────────────────────────────

// 1. Yeni Duyuru
export async function sendAnnouncementEmail(opts: {
  to: string[];
  announcementTitle: string;
  announcementContent: string;
  firstName?: string;
}) {
  const { to, announcementTitle, announcementContent, firstName } = opts;
  if (!to.length) return;

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${greet(firstName)}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Faydasıçok Vakfı tarafından size yeni bir <strong>duyuru</strong> iletilmektedir.
    </p>
    <div style="background:#fdf2f2;border-left:4px solid #C62828;border-radius:0 8px 8px 0;padding:20px 24px;margin:0 0 24px;">
      <h2 style="margin:0 0 12px;color:#C62828;font-size:18px;font-weight:700;">${announcementTitle}</h2>
      <p style="margin:0;color:#4b5563;font-size:14px;line-height:1.7;white-space:pre-line;">${announcementContent}</p>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
      Detayları görmek için <a href="http://localhost:5173/student/announcements" style="color:#C62828;font-weight:600;text-decoration:none;">Burs Portalı'ndaki duyurular sayfasını</a> ziyaret edebilirsiniz.
    </p>`;

  await sendMail(to, `📢 Yeni Duyuru: ${announcementTitle}`, baseTemplate(`📢 ${announcementTitle}`, content));
}

// 2. Yeni Belge Yükleme Dönemi
export async function sendNewPeriodEmail(opts: {
  to: string[];
  periodLabel: string;
  periodType: string;
  deadline?: string | null;
  firstName?: string;
}) {
  const { to, periodLabel, periodType, deadline, firstName } = opts;
  if (!to.length) return;

  const deadlineStr = deadline
    ? `<p style="color:#374151;font-size:14px;margin:0 0 16px;">
         📅 <strong>Son Yükleme Tarihi:</strong> ${format(new Date(deadline), 'dd MMMM yyyy', { locale: tr })}
       </p>`
    : '';

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${greet(firstName)}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Sizin için <strong>${periodLabel}</strong> belgesi yüklemeye açılmıştır.
    </p>
    <div style="background:#fdf2f2;border-left:4px solid #C62828;border-radius:0 8px 8px 0;padding:20px 24px;margin:0 0 24px;">
      <h2 style="margin:0 0 8px;color:#C62828;font-size:18px;font-weight:700;">${periodLabel}</h2>
      <p style="margin:0 0 12px;color:#6b7280;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">${periodType}</p>
      ${deadlineStr}
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 16px;">
      Belge yüklemelerinizi zamanında tamamlamanız önem taşımaktadır. 
      Eksik belgelerinizi <a href="http://localhost:5173/student/profile" style="color:#C62828;font-weight:600;text-decoration:none;">Burs Portalı'nda</a> yükleyebilirsiniz.
    </p>`;

  await sendMail(to, `📁 Belge Yükleme Talebi: ${periodLabel}`, baseTemplate(`📁 Evrak Yükleme Talebi`, content));
}

// 3. Belge Onaylandı
export async function sendDocumentApprovedEmail(opts: {
  to: string;
  firstName?: string;
  documentType: string;
  periodLabel?: string;
}) {
  const { to, firstName, documentType, periodLabel } = opts;

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${greet(firstName)}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Yüklemiş olduğunuz belge incelenmiş ve <strong style="color:#16a34a;">onaylanmıştır</strong>. 🎉
    </p>
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:40px;height:40px;border-radius:50%;background:#16a34a;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <span style="color:white;font-size:20px;">✓</span>
        </div>
        <div>
          <p style="margin:0 0 4px;color:#15803d;font-size:16px;font-weight:700;">Onaylandı</p>
          <p style="margin:0;color:#374151;font-size:14px;"><strong>Belge:</strong> ${documentType}</p>
          ${periodLabel ? `<p style="margin:4px 0 0;color:#6b7280;font-size:13px;"><strong>Dönem:</strong> ${periodLabel}</p>` : ''}
        </div>
      </div>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
      Tüm belgelerinizin durumunu <a href="http://localhost:5173/student/profile" style="color:#C62828;font-weight:600;text-decoration:none;">Burs Portalı</a>'ndan takip edebilirsiniz.
    </p>`;

  await sendMail(to, `✅ Belgeniz Onaylandı: ${documentType}`, baseTemplate('Belgeniz Onaylandı', content));
}

// 4. Belge Reddedildi
export async function sendDocumentRejectedEmail(opts: {
  to: string;
  firstName?: string;
  documentType: string;
  periodLabel?: string;
  rejectionNote?: string;
}) {
  const { to, firstName, documentType, periodLabel, rejectionNote } = opts;

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${greet(firstName)}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Yüklemiş olduğunuz belge incelenmiş ancak <strong style="color:#dc2626;">reddedilmiştir</strong>.
    </p>
    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px 24px;margin:0 0 24px;">
      <p style="margin:0 0 8px;color:#dc2626;font-size:16px;font-weight:700;">❌ Reddedildi</p>
      <p style="margin:0 0 8px;color:#374151;font-size:14px;"><strong>Belge:</strong> ${documentType}</p>
      ${periodLabel ? `<p style="margin:0 0 8px;color:#6b7280;font-size:13px;"><strong>Dönem:</strong> ${periodLabel}</p>` : ''}
      ${rejectionNote ? `
      <hr style="border:none;border-top:1px solid #fecaca;margin:12px 0;"/>
      <p style="margin:0 0 4px;color:#dc2626;font-size:13px;font-weight:600;">Red Sebebi:</p>
      <p style="margin:0;color:#374151;font-size:14px;line-height:1.6;">${rejectionNote}</p>` : ''}
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
      Lütfen belgenizi düzenleyerek tekrar yükleyiniz. Detaylar için 
      <a href="http://localhost:5173/student/profile" style="color:#C62828;font-weight:600;text-decoration:none;">Burs Portalı</a>'na giriş yapabilirsiniz.
    </p>`;

  await sendMail(to, `❌ Belgeniz Reddedildi: ${documentType}`, baseTemplate('Belgeniz Reddedildi', content));
}

// 5. Mentör Atandı
export async function sendMentorAssignedEmail(opts: {
  to: string;
  firstName?: string;
  mentorFirstName: string;
  mentorLastName: string;
  mentorTitle?: string | null;
  mentorCompany?: string | null;
  mentorEmail?: string | null;
  mentorPhone?: string | null;
}) {
  const { to, firstName, mentorFirstName, mentorLastName, mentorTitle, mentorCompany, mentorEmail, mentorPhone } = opts;

  const mentorNameLine = `${mentorTitle ? mentorTitle + ' ' : ''}${mentorFirstName} ${mentorLastName}`;

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${greet(firstName)}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Faydasıçok Vakfı tarafından size bir <strong>mentör atanmıştır</strong>. Mentörünüz sizi kişisel ve akademik gelişiminizde destekleyecektir.
    </p>
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="margin:0 0 4px;color:#ea580c;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Mentörünüz</p>
      <h2 style="margin:0 0 16px;color:#1f2937;font-size:20px;font-weight:700;">${mentorNameLine}</h2>
      <table cellpadding="0" cellspacing="0" style="width:100%;">
        ${mentorCompany ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;font-weight:600;width:100px;">🏢 Kurum</td>
          <td style="padding:4px 0;color:#374151;font-size:14px;">${mentorCompany}</td>
        </tr>` : ''}
        ${mentorEmail ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;font-weight:600;width:100px;">✉️ E-posta</td>
          <td style="padding:4px 0;color:#374151;font-size:14px;"><a href="mailto:${mentorEmail}" style="color:#C62828;text-decoration:none;">${mentorEmail}</a></td>
        </tr>` : ''}
        ${mentorPhone ? `
        <tr>
          <td style="padding:4px 0;color:#6b7280;font-size:13px;font-weight:600;width:100px;">📞 Telefon</td>
          <td style="padding:4px 0;color:#374151;font-size:14px;">${mentorPhone}</td>
        </tr>` : ''}
      </table>
    </div>
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
      Mentörünüzün bilgilerine <a href="http://localhost:5173/student/profile" style="color:#C62828;font-weight:600;text-decoration:none;">Burs Portalı</a>'ndan da ulaşabilirsiniz.
    </p>`;

  await sendMail(to, `🎓 Mentörünüz Atandı: ${mentorNameLine}`, baseTemplate('Mentörünüz Atandı! 🎓', content));
}

// 6. Yeni Etkinlik / Eğitim
export async function sendEventEmail(opts: {
  to: string[];
  eventTitle: string;
  eventDescription?: string | null;
  eventDate: Date | string;
  meetingUrl?: string | null;
  firstName?: string;
}) {
  const { to, eventTitle, eventDescription, eventDate, meetingUrl, firstName } = opts;
  if (!to.length) return;

  const formattedDate = format(new Date(eventDate), "dd MMMM yyyy 'saat' HH:mm", { locale: tr });

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">${greet(firstName)}</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Faydasıçok Vakfı tarafından yeni bir <strong>eğitim/etkinlik</strong> planlanmıştır.
    </p>
    <div style="background:#fdf2f2;border-left:4px solid #C62828;border-radius:0 12px 12px 0;padding:24px;margin:0 0 24px;">
      <h2 style="margin:0 0 8px;color:#C62828;font-size:20px;font-weight:700;">${eventTitle}</h2>
      <p style="margin:0 0 16px;color:#6b7280;font-size:14px;font-weight:600;">
        📅 ${formattedDate}
      </p>
      ${eventDescription ? `<p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${eventDescription}</p>` : ''}
    </div>
    ${meetingUrl ? `
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${meetingUrl}" target="_blank" 
         style="display:inline-block;background:#C62828;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;letter-spacing:0.2px;">
        🎥 Toplantıya Katıl
      </a>
    </div>` : ''}
    <p style="color:#374151;font-size:14px;line-height:1.6;margin:0;">
      Tüm etkinlikleri görmek için <a href="http://localhost:5173/student/events" style="color:#C62828;font-weight:600;text-decoration:none;">Burs Portalı'ndaki Eğitim & Etkinlikler sayfasını</a> ziyaret edebilirsiniz.
    </p>`;

  await sendMail(to, `📅 Yeni Etkinlik: ${eventTitle} – ${formattedDate}`, baseTemplate(`📅 ${eventTitle}`, content));
}

// 7. Şifre Sıfırlama
export async function sendPasswordResetEmail(opts: {
  to: string;
  resetLink: string;
}) {
  const { to, resetLink } = opts;

  const content = `
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 16px;">Merhaba,</p>
    <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 24px;">
      Faydasıçok Vakfı Burs Portalı hesabınız için şifre sıfırlama talebinde bulundunuz. 
      Şifrenizi sıfırlamak için aşağıdaki butona tıklayabilirsiniz:
    </p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${resetLink}" target="_blank" 
         style="display:inline-block;background:#C62828;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;letter-spacing:0.2px;">
        🔑 Şifremi Sıfırla
      </a>
    </div>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 16px;">
      Bu bağlantı <strong>60 dakika</strong> boyunca geçerlidir.
    </p>
    <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0;">
      Eğer bu işlemi siz talep etmediyseniz, lütfen bu e-postayı dikkate almayınız.
    </p>`;

  await sendMail(to, 'Faydasıçok Vakfı — Şifre Sıfırlama Talebi', baseTemplate('Şifre Sıfırlama', content));
}
