import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import mongoose from 'mongoose';
import sharp from 'sharp';
import Epaper from '../models/Epaper.js';
import { uploadEpaperPage, deleteFolder, getOptimizedUrl, getCroppedUrl } from '../services/cloudinaryService.js';
import { convertPDFToImages, cleanupTemp } from '../services/pdfConverter.js';
import { generateEpaperMetaHtml } from '../utils/metaHtmlGenerator.js';

const BASE_URL = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';

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

// Configure multer for image uploads (for individual page uploads)
const uploadImage = multer({
  dest: path.join(__dirname, '../temp'),
  limits: {
    fileSize: 20 * 1024 * 1024 // 20MB limit for images
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
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
      .select('-__v')
      .lean();
    
    // Sort pages by sortOrder for each epaper
    epapers.forEach(epaper => {
      if (epaper.pages && Array.isArray(epaper.pages)) {
        epaper.pages.sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? a.sortOrder : a.pageNo;
          const orderB = b.sortOrder !== undefined ? b.sortOrder : b.pageNo;
          return orderA - orderB;
        });
      }
    });
    
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
      .select('-__v')
      .lean();
    
    // Sort pages by sortOrder for each epaper
    epapers.forEach(epaper => {
      if (epaper.pages && Array.isArray(epaper.pages)) {
        epaper.pages.sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? a.sortOrder : a.pageNo;
          const orderB = b.sortOrder !== undefined ? b.sortOrder : b.pageNo;
          return orderA - orderB;
        });
      }
    });
    
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

