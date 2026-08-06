import nodemailer from 'nodemailer';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const isDev = !process.env.SMTP_HOST;

  if (isDev) {
    // Development: log to console
    console.log('\n📧 [EMAIL - CONSOLE LOG]');
    console.log(`To: ${options.to}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Body: ${options.html}`);
    console.log('────────────────────────\n');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Faydasıçok Vakfı" <noreply@faydasi-cok.org>',
    to: options.to,
    subject: options.subject,
    html: options.html,
  });
}

export function buildPasswordResetEmail(resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #E0221D;">Şifre Sıfırlama</h2>
      <p>Şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
      <a href="${resetLink}" style="background: #E0221D; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
        Şifremi Sıfırla
      </a>
      <p style="color: #666; margin-top: 16px;">Bu bağlantı 60 dakika geçerlidir.</p>
      <p style="color: #666;">Eğer bu isteği siz yapmadıysanız, bu e-postayı görmezden gelebilirsiniz.</p>
    </div>
  `;
}
