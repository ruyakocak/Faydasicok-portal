import { Router } from 'express';
import { authenticate, requireAdmin, requireAdminOrReviewer } from '../middleware/auth.middleware';
import {
  getDashboard,
  listStudents,
  createStudent,
  bulkCreateStudents,
  updateStudentProfile,
  deleteStudent,
  uploadStudentPhoto,
  getCsvTemplate,
  importStudentsFromExcel,
  getExcelTemplate,
  listPeriods,
  createPeriod,
  updatePeriod,
  updateSemester,
  deleteSemester,
  deletePeriod,
  listUsers,
  createUser,
  deleteUser,
  updateUser,
  resetStudentPassword,
  listMentors,
  createMentor,
  updateMentor,
  deleteMentor,
  assignMentor,
  getMentorStats,
  exportMentorMatches,
  exportStudentsReport,
  listDocumentTypes,
  createDocumentType,
  updateDocumentType,
  deleteDocumentType,
  initStandardDocumentTypes,
  listScholarshipCategories,
  createScholarshipCategory,
  updateScholarshipCategory,
  deleteScholarshipCategory,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  downloadDocumentsZip,
  bulkRemindStudents,
  listGraduates,
  graduateStudents,
  revertGraduation,
  exportGraduatesReport,
  deleteDocument,
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
adminRouter.patch('/students/:id', requireAdminOrReviewer, updateStudentProfile);
adminRouter.delete('/students/:id', requireAdmin, deleteStudent);
adminRouter.post('/students/:id/photo', requireAdminOrReviewer, upload.single('file'), uploadStudentPhoto);
adminRouter.post('/students/:id/reset-password', requireAdminOrReviewer, resetStudentPassword);
adminRouter.post('/students/bulk-remind', requireAdminOrReviewer, bulkRemindStudents);
adminRouter.post('/students/bulk-create', requireAdmin, multer({ storage: multer.memoryStorage() }).single('file'), bulkCreateStudents);
adminRouter.get('/students/csv-template', requireAdmin, getCsvTemplate);
adminRouter.post('/students/import-excel', requireAdmin, multer({ storage: multer.memoryStorage() }).single('file'), importStudentsFromExcel);
adminRouter.get('/students/excel-template', requireAdmin, getExcelTemplate);
adminRouter.get('/reports/students-export', requireAdminOrReviewer, exportStudentsReport);

// Graduates — admin + reviewer
adminRouter.get('/graduates', requireAdminOrReviewer, listGraduates);
adminRouter.post('/graduates/graduate', requireAdminOrReviewer, graduateStudents);
adminRouter.post('/graduates/revert', requireAdminOrReviewer, revertGraduation);
adminRouter.get('/reports/graduates-export', requireAdminOrReviewer, exportGraduatesReport);

// Periods — admin only
adminRouter.get('/periods', requireAdminOrReviewer, listPeriods);
adminRouter.post('/periods', requireAdmin, createPeriod);
adminRouter.patch('/periods/:id', requireAdmin, updatePeriod);
adminRouter.delete('/periods/:id', requireAdmin, deletePeriod);

adminRouter.patch('/semesters', requireAdmin, updateSemester);
adminRouter.post('/semesters/delete', requireAdmin, deleteSemester);

// Document Type Configs — admin only
adminRouter.get('/document-types', requireAdminOrReviewer, listDocumentTypes);
adminRouter.post('/document-types/init-standard', requireAdmin, initStandardDocumentTypes);
adminRouter.post('/document-types', requireAdmin, createDocumentType);
adminRouter.patch('/document-types/:id', requireAdmin, updateDocumentType);
adminRouter.delete('/document-types/:id', requireAdmin, deleteDocumentType);

// Users — admin only
adminRouter.get('/users', requireAdmin, listUsers);
adminRouter.post('/users', requireAdmin, createUser);
adminRouter.patch('/users/:id', requireAdmin, updateUser);
adminRouter.delete('/users/:id', requireAdmin, deleteUser);

// Mentors
adminRouter.get('/mentors', requireAdminOrReviewer, listMentors);
adminRouter.get('/mentor-stats', requireAdminOrReviewer, getMentorStats);
adminRouter.get('/mentor-matches-export', requireAdminOrReviewer, exportMentorMatches);
adminRouter.post('/mentors', requireAdmin, upload.single('file'), createMentor);
adminRouter.patch('/mentors/:id', requireAdmin, upload.single('file'), updateMentor);
adminRouter.delete('/mentors/:id', requireAdmin, deleteMentor);
adminRouter.post('/assign-mentor', requireAdminOrReviewer, assignMentor);

// Scholarship Categories
adminRouter.get('/scholarship-categories', requireAdminOrReviewer, listScholarshipCategories);
adminRouter.post('/scholarship-categories', requireAdmin, createScholarshipCategory);
adminRouter.patch('/scholarship-categories/:id', requireAdmin, updateScholarshipCategory);
adminRouter.delete('/scholarship-categories/:id', requireAdmin, deleteScholarshipCategory);

// Settings - admin only
import { getSmtpSettings, saveSmtpSettings, testSmtpSettings } from '../controllers/settings.controller';
adminRouter.get('/settings/smtp', requireAdmin, getSmtpSettings);
adminRouter.post('/settings/smtp', requireAdmin, saveSmtpSettings);
adminRouter.post('/settings/smtp/test', requireAdmin, testSmtpSettings);
// Announcements
adminRouter.get('/announcements', requireAdminOrReviewer, listAnnouncements);
adminRouter.post('/announcements', requireAdmin, createAnnouncement);
adminRouter.patch('/announcements/:id', requireAdmin, updateAnnouncement);
adminRouter.delete('/announcements/:id', requireAdmin, deleteAnnouncement);

// Documents
adminRouter.get('/documents/download-zip', requireAdminOrReviewer, downloadDocumentsZip);
adminRouter.delete('/documents/:id', requireAdmin, deleteDocument);

