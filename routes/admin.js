import express from 'express';
import {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
  bulkAction
} from '../controllers/articleController.js';
import {
  getCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/categoryController.js';
import {
  getAuthors,
  getAuthor,
  createAuthor,
  updateAuthor,
  deleteAuthor
} from '../controllers/authorController.js';
import {
  getMedia,
  uploadMedia,
  uploadImage,
  deleteMedia
} from '../controllers/mediaController.js';
import {
  getSettings,
  updateSettings
} from '../controllers/settingsController.js';
import {
  getStats
} from '../controllers/statsController.js';
import { uploadSingle, uploadMultiple } from '../middleware/upload.js';

const router = express.Router();

// Stats
router.get('/stats', getStats);

// Articles
router.get('/articles', getArticles);
router.get('/articles/:id', getArticle);
router.post('/articles', createArticle);
router.put('/articles/:id', updateArticle);
router.delete('/articles/:id', deleteArticle);
router.post('/articles/bulk', bulkAction);

// Categories
router.get('/categories', getCategories);
router.get('/categories/:id', getCategory);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Authors
router.get('/authors', getAuthors);
router.get('/authors/:id', getAuthor);
router.post('/authors', createAuthor);
router.put('/authors/:id', updateAuthor);
router.delete('/authors/:id', deleteAuthor);

// Media
router.get('/media', getMedia);
router.post('/upload', uploadMultiple, uploadMedia);
router.post('/upload/image', uploadSingle, uploadImage);
router.delete('/media/:id', deleteMedia);

// Settings
router.get('/settings', getSettings);
router.put('/settings', updateSettings);

export default router;




