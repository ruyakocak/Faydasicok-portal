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
} from '../controllers/volunteer.controller';

export const volunteerRouter = Router();
volunteerRouter.use(authenticate);

// ── Student routes ──────────────────────────────────────────────────
// Submit volunteer form with up to 3 file uploads
volunteerRouter.post(
  '/',
  upload.fields([
    { name: 'document1', maxCount: 1 },
    { name: 'document2', maxCount: 1 },
    { name: 'document3', maxCount: 1 },
  ]),
  submitVolunteerForm,
);

// Get my submitted forms
volunteerRouter.get('/my', getMyVolunteerForms);

// ── Admin routes ────────────────────────────────────────────────────
volunteerRouter.get('/', adminListVolunteerForms);
volunteerRouter.get('/:id', adminGetVolunteerForm);
volunteerRouter.patch('/:id', adminUpdateVolunteerForm);
volunteerRouter.delete('/:id', adminDeleteVolunteerForm);
