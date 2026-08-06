import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export interface StoredFile {
  filePath: string;  // Relative path stored in DB
  originalFileName: string;
  mimeType: string;
  fileSize: number;
}

// ── Storage Service Interface ────────────────────────────────────────
// Swap the adapter below to switch from local to S3-compatible storage.
export interface StorageAdapter {
  save(buffer: Buffer, filename: string, mimeType: string): Promise<StoredFile>;
  delete(filePath: string): Promise<void>;
  getPublicUrl(filePath: string): string;
}

// ── Local File Adapter ───────────────────────────────────────────────
export class LocalStorageAdapter implements StorageAdapter {
  private uploadsDir: string;

  constructor() {
    this.uploadsDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  async save(buffer: Buffer, originalName: string, mimeType: string): Promise<StoredFile> {
    const ext = path.extname(originalName).toLowerCase();
    const safeOriginalName = path.basename(originalName).replace(/[^a-z0-9.\-_]/gi, '_');
    const uniqueFilename = `${uuidv4()}${ext}`;
    const fullPath = path.join(this.uploadsDir, uniqueFilename);

    fs.writeFileSync(fullPath, buffer);

    return {
      filePath: `uploads/${uniqueFilename}`,
      originalFileName: safeOriginalName,
      mimeType,
      fileSize: buffer.length,
    };
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.resolve(filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }
  }

  getPublicUrl(filePath: string): string {
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3001}`;
    return `${baseUrl}/${filePath}`;
  }
}

// Singleton storage service
export const storageService = new LocalStorageAdapter();
