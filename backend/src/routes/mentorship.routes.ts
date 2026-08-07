import { Router } from 'express';
import { getProfile, getNotes, createNote } from '../controllers/mentorship.controller';
import { authenticate } from '../middleware/auth.middleware';
import { Role } from '../types/enums';

const router = Router();

// Bütün mentorship rotaları için giriş yapmış olmak zorunlu
router.use(authenticate);

router.get('/profile', getProfile);
router.get('/notes', getNotes);
router.post('/notes', createNote);

export { router as mentorshipRouter };
