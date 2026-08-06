import { Router } from 'express';
import { authenticate, requireAdminOrReviewer } from '../middleware/auth.middleware';
import { getAuditLogs } from '../controllers/audit.controller';

export const auditRouter = Router();
auditRouter.use(authenticate, requireAdminOrReviewer);
auditRouter.get('/', getAuditLogs);
