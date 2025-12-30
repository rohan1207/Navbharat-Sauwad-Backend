import express from 'express';
import { getTTS } from '../controllers/ttsController.js';

const router = express.Router();

// Handle OPTIONS for CORS preflight
router.options('/', (req, res) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.sendStatus(200);
});

// TTS proxy endpoint
router.get('/', getTTS);

export default router;

