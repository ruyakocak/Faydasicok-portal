import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import { AppError } from '../middleware/errorHandler';
import { sendEmail, buildPasswordResetEmail } from '../lib/email';
import { AuditAction } from '../types/enums';

const BCRYPT_ROUNDS = 12;

// ── Login ────────────────────────────────────────────────────────────
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      throw new AppError(400, 'Kullanıcı adı ve şifre zorunludur.');
    }

    // Find user by TC, email, or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { tcKimlikNo: identifier },
          { email: identifier },
          { username: identifier },
        ],
        isActive: true,
      },
      include: { studentProfile: { select: { id: true } } },
    });

    if (!user) {
      throw new AppError(401, 'Kullanıcı adı veya şifre hatalı.');
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      throw new AppError(401, 'Kullanıcı adı veya şifre hatalı.');
    }

    const payload = {
      userId: user.id,
      role: user.role,
      profileId: user.studentProfile?.id,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Store refresh token
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: AuditAction.LOGIN,
        module: 'Auth',
        ipAddress: req.ip,
      },
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        role: user.role,
        profileId: user.studentProfile?.id,
        tcKimlikNo: user.tcKimlikNo,
        email: user.email,
        username: user.username,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── Refresh Token ────────────────────────────────────────────────────
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (!token) throw new AppError(400, 'Refresh token gerekli.');

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: { include: { studentProfile: { select: { id: true } } } } },
    });

    if (!storedToken || storedToken.expiresAt < new Date()) {
      throw new AppError(401, 'Geçersiz veya süresi dolmuş refresh token.');
    }

    // Verify the token signature
    verifyRefreshToken(token);

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token } });

    const payload = {
      userId: storedToken.user.id,
      role: storedToken.user.role,
      profileId: storedToken.user.studentProfile?.id,
    };

    const newAccessToken = signAccessToken(payload);
    const newRefreshToken = signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: storedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
}

// ── Logout ───────────────────────────────────────────────────────────
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } });
    }

    if (req.user) {
      await prisma.auditLog.create({
        data: {
          userId: req.user.userId,
          action: AuditAction.LOGOUT,
          module: 'Auth',
        },
      });
    }

    res.json({ message: 'Çıkış yapıldı.' });
  } catch (err) {
    next(err);
  }
}

// ── Forgot Password ──────────────────────────────────────────────────
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email } = req.body;
    if (!email) throw new AppError(400, 'E-posta adresi gerekli.');

    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond with success to prevent email enumeration
    if (user) {
      const token = uuidv4();
      const expiresAt = new Date(Date.now() + (Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES) || 60) * 60 * 1000);

      await prisma.passwordReset.create({
        data: { token, userId: user.id, expiresAt },
      });

      const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
      await sendEmail({
        to: email,
        subject: 'Faydasıçok Vakfı — Şifre Sıfırlama',
        html: buildPasswordResetEmail(resetLink),
      });
    }

    res.json({ message: 'Eğer bu e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderildi.' });
  } catch (err) {
    next(err);
  }
}

// ── Reset Password ───────────────────────────────────────────────────
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      throw new AppError(400, 'Şifre en az 6 karakter olmalıdır.');
    }

    const resetRecord = await prisma.passwordReset.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetRecord || resetRecord.used || resetRecord.expiresAt < new Date()) {
      throw new AppError(400, 'Geçersiz veya süresi dolmuş sıfırlama bağlantısı.');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    await prisma.$transaction([
      prisma.user.update({ where: { id: resetRecord.userId }, data: { passwordHash } }),
      prisma.passwordReset.update({ where: { token }, data: { used: true } }),
      prisma.refreshToken.deleteMany({ where: { userId: resetRecord.userId } }), // Invalidate all sessions
    ]);

    res.json({ message: 'Şifreniz başarıyla güncellendi.' });
  } catch (err) {
    next(err);
  }
}

// ── Change Password (authenticated) ─────────────────────────────────
export async function changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw new AppError(400, 'Mevcut ve yeni şifre zorunludur.');
    if (newPassword.length < 6) throw new AppError(400, 'Yeni şifre en az 6 karakter olmalıdır.');

    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) throw new AppError(404, 'Kullanıcı bulunamadı.');

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) throw new AppError(401, 'Mevcut şifre hatalı.');

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

    // Invalidate all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    res.json({ message: 'Şifreniz başarıyla güncellendi.' });
  } catch (err) {
    next(err);
  }
}
