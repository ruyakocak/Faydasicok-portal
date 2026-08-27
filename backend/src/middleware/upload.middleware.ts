import multer from 'multer';
import { Request } from 'express';

const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_SIZE_BYTES = (Number(process.env.MAX_FILE_SIZE_MB) || 15) * 1024 * 1024;

export const upload = multer({
  storage: multer.memoryStorage(), // Keep in memory; StorageService handles disk write
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (_req: Request, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype) || file.originalname.match(/\.(pdf|jpe?g|png|docx?)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece PDF, Word (.doc/.docx) veya Görsel (JPG/PNG) dosyaları kabul edilmektedir.'));
    }
  },
});
