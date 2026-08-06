import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { prisma } from './lib/prisma';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth.routes';
import { studentRouter } from './routes/student.routes';
import { documentRouter } from './routes/document.routes';
import { approvalRouter } from './routes/approval.routes';
import { adminRouter } from './routes/admin.routes';
import { auditRouter } from './routes/audit.routes';
import { eventRouter } from './routes/event.routes';

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ───────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Static files (uploaded documents) ───────────────────────────────
const uploadsDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
app.use('/uploads', express.static(uploadsDir));

// ── Routes ──────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/students', studentRouter);
app.use('/api/documents', documentRouter);
app.use('/api/approvals', approvalRouter);
app.use('/api/admin', adminRouter);
app.use('/api/audit-logs', auditRouter);
app.use('/api/events', eventRouter);

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

start();

export { app };
