import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Prisma errors
  if (err.constructor.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      res.status(409).json({ error: 'Bu kayıt zaten mevcut.' });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({ error: 'Kayıt bulunamadı.' });
      return;
    }
  }

  // Log unexpected errors (but don't leak details to client)
  console.error('Unexpected error:', err);
  res.status(500).json({ error: 'Sunucu hatası oluştu.' });
}
