import { Router } from 'express';
import { authenticate, requireAdminOrReviewer } from '../middleware/auth.middleware';
import {
  getApprovalQueue,
  approveChange,
  rejectChange,
  bulkApprove,
  bulkReject,
} from '../controllers/approval.controller';

export const approvalRouter = Router();
approvalRouter.use(authenticate, requireAdminOrReviewer);

approvalRouter.get('/queue', getApprovalQueue);
approvalRouter.post('/:id/approve', approveChange);
approvalRouter.post('/:id/reject', rejectChange);
approvalRouter.post('/bulk-approve', bulkApprove);
approvalRouter.post('/bulk-reject', bulkReject);
