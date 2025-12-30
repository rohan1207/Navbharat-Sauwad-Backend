import express from 'express';
import { getMetaTags } from '../controllers/metaController.js';

const router = express.Router();

// Get meta tags for a URL path
router.get('/', getMetaTags);

export default router;

