import express from 'express';
import {
  getTodayPhoto,
  getAllPhotos,
  createPhoto,
  updatePhoto,
  deletePhoto,
  incrementViews,
  uploadMiddleware
} from '../controllers/photoOfTheDayController.js';

const router = express.Router();

// Public routes
router.get('/today', getTodayPhoto);
router.post('/:id/views', incrementViews);

// Admin routes
router.get('/', getAllPhotos);
router.post('/', uploadMiddleware, createPhoto);
router.put('/:id', uploadMiddleware, updatePhoto);
router.delete('/:id', deletePhoto);

export default router;

