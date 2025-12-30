import express from 'express';
import {
  getShorts,
  getAllShorts,
  getShort,
  createShort,
  updateShort,
  deleteShort,
  incrementViews
} from '../controllers/shortController.js';

const router = express.Router();

// Public routes
router.get('/', getShorts);
router.get('/:id', getShort);
router.post('/:id/views', incrementViews);

// Admin routes
router.get('/admin/all', getAllShorts);
router.post('/admin', createShort);
router.put('/admin/:id', updateShort);
router.delete('/admin/:id', deleteShort);

export default router;

