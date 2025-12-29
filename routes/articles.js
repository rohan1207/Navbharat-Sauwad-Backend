import express from 'express';
import {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  bulkAction,
  incrementViews
} from '../controllers/articleController.js';

const router = express.Router();

// Public routes
router.get('/', getArticles);
router.get('/:id', getArticle);
router.post('/:id/views', incrementViews);

// Admin routes (add authentication middleware later)
router.post('/', createArticle);
router.put('/:id', updateArticle);
router.delete('/:id', deleteArticle);
router.post('/bulk', bulkAction);

export default router;

