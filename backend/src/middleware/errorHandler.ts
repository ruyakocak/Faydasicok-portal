import { Request, Response, NextFunction } from 'express';

import { logger } from '../lib/logger';

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
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Multer errors
  if (err.name === 'MulterError' || err.code === 'LIMIT_FILE_SIZE') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'Dosya boyutu en fazla 10MB olabilir.' });
      return;
    }
    res.status(400).json({ error: err.message || 'Dosya yükleme hatası.' });
    return;
  }

  // Multer custom fileFilter errors
  if (err.message && (err.message.includes('PDF') || err.message.includes('dosya') || err.message.includes('Dosya'))) {
    res.status(400).json({ error: err.message });
    return;
  }

  // Prisma errors
  if (err.constructor?.name === 'PrismaClientKnownRequestError') {
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

  // Log unexpected errors
  logger.error(`Unexpected error: ${err.message}`, { stack: err.stack, err });
  res.status(500).json({ error: err.message || 'Sunucu hatası oluştu.' });
}
