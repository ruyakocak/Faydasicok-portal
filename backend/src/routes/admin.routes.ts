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
  createMentor,
  deleteMentor,
  assignMentor,
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

// Periods — admin only
adminRouter.get('/periods', requireAdminOrReviewer, listPeriods);
adminRouter.post('/periods', requireAdmin, createPeriod);
adminRouter.patch('/periods/:id', requireAdmin, updatePeriod);

// Users — admin only
adminRouter.get('/users', requireAdmin, listUsers);
adminRouter.post('/users', requireAdmin, createUser);
adminRouter.delete('/users/:id', requireAdmin, deleteUser);

// Mentors
adminRouter.get('/mentors', requireAdminOrReviewer, listMentors);
adminRouter.post('/mentors', requireAdmin, upload.single('file'), createMentor);
adminRouter.delete('/mentors/:id', requireAdmin, deleteMentor);
adminRouter.post('/assign-mentor', requireAdminOrReviewer, assignMentor);
