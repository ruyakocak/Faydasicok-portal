import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { upload } from '../middleware/upload.middleware';
import { createEvent, listEvents, deleteEvent } from '../controllers/event.controller';

export const eventRouter = Router();

// Events require authentication
eventRouter.use(authenticate);

// List events
eventRouter.get('/', listEvents);

// Create event (admin only, file is optional)
eventRouter.post('/', requireAdmin, upload.single('file'), createEvent);

// Delete event (admin only)
eventRouter.delete('/:id', requireAdmin, deleteEvent);
