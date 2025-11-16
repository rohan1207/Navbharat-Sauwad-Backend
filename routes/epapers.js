import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import mongoose from 'mongoose';
import Epaper from '../models/Epaper.js';
import { uploadEpaperPage, deleteFolder } from '../services/cloudinaryService.js';
import { convertPDFToImages, cleanupTemp } from '../services/pdfConverter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configure multer for PDF uploads
const upload = multer({
  dest: path.join(__dirname, '../temp'),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// GET /api/epapers - Get all epapers
router.get('/', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ 
        error: 'Database not connected', 
        details: 'Please wait for database connection to be established' 
      });
    }

    const epapers = await Epaper.find({ status: 'published' })
      .sort({ date: -1 })
      .select('-__v');
    res.json(epapers);
  } catch (error) {
    console.error('Error fetching epapers:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch epapers',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// GET /api/epapers/all - Get all epapers including drafts (for admin)
router.get('/all', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.error('MongoDB not connected. ReadyState:', mongoose.connection.readyState);
      return res.status(503).json({ 
        error: 'Database not connected', 
        details: 'Please wait for database connection to be established' 
      });
    }

    const epapers = await Epaper.find()
      .sort({ date: -1 })
      .select('-__v');
    res.json(epapers);
  } catch (error) {
    console.error('Error fetching all epapers:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch epapers',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// GET /api/epapers/:id - Get a specific epaper
router.get('/:id', async (req, res) => {
  try {
    const epaper = await Epaper.findOne({ id: parseInt(req.params.id) })
      .select('-__v');
    
    if (!epaper) {
      return res.status(404).json({ error: 'Epaper not found' });
    }
    
    res.json(epaper);
  } catch (error) {
    console.error('Error fetching epaper:', error);
    res.status(500).json({ error: 'Failed to fetch epaper' });
  }
});

// POST /api/epapers/upload - Upload PDF and create e-paper
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    const { title, date } = req.body;
    
    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    // Convert PDF to images
    console.log('Converting PDF to images...');
    const pages = await convertPDFToImages(req.file.path);

    // Generate e-paper ID
    const epaperId = Date.now();

    // Upload each page to Cloudinary
    console.log('Uploading pages to Cloudinary...');
    const uploadedPages = [];
    
    for (const page of pages) {
      const uploadResult = await uploadEpaperPage(
        page.imageBuffer,
        epaperId,
        page.pageNo
      );

      uploadedPages.push({
        pageNo: page.pageNo,
        image: uploadResult.imageUrl,
        thumbnail: uploadResult.thumbnailUrl,
        width: uploadResult.width,
        height: uploadResult.height,
        news: []
      });
    }

    // Create e-paper document
    const epaper = new Epaper({
      id: epaperId,
      title,
      date: new Date(date),
      status: 'published',
      pages: uploadedPages
    });

    await epaper.save();

    // Clean up temp files
    fs.unlinkSync(req.file.path);
    cleanupTemp();

    console.log(`✅ E-paper created with ID: ${epaperId}`);

    res.status(201).json(epaper);
  } catch (error) {
    console.error('Error uploading e-paper:', error);
    
    // Clean up on error
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error cleaning up file:', e);
      }
    }
    cleanupTemp();

    res.status(500).json({ 
      error: 'Failed to upload e-paper', 
      details: error.message 
    });
  }
});

// POST /api/epapers - Create e-paper (alternative endpoint)
router.post('/', async (req, res) => {
  try {
    const { id, title, date, pages, status } = req.body;

    if (!title || !date) {
      return res.status(400).json({ error: 'Title and date are required' });
    }

    const epaperId = id || Date.now();

    // Check if ID already exists
    const existing = await Epaper.findOne({ id: epaperId });
    if (existing) {
      // Update instead of create
      existing.title = title;
      existing.date = new Date(date);
      existing.pages = pages || existing.pages;
      existing.status = status || existing.status;
      existing.updatedAt = Date.now();
      
      await existing.save();
      return res.json(existing);
    }

    const epaper = new Epaper({
      id: epaperId,
      title,
      date: new Date(date),
      pages: pages || [],
      status: status || 'published'
    });

    await epaper.save();

    res.status(201).json(epaper);
  } catch (error) {
    console.error('Error creating e-paper:', error);
    res.status(500).json({ 
      error: 'Failed to create e-paper', 
      details: error.message 
    });
  }
});

