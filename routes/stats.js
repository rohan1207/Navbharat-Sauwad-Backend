import express from 'express';
import { trackStats, getWebsiteStats } from '../controllers/websiteStatsController.js';

const router = express.Router();

// Track stats (visits/hits)
router.post('/track', trackStats);

// Get website stats
router.get('/', getWebsiteStats);

export default router;

