import express from 'express';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import Ad from '../models/Ad.js';
import fs from 'fs-extra';

const router = express.Router();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = './temp';
    fs.ensureDirSync(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|mp4|webm|mov/;
    const extname = allowedTypes.test(file.originalname.toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image and video files are allowed'));
    }
  }
});

// Get all ads (admin)
router.get('/', async (req, res) => {
  try {
    const ads = await Ad.find().sort({ position: 1, order: 1, createdAt: -1 });
    res.json(ads);
  } catch (error) {
    console.error('Error fetching ads:', error);
    res.status(500).json({ error: 'Failed to fetch ads' });
  }
});

// Get active ads by position (frontend) - MUST be before /:id route
router.get('/active/:position', async (req, res) => {
  try {
    const { position } = req.params;
    
    console.log('Fetching active ads for position:', position);
    
    // Validate position parameter
    if (!position) {
      return res.status(400).json({ error: 'Position parameter is required' });
    }
    
    const ads = await Ad.find({ 
      position, 
      isActive: true 
    }).sort({ order: 1, createdAt: -1 });
    
    console.log(`Found ${ads.length} active ads for position: ${position}`);
    
    res.json(ads);
  } catch (error) {
    console.error('Error fetching active ads:', error);
    res.status(500).json({ error: 'Failed to fetch ads', details: error.message });
  }
});

// Get single ad - MUST be after /active/:position route
router.get('/:id', async (req, res) => {
  try {
    // Don't match if it's an 'active' route (should have been caught above)
    if (req.params.id === 'active') {
      return res.status(404).json({ error: 'Route not found' });
    }
    
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }
    res.json(ad);
  } catch (error) {
    console.error('Error fetching ad:', error);
    res.status(500).json({ error: 'Failed to fetch ad' });
  }
});

// Create ad
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { position, title, link, order, isActive } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'File is required' });
    }

    let imageUrl = '';
    let videoUrl = '';
    let cloudinaryPublicId = '';
    let cloudinaryVideoPublicId = '';

    const isVideo = req.file.mimetype.startsWith('video/');
    
    // Upload to Cloudinary
    if (isVideo) {
      const result = await cloudinary.uploader.upload(req.file.path, {
        resource_type: 'video',
        folder: 'newspaper/ads',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });
      videoUrl = result.secure_url;
      cloudinaryVideoPublicId = result.public_id;
    } else {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'newspaper/ads',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      });
      imageUrl = result.secure_url;
      cloudinaryPublicId = result.public_id;
    }

    // Clean up temp file
    await fs.remove(req.file.path);

    // Ensure at least one URL is set
    if (!imageUrl && !videoUrl) {
      return res.status(400).json({ error: 'Failed to upload file to Cloudinary' });
    }

    const ad = new Ad({
      position,
      title: title || '',
      imageUrl: imageUrl || '',
      videoUrl: videoUrl || '',
      link: link || '',
      order: order ? parseInt(order) : 0,
      isActive: isActive !== 'false',
      cloudinaryPublicId: cloudinaryPublicId || '',
      cloudinaryVideoPublicId: cloudinaryVideoPublicId || ''
    });

    await ad.save();
    res.status(201).json(ad);
  } catch (error) {
    console.error('Error creating ad:', error);
    // Clean up temp file on error
    if (req.file && req.file.path) {
      await fs.remove(req.file.path).catch(console.error);
    }
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// Update ad
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const { position, title, link, order, isActive } = req.body;
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // If new file uploaded, replace old one
    if (req.file) {
      const isVideo = req.file.mimetype.startsWith('video/');
      
      // Delete old files from Cloudinary (both image and video, if they exist)
      if (ad.cloudinaryPublicId) {
        await cloudinary.uploader.destroy(ad.cloudinaryPublicId).catch(console.error);
      }
      if (ad.cloudinaryVideoPublicId) {
        await cloudinary.uploader.destroy(ad.cloudinaryVideoPublicId, {
          resource_type: 'video'
        }).catch(console.error);
      }

      // Upload new file
      if (isVideo) {
        const result = await cloudinary.uploader.upload(req.file.path, {
          resource_type: 'video',
          folder: 'newspaper/ads',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        ad.videoUrl = result.secure_url;
        ad.cloudinaryVideoPublicId = result.public_id;
        // Clear image URL when uploading video
        ad.imageUrl = '';
        ad.cloudinaryPublicId = '';
      } else {
        const result = await cloudinary.uploader.upload(req.file.path, {
          folder: 'newspaper/ads',
          transformation: [
            { quality: 'auto' },
            { fetch_format: 'auto' }
          ]
        });
        ad.imageUrl = result.secure_url;
        ad.cloudinaryPublicId = result.public_id;
        // Clear video URL when uploading image
        ad.videoUrl = '';
        ad.cloudinaryVideoPublicId = '';
      }

      await fs.remove(req.file.path);
    }

    // Update other fields
    if (position) ad.position = position;
    if (title !== undefined) ad.title = title;
    if (link !== undefined) ad.link = link;
    if (order !== undefined) ad.order = parseInt(order);
    if (isActive !== undefined) ad.isActive = isActive === 'true' || isActive === true;

    // Ensure at least one URL is set
    if (!ad.imageUrl && !ad.videoUrl) {
      return res.status(400).json({ error: 'Ad must have either an image or video URL' });
    }

    await ad.save();
    res.json(ad);
  } catch (error) {
    console.error('Error updating ad:', error);
    if (req.file && req.file.path) {
      await fs.remove(req.file.path).catch(console.error);
    }
    res.status(500).json({ error: 'Failed to update ad' });
  }
});

// Delete ad
router.delete('/:id', async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Delete from Cloudinary
    if (ad.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(ad.cloudinaryPublicId)
        .catch(console.error);
    }
    if (ad.cloudinaryVideoPublicId) {
      await cloudinary.uploader.destroy(ad.cloudinaryVideoPublicId, {
        resource_type: 'video'
      }).catch(console.error);
    }

    await Ad.findByIdAndDelete(req.params.id);
    res.json({ message: 'Ad deleted successfully' });
  } catch (error) {
    console.error('Error deleting ad:', error);
    res.status(500).json({ error: 'Failed to delete ad' });
  }
});

// Track ad click
router.post('/:id/click', async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { clicks: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// Track ad impression
router.post('/:id/impression', async (req, res) => {
  try {
    await Ad.findByIdAndUpdate(req.params.id, { $inc: { impressions: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error tracking impression:', error);
    res.status(500).json({ error: 'Failed to track impression' });
  }
});

export default router;

