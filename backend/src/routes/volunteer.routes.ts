import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import {
  submitVolunteerForm,
  getMyVolunteerForms,
  adminListVolunteerForms,
  adminGetVolunteerForm,
  adminUpdateVolunteerForm,
  adminDeleteVolunteerForm,
  adminExportVolunteerFormsExcel,
} from '../controllers/volunteer.controller';
import { getVolunteerFormSchema, saveVolunteerFormSchema } from '../controllers/settings.controller';

export const volunteerRouter = Router();
volunteerRouter.use(authenticate);

// ── Settings routes (Public GET, Admin PUT) ─────────────────────────
volunteerRouter.get('/settings/schema', getVolunteerFormSchema);
volunteerRouter.put('/settings/schema', saveVolunteerFormSchema);

// ── Student routes ──────────────────────────────────────────────────
// Submit volunteer form with dynamic files
volunteerRouter.post(
  '/',
  upload.any(),
  submitVolunteerForm,
);

// Get my submitted forms
volunteerRouter.get('/my', getMyVolunteerForms);

// ── Admin routes ────────────────────────────────────────────────────
volunteerRouter.get('/export/excel', adminExportVolunteerFormsExcel);
volunteerRouter.get('/', adminListVolunteerForms);
volunteerRouter.get('/:id', adminGetVolunteerForm);
volunteerRouter.patch('/:id', adminUpdateVolunteerForm);
volunteerRouter.delete('/:id', adminDeleteVolunteerForm);
