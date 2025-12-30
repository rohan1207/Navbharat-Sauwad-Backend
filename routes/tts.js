import express from 'express';
import { getTTS } from '../controllers/ttsController.js';

const router = express.Router();

// TTS proxy endpoint
router.get('/', getTTS);

export default router;

