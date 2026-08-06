import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../lib/jwt';
import { Role } from '../types/enums';

// Extend express Request with user info
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// ── Authenticate middleware ──────────────────────────────────────────
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Yetkilendirme başlığı eksik veya geçersiz.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Oturum süresi dolmuş veya geçersiz token.' });
  }
}

// ── Role authorization middleware ────────────────────────────────────
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Kimlik doğrulaması gerekli.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Bu işlem için yetkiniz yok.' });
      return;
    }
    next();
  };
}

// ── Shorthand role checks ────────────────────────────────────────────
export const requireAdmin = authorize(Role.ADMIN);
export const requireAdminOrReviewer = authorize(Role.ADMIN, Role.REVIEWER);
export const requireStudent = authorize(Role.STUDENT);
export const requireAny = authenticate; // Just needs to be logged in
