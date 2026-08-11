import { Router } from 'express';
import { authenticate, requireAdmin, requireAdminOrReviewer } from '../middleware/auth.middleware';
import {
  getDashboard,
  listStudents,
  createStudent,
  bulkCreateStudents,
  getCsvTemplate,
  listPeriods,
  createPeriod,
  updatePeriod,
  listUsers,
  createUser,
  deleteUser,
  resetStudentPassword,
  listMentors,
  assignMentor,
  exportStudentsReport,
  listDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
} from '../controllers/admin.controller';
import { upload } from '../middleware/upload.middleware';
import multer from 'multer';

export const adminRouter = Router();
adminRouter.use(authenticate);

// Dashboard — admin + reviewer
adminRouter.get('/dashboard', requireAdminOrReviewer, getDashboard);

// Students — admin + reviewer can list; only admin can create
adminRouter.get('/students', requireAdminOrReviewer, listStudents);
adminRouter.post('/students', requireAdmin, createStudent);
adminRouter.post('/students/:id/reset-password', requireAdminOrReviewer, resetStudentPassword);
adminRouter.post('/students/bulk-create', requireAdmin, multer({ storage: multer.memoryStorage() }).single('file'), bulkCreateStudents);
adminRouter.get('/students/csv-template', requireAdmin, getCsvTemplate);
adminRouter.get('/reports/students-export', requireAdminOrReviewer, exportStudentsReport);

// Periods — admin only
adminRouter.get('/periods', requireAdminOrReviewer, listPeriods);
adminRouter.post('/periods', requireAdmin, createPeriod);
adminRouter.patch('/periods/:id', requireAdmin, updatePeriod);

// Document Type Configs — admin only
adminRouter.get('/document-types', requireAdminOrReviewer, listDocumentTypes);
adminRouter.post('/document-types', requireAdmin, createDocumentType);
adminRouter.patch('/document-types/:id', requireAdmin, updateDocumentType);
adminRouter.delete('/document-types/:id', requireAdmin, deleteDocumentType);

// Users — admin only
adminRouter.get('/users', requireAdmin, listUsers);
adminRouter.post('/users', requireAdmin, createUser);
adminRouter.delete('/users/:id', requireAdmin, deleteUser);

// Mentors
adminRouter.get('/mentors', requireAdmin, listMentors);
adminRouter.post('/assign-mentor', requireAdmin, assignMentor);
