import express from 'express';
import {
  createSubscriber,
  getSubscribers,
  checkSubscriber,
  unsubscribe
} from '../controllers/subscriberController.js';

const router = express.Router();

// Public routes
router.post('/', createSubscriber);
router.post('/check', checkSubscriber);

// Admin routes (can be protected later with auth middleware)
router.get('/', getSubscribers);
router.post('/unsubscribe', unsubscribe);

export default router;

