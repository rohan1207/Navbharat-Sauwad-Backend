import express from 'express';
import {
  createSubscriber,
  getSubscribers,
  unsubscribe
} from '../controllers/subscriberController.js';

const router = express.Router();

// Public route - create subscriber
router.post('/', createSubscriber);

// Admin routes (can be protected later with auth middleware)
router.get('/', getSubscribers);
router.post('/unsubscribe', unsubscribe);

export default router;

