import { Router } from 'express';
import {
  getStudentProfile,
  updatePersonalInfo,
  updateFamilyInfo,
  updateEducationInfo,
  updateBankInfo,
  updateContactInfo,
  uploadProfilePhoto,
  getStudentDocuments,
} from '../controllers/student.controller';
import { authenticate, requireStudent, requireAdminOrReviewer } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';

export const studentRouter = Router();

studentRouter.use(authenticate);

// Student can access their own profile; admin/reviewer can access any
studentRouter.get('/:id/profile', getStudentProfile);
studentRouter.get('/:id/documents', getStudentDocuments);

// Only students can submit changes to their own profile
studentRouter.patch('/:id/contact', updateContactInfo);
studentRouter.patch('/:id/personal', updatePersonalInfo);
studentRouter.patch('/:id/family', updateFamilyInfo);
studentRouter.patch('/:id/education', updateEducationInfo);
studentRouter.patch('/:id/bank-info', updateBankInfo);
studentRouter.post('/:id/photo', upload.single('photo'), uploadProfilePhoto);
