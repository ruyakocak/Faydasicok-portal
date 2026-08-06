import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  uploadStaticDocument,
  uploadTranscript,
  uploadStudentCertificate,
  uploadVolunteerReport,
  getActivePeriods,
} from '../controllers/document.controller';

export const documentRouter = Router();
documentRouter.use(authenticate);

documentRouter.get('/periods', getActivePeriods);
documentRouter.post('/static', upload.single('file'), uploadStaticDocument);
documentRouter.post('/transcript', upload.single('file'), uploadTranscript);
documentRouter.post('/student-certificate', upload.single('file'), uploadStudentCertificate);
documentRouter.post('/volunteer-report', upload.single('file'), uploadVolunteerReport);