// GET /api/epapers/:id - Get a specific epaper (supports both slug and ID)
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Try to find by slug first, then by ID
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('-__v').lean();
    } else if (!isNaN(id)) {
      // It's a number ID
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('-__v').lean();
    } else {
      // It's likely a slug
      epaper = await Epaper.findOne({ slug: id }).select('-__v').lean();
    }
    
    if (!epaper) {
      return res.status(404).json({ error: 'Epaper not found' });
    }
    
    // Sort pages by sortOrder
    if (epaper.pages && Array.isArray(epaper.pages)) {
      epaper.pages.sort((a, b) => {
        const orderA = a.sortOrder !== undefined ? a.sortOrder : a.pageNo;
        const orderB = b.sortOrder !== undefined ? b.sortOrder : b.pageNo;
        return orderA - orderB;
      });
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
        publicId: uploadResult.publicId,
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
      pages: uploadedPages,
      // Use an optimized 600x800 front-page image as default share image
      shareImageUrl: uploadedPages[0]?.publicId
        ? getOptimizedUrl(uploadedPages[0].publicId, {
            width: 600,
            height: 800,
            crop: 'fill',
            quality: 60,
            fetch_format: 'jpg'
          })
        : (uploadedPages[0]?.thumbnail || uploadedPages[0]?.image || '')
    });

    await epaper.save();

    // Clean up temp files
    fs.unlinkSync(req.file.path);
    cleanupTemp();

    console.log(`✅ E-paper created with ID: ${epaperId}`);

    // Generate metaHtml asynchronously (non-blocking, doesn't add latency)
    generateEpaperMetaHtml(epaper.toObject(), BASE_URL)
      .then(metaHtml => {
        Epaper.findByIdAndUpdate(epaper._id, { metaHtml })
          .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
      })
      .catch(err => console.error('Error generating metaHtml (non-critical):', err.message));

    res.status(201).json(epaper);
  } catch (error) {
    console.error('Error uploading e-paper:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up on error
    if (req.file && req.file.path) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.error('Error cleaning up file:', e);
      }
    }
    cleanupTemp();

    res.status(500).json({ 
      error: 'Failed to upload e-paper', 
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// POST /api/epapers/upload-page - Upload individual page image
router.post('/upload-page', uploadImage.single('image'), async (req, res) => {
  const startTime = Date.now();
  const requestId = Date.now().toString().slice(-6);
  
  try {
    console.log(`\n[${requestId}] 📥 Received upload request for page`);
    
    if (!req.file) {
      console.error(`[${requestId}] ❌ No file uploaded`);
      return res.status(400).json({ error: 'No image file uploaded' });
    }

    const { epaperId, pageNo, sortOrder, title, date } = req.body;
    const fileSizeMB = (req.file.size / (1024 * 1024)).toFixed(2);
    
    console.log(`[${requestId}] 📊 Request details:`);
    console.log(`   E-paper ID: ${epaperId}`);
    console.log(`   Page No: ${pageNo}`);
    console.log(`   Sort Order: ${sortOrder || pageNo}`);
    console.log(`   File: ${req.file.originalname || req.file.filename}`);
    console.log(`   File size: ${fileSizeMB} MB`);
    console.log(`   Temp path: ${req.file.path}`);
    
    if (!epaperId || !pageNo) {
      console.error(`[${requestId}] ❌ Missing epaperId or pageNo`);
      return res.status(400).json({ error: 'epaperId and pageNo are required' });
    }

    // Step 1: Read image file
    console.log(`[${requestId}] 📖 Step 1: Reading image file...`);
    const readStartTime = Date.now();
    const imageBuffer = fs.readFileSync(req.file.path);
    const readTime = ((Date.now() - readStartTime) / 1000).toFixed(2);
    console.log(`[${requestId}] ✅ File read in ${readTime}s (${(imageBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    
    // Step 2: Get image dimensions using sharp
    console.log(`[${requestId}] 📐 Step 2: Getting image metadata...`);
    const metadataStartTime = Date.now();
    const metadata = await sharp(imageBuffer).metadata();
    const metadataTime = ((Date.now() - metadataStartTime) / 1000).toFixed(2);
    console.log(`[${requestId}] ✅ Metadata extracted in ${metadataTime}s`);
    console.log(`   Dimensions: ${metadata.width}x${metadata.height}`);
    console.log(`   Format: ${metadata.format}`);

    // Step 3: Upload to Cloudinary
    console.log(`[${requestId}] ☁️  Step 3: Uploading to Cloudinary...`);
    const cloudinaryStartTime = Date.now();
    const uploadResult = await uploadEpaperPage(
      imageBuffer,
      parseInt(epaperId),
      parseInt(pageNo)
    );
    const cloudinaryTime = ((Date.now() - cloudinaryStartTime) / 1000).toFixed(2);
    console.log(`[${requestId}] ✅ Cloudinary upload completed in ${cloudinaryTime}s`);
    console.log(`   Image URL: ${uploadResult.imageUrl.substring(0, 50)}...`);

    // Step 4: Find or create e-paper
    console.log(`[${requestId}] 💾 Step 4: Finding/creating e-paper in database...`);
    const dbStartTime = Date.now();
    let epaper = await Epaper.findOne({ id: parseInt(epaperId) });
    
    if (!epaper) {
      console.log(`[${requestId}] 📄 Creating new e-paper...`);
      if (!title || !date) {
        console.error(`[${requestId}] ❌ Title and date required for new e-paper`);
        return res.status(400).json({ error: 'Title and date are required for new e-paper' });
      }
      
      epaper = new Epaper({
        id: parseInt(epaperId),
        title,
        date: new Date(date),
        status: 'published',
        pages: []
      });
      console.log(`[${requestId}] ✅ New e-paper created`);
    } else {
      console.log(`[${requestId}] ✅ Found existing e-paper with ${epaper.pages.length} pages`);
    }

    // Step 5: Add or update page
    console.log(`[${requestId}] 📄 Step 5: Adding/updating page...`);
    const pageSortOrder = sortOrder ? parseInt(sortOrder) : parseInt(pageNo);
    const pageIndex = epaper.pages.findIndex(p => p.pageNo === parseInt(pageNo));
    const newPage = {
      pageNo: parseInt(pageNo),
      sortOrder: pageSortOrder, // Store sortOrder
      image: uploadResult.imageUrl,
      thumbnail: uploadResult.thumbnailUrl,
      publicId: uploadResult.publicId, // Store publicId for share image generation
      width: metadata.width,
      height: metadata.height,
      news: []
    };

    if (pageIndex >= 0) {
      console.log(`[${requestId}] 🔄 Updating existing page ${pageNo} with sortOrder ${pageSortOrder}`);
      epaper.pages[pageIndex] = newPage;
    } else {
      console.log(`[${requestId}] ➕ Adding new page ${pageNo} with sortOrder ${pageSortOrder}`);
      epaper.pages.push(newPage);
    }
    
    // Sort pages by sortOrder (fallback to pageNo if sortOrder not available)
    epaper.pages.sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : a.pageNo;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : b.pageNo;
      return orderA - orderB;
    });

    // Set shareImageUrl for epaper if this is the first page (pageNo === 1) and shareImageUrl is not set
    // OR if shareImageUrl is missing (for any page upload, ensure it's set from first page)
    if ((parseInt(pageNo) === 1 || !epaper.shareImageUrl || epaper.shareImageUrl.trim() === '') && 
        (!epaper.shareImageUrl || epaper.shareImageUrl.trim() === '')) {
      // Find the first page (by pageNo, not array index)
      const firstPage = epaper.pages.find(p => p.pageNo === 1) || epaper.pages[0];
      if (firstPage) {
        console.log(`[${requestId}] 🖼️  Setting shareImageUrl for epaper using page ${firstPage.pageNo}`);
        if (firstPage.publicId) {
          epaper.shareImageUrl = getOptimizedUrl(firstPage.publicId, {
            width: 600,
            height: 800,
            crop: 'fill',
            quality: 60,
            fetch_format: 'jpg'
          });
          console.log(`[${requestId}] ✅ shareImageUrl set from publicId: ${epaper.shareImageUrl.substring(0, 80)}...`);
        } else if (uploadResult.publicId && parseInt(pageNo) === 1) {
          // If this is page 1 and we have publicId, use it
          epaper.shareImageUrl = getOptimizedUrl(uploadResult.publicId, {
            width: 600,
            height: 800,
            crop: 'fill',
            quality: 60,
            fetch_format: 'jpg'
          });
          console.log(`[${requestId}] ✅ shareImageUrl set from current upload: ${epaper.shareImageUrl.substring(0, 80)}...`);
        } else {
          // Fallback to thumbnail or image URL
          epaper.shareImageUrl = firstPage.thumbnail || firstPage.image || uploadResult.thumbnailUrl || uploadResult.imageUrl || '';
          console.log(`[${requestId}] ⚠️  Using fallback shareImageUrl: ${epaper.shareImageUrl ? epaper.shareImageUrl.substring(0, 80) + '...' : 'empty'}`);
        }
      }
    }

    // Step 6: Save to database
    console.log(`[${requestId}] 💾 Step 6: Saving to database...`);
    const saveStartTime = Date.now();
    await epaper.save();
    const saveTime = ((Date.now() - saveStartTime) / 1000).toFixed(2);
    console.log(`[${requestId}] ✅ Database save completed in ${saveTime}s`);
    
    // Generate metaHtml asynchronously (non-blocking, doesn't add latency)
    generateEpaperMetaHtml(epaper.toObject(), BASE_URL)
      .then(metaHtml => {
        Epaper.findByIdAndUpdate(epaper._id, { metaHtml })
          .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
      })
      .catch(err => console.error('Error generating metaHtml (non-critical):', err.message));

    // Step 7: Clean up temp file
    console.log(`[${requestId}] 🧹 Step 7: Cleaning up temp file...`);
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
      console.log(`[${requestId}] ✅ Temp file deleted`);
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${requestId}] 🎉 Upload completed successfully in ${totalTime}s`);
    console.log(`   Breakdown: Read(${readTime}s) + Metadata(${metadataTime}s) + Cloudinary(${cloudinaryTime}s) + DB(${saveTime}s)`);

    res.status(201).json({
      success: true,
      page: newPage,
      epaper: epaper
    });
  } catch (error) {
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`\n[${requestId}] ❌ Upload failed after ${totalTime}s`);
    console.error(`[${requestId}] Error:`, error.message);
    console.error(`[${requestId}] Stack:`, error.stack);
    
    // Clean up on error
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log(`[${requestId}] 🧹 Temp file cleaned up after error`);
      } catch (e) {
        console.error(`[${requestId}] ❌ Error cleaning up file:`, e);
      }
    }

    res.status(500).json({ 
      error: 'Failed to upload page', 
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
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
      
      // Generate metaHtml asynchronously (non-blocking)
      generateEpaperMetaHtml(existing.toObject(), BASE_URL)
        .then(metaHtml => {
          Epaper.findByIdAndUpdate(existing._id, { metaHtml })
            .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
        })
        .catch(err => console.error('Error generating metaHtml (non-critical):', err.message));
      
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

    // Generate metaHtml asynchronously (non-blocking, doesn't add latency)
    generateEpaperMetaHtml(epaper.toObject(), BASE_URL)
      .then(metaHtml => {
        Epaper.findByIdAndUpdate(epaper._id, { metaHtml })
          .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
      })
      .catch(err => console.error('Error generating metaHtml (non-critical):', err.message));

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
                  articleId: newsItem.articleId || null,
                  // Pre-generate / normalize share image URL for mapped sections
                  shareImageUrl: (() => {
                    try {
                      // If a pre-existing shareImageUrl is provided, keep it
                      if (newsItem.shareImageUrl && String(newsItem.shareImageUrl).trim() !== '') {
                        return String(newsItem.shareImageUrl).trim();
                      }
                      // If we have coordinates and a publicId for the page, generate a cropped share URL
                      if ((page.publicId || page.imagePublicId) && newsItem.width && newsItem.height) {
                        const pubId = page.publicId || page.imagePublicId;
                        return getCroppedUrl(
                          pubId,
                          newsItem.x || 0,
                          newsItem.y || 0,
                          newsItem.width || 0,
                          newsItem.height || 0
                        );
                      }
                      return '';
                    } catch (e) {
                      console.warn('Error generating section shareImageUrl:', e.message);
                      return '';
                    }
                  })()
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

    // Ensure shareImageUrl is set if missing (fallback for epapers created before this logic)
    if (!epaper.shareImageUrl || epaper.shareImageUrl.trim() === '') {
      console.log('⚠️  shareImageUrl missing, generating from first page...');
      const firstPage = epaper.pages?.find(p => p.pageNo === 1) || epaper.pages?.[0];
      if (firstPage) {
        if (firstPage.publicId) {
          epaper.shareImageUrl = getOptimizedUrl(firstPage.publicId, {
            width: 600,
            height: 800,
            crop: 'fill',
            quality: 60,
            fetch_format: 'jpg'
          });
          console.log('✅ shareImageUrl generated from first page publicId');
        } else if (firstPage.thumbnail) {
          epaper.shareImageUrl = firstPage.thumbnail;
          console.log('✅ shareImageUrl set from first page thumbnail');
        } else if (firstPage.image) {
          epaper.shareImageUrl = firstPage.image;
          console.log('✅ shareImageUrl set from first page image');
        }
      }
    }

    // Log epaper structure before validation
    console.log('Epaper structure before save:', {
      id: epaper.id,
      title: epaper.title,
      date: epaper.date,
      status: epaper.status,
      pagesCount: epaper.pages?.length || 0,
      hasShareImageUrl: !!epaper.shareImageUrl,
      shareImageUrl: epaper.shareImageUrl ? epaper.shareImageUrl.substring(0, 80) + '...' : 'missing',
      firstPage: epaper.pages?.[0] ? {
        pageNo: epaper.pages[0].pageNo,
        hasImage: !!epaper.pages[0].image,
        hasPublicId: !!epaper.pages[0].publicId,
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
      
      // Generate metaHtml asynchronously (non-blocking, doesn't add latency)
      generateEpaperMetaHtml(epaper.toObject(), BASE_URL)
        .then(metaHtml => {
          Epaper.findByIdAndUpdate(epaper._id, { metaHtml })
            .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
        })
        .catch(err => console.error('Error generating metaHtml (non-critical):', err.message));
      
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