// PUT /api/epapers/:id - Update e-paper (including mappings)
router.put('/:id', async (req, res) => {
  try {
    const epaperId = parseInt(req.params.id);
    console.log(`PUT /api/epapers/${epaperId} - Updating e-paper`);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Date value:', req.body.date, 'Type:', typeof req.body.date);
    console.log('Pages count:', req.body.pages?.length);
    
    // Extract only the fields we need (ignore _id, __v, etc. from MongoDB)
    const { title, date, pages, status } = req.body;

    // Validate request body
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    
    // Log for debugging
    if (pages && Array.isArray(pages)) {
      console.log(`Pages to update: ${pages.length}`);
      if (pages.length > 0) {
        console.log('First page structure:', JSON.stringify({
          pageNo: pages[0].pageNo,
          hasImage: !!pages[0].image,
          imageType: typeof pages[0].image,
          width: pages[0].width,
          widthType: typeof pages[0].width,
          height: pages[0].height,
          heightType: typeof pages[0].height,
          newsCount: pages[0].news?.length || 0,
          newsSample: pages[0].news?.[0] ? {
            id: pages[0].news[0].id,
            idType: typeof pages[0].news[0].id,
            hasTitle: !!pages[0].news[0].title,
            hasContent: !!pages[0].news[0].content,
            x: pages[0].news[0].x,
            y: pages[0].news[0].y,
            width: pages[0].news[0].width,
            height: pages[0].news[0].height
          } : null
        }, null, 2));
      }
    }

    let epaper = await Epaper.findOne({ id: epaperId });

    if (!epaper) {
      // Create if doesn't exist (upsert)
      console.log(`Creating new e-paper with ID: ${epaperId}`);
      
      // Handle date conversion
      let epaperDate;
      if (date) {
        if (date instanceof Date) {
          epaperDate = date;
        } else if (typeof date === 'string') {
          epaperDate = new Date(date);
          if (isNaN(epaperDate.getTime())) {
            console.warn('Invalid date string, using current date');
            epaperDate = new Date();
          }
        } else {
          epaperDate = new Date();
        }
      } else {
        epaperDate = new Date();
      }
      
      epaper = new Epaper({
        id: epaperId,
        title: title || 'Untitled',
        date: epaperDate,
        pages: pages || [],
        status: status || 'published'
      });
    } else {
      // Update existing
      if (title !== undefined) epaper.title = title;
      if (date !== undefined) {
        try {
          let newDate;
          if (date instanceof Date) {
            newDate = date;
          } else if (typeof date === 'string') {
            newDate = new Date(date);
          } else {
            newDate = new Date(date);
          }
          
          // Check if date is valid
          if (!isNaN(newDate.getTime())) {
            epaper.date = newDate;
          } else {
            console.warn('Invalid date provided, keeping existing date');
            // Don't update date if invalid
          }
        } catch (dateError) {
          console.warn('Date conversion error:', dateError);
          // Keep existing date
        }
      }
      if (pages !== undefined) {
        // Ensure pages array is valid
        if (Array.isArray(pages)) {
          // Clean and validate each page
          const cleanedPages = pages.map(page => {
            if (!page) return null;
            
            // Ensure required fields exist
            const cleanedPage = {
              pageNo: typeof page.pageNo === 'number' ? page.pageNo : parseInt(page.pageNo) || 1,
              image: page.image || page.imageUrl || '',
              thumbnail: page.thumbnail || page.thumbnailUrl || null,
              width: typeof page.width === 'number' ? page.width : parseInt(page.width) || 0,
              height: typeof page.height === 'number' ? page.height : parseInt(page.height) || 0,
              news: Array.isArray(page.news) ? page.news.map((newsItem, idx) => {
                // Ensure all required fields exist with proper types
                const cleanedNews = {
                  id: typeof newsItem.id === 'number' ? newsItem.id : (newsItem.id ? parseInt(newsItem.id) : Date.now() + idx),
                  x: typeof newsItem.x === 'number' ? newsItem.x : (newsItem.x ? parseFloat(newsItem.x) : 0),
                  y: typeof newsItem.y === 'number' ? newsItem.y : (newsItem.y ? parseFloat(newsItem.y) : 0),
                  width: typeof newsItem.width === 'number' ? newsItem.width : (newsItem.width ? parseFloat(newsItem.width) : 0),
                  height: typeof newsItem.height === 'number' ? newsItem.height : (newsItem.height ? parseFloat(newsItem.height) : 0),
                  title: newsItem.title ? String(newsItem.title) : 'Untitled',
                  content: newsItem.content ? String(newsItem.content) : '',
                  articleId: newsItem.articleId || null
                };
                
                // Validate required fields
                if (!cleanedNews.title || cleanedNews.title.trim() === '') {
                  console.warn(`News item ${idx} missing title, using default`);
                  cleanedNews.title = 'Untitled';
                }
                
                return cleanedNews;
              }).filter(news => news !== null) : []
            };
            
            // Validate required fields
            if (!cleanedPage.image || cleanedPage.width <= 0 || cleanedPage.height <= 0) {
              console.warn('Invalid page structure:', cleanedPage);
              return null;
            }
            
            return cleanedPage;
          }).filter(page => page !== null);
          
          if (cleanedPages.length > 0) {
            epaper.pages = cleanedPages;
          } else {
            console.warn('No valid pages after cleaning, keeping existing pages');
          }
        } else {
          console.warn('Pages is not an array, keeping existing pages');
        }
      }
      if (status !== undefined) {
        // Validate status enum
        if (['draft', 'published', 'archived'].includes(status)) {
          epaper.status = status;
        } else {
          console.warn(`Invalid status: ${status}, keeping existing status`);
        }
      }
      epaper.updatedAt = new Date();
    }

    // Log epaper structure before validation
    console.log('Epaper structure before save:', {
      id: epaper.id,
      title: epaper.title,
      date: epaper.date,
      status: epaper.status,
      pagesCount: epaper.pages?.length || 0,
      firstPage: epaper.pages?.[0] ? {
        pageNo: epaper.pages[0].pageNo,
        hasImage: !!epaper.pages[0].image,
        width: epaper.pages[0].width,
        height: epaper.pages[0].height,
        newsCount: epaper.pages[0].news?.length || 0
      } : null
    });

    // Validate before saving
    try {
      const validationError = epaper.validateSync();
      if (validationError) {
        console.error('❌ Validation error detected:');
        console.error('Error message:', validationError.message);
        console.error('Error name:', validationError.name);
        console.error('Validation errors:', JSON.stringify(validationError.errors, null, 2));
        
        const errorDetails = {};
        Object.keys(validationError.errors).forEach(key => {
          errorDetails[key] = {
            message: validationError.errors[key].message,
            kind: validationError.errors[key].kind,
            path: validationError.errors[key].path,
            value: validationError.errors[key].value
          };
        });
        
        console.error('Formatted errors:', JSON.stringify(errorDetails, null, 2));
        
        return res.status(400).json({ 
          error: 'Validation failed', 
          details: validationError.message,
          errors: Object.keys(validationError.errors).reduce((acc, key) => {
            acc[key] = validationError.errors[key].message;
            return acc;
          }, {})
        });
      } else {
        console.log('✅ Pre-save validation passed');
      }
    } catch (validationErr) {
      console.error('Validation check error:', validationErr);
      console.error('Validation check stack:', validationErr.stack);
      // Continue anyway - let save() handle it
    }

    // Save with better error handling
    try {
      await epaper.save();
      console.log(`✅ E-paper ${epaperId} updated successfully`);
      res.json(epaper);
    } catch (saveError) {
      // Handle validation errors specifically
      if (saveError.name === 'ValidationError') {
        console.error('Validation error on save:', saveError);
        const validationErrors = {};
        if (saveError.errors) {
          Object.keys(saveError.errors).forEach(key => {
            validationErrors[key] = saveError.errors[key].message;
          });
        }
        return res.status(400).json({
          error: 'Validation failed',
          details: saveError.message,
          errors: validationErrors
        });
      }
      throw saveError; // Re-throw if not validation error
    }
  } catch (error) {
    console.error('Error updating e-paper:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Error errors:', JSON.stringify(error.errors, null, 2));
    }
    res.status(500).json({ 
      error: 'Failed to update e-paper', 
      details: error.message,
      errorName: error.name,
      ...(error.errors && { validationErrors: Object.keys(error.errors).reduce((acc, key) => {
        acc[key] = error.errors[key].message;
        return acc;
      }, {}) }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// DELETE /api/epapers/:id - Delete e-paper
router.delete('/:id', async (req, res) => {
  try {
    const epaperId = parseInt(req.params.id);
    
    const epaper = await Epaper.findOne({ id: epaperId });
    
    if (!epaper) {
      return res.status(404).json({ error: 'Epaper not found' });
    }

    // Delete images from Cloudinary
    try {
      await deleteFolder(`epapers/${epaperId}/pages`);
    } catch (error) {
      console.error('Error deleting Cloudinary images:', error);
      // Continue with deletion even if Cloudinary delete fails
    }

    // Delete from database
    await Epaper.deleteOne({ id: epaperId });

    console.log(`✅ E-paper ${epaperId} deleted`);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting e-paper:', error);
    res.status(500).json({ error: 'Failed to delete e-paper' });
  }
});

export default router;

