import PhotoOfTheDay from '../models/PhotoOfTheDay.js';
import { uploadToCloudinary } from '../services/uploadService.js';
import multer from 'multer';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

export const uploadMiddleware = (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('Multer error:', err);
      return res.status(400).json({ 
        error: 'File upload error',
        details: err.message 
      });
    }
    next();
  });
};

// Get today's photo
export const getTodayPhoto = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const photo = await PhotoOfTheDay.findOne({
      date: {
        $gte: today,
        $lt: tomorrow
      },
      isActive: true
    }).sort({ date: -1 });

    if (!photo) {
      // Get the most recent active photo as fallback
      const latestPhoto = await PhotoOfTheDay.findOne({ isActive: true })
        .sort({ date: -1 })
        .limit(1);
      
      return res.json(latestPhoto);
    }

    res.json(photo);
  } catch (error) {
    console.error('Error fetching photo of the day:', error);
    res.status(500).json({ error: 'Failed to fetch photo of the day' });
  }
};

// Get all photos (admin)
export const getAllPhotos = async (req, res) => {
  try {
    const photos = await PhotoOfTheDay.find()
      .sort({ date: -1 })
      .limit(100);
    res.json(photos);
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
};

// Create photo (admin)
export const createPhoto = async (req, res) => {
  try {
    console.log('Create photo request received:', {
      hasFile: !!req.file,
      body: req.body,
      fileInfo: req.file ? { size: req.file.size, mimetype: req.file.mimetype } : null
    });

    const { caption, captionEn, photographer, location, date, isActive } = req.body;

    if (!req.file && !req.body.image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!caption) {
      return res.status(400).json({ error: 'Caption is required' });
    }

    let imageUrl = req.body.image; // If image URL is provided directly

    // Upload file to Cloudinary if file is provided
    if (req.file) {
      try {
        console.log('Uploading to Cloudinary...');
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          'newspaper/photo-of-the-day',
          'image'
        );
        imageUrl = uploadResult.url; // Use 'url' not 'secure_url'
        console.log('Upload successful:', imageUrl);
      } catch (uploadError) {
        console.error('Error uploading to Cloudinary:', uploadError);
        return res.status(500).json({ 
          error: 'Failed to upload image',
          details: uploadError.message 
        });
      }
    }

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const photoDate = date ? new Date(date) : new Date();
    photoDate.setHours(0, 0, 0, 0);

    // Check if photo for this date already exists
    const existingPhoto = await PhotoOfTheDay.findOne({
      date: {
        $gte: new Date(photoDate),
        $lt: new Date(photoDate.getTime() + 24 * 60 * 60 * 1000)
      }
    });

    if (existingPhoto) {
      return res.status(400).json({ error: 'Photo for this date already exists' });
    }

    const photo = new PhotoOfTheDay({
      image: imageUrl,
      caption,
      captionEn: captionEn || '',
      photographer: photographer || '',
      location: location || '',
      date: photoDate,
      isActive: isActive !== 'false' && isActive !== false
    });

    console.log('Saving photo to database...');
    await photo.save();
    console.log('Photo saved successfully:', photo._id);
    
    res.status(201).json(photo);
  } catch (error) {
    console.error('Error creating photo:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to create photo',
      details: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
};

// Update photo (admin)
export const updatePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, captionEn, photographer, location, date, isActive } = req.body;

    const photo = await PhotoOfTheDay.findById(id);
    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Update fields
    if (caption !== undefined) photo.caption = caption;
    if (captionEn !== undefined) photo.captionEn = captionEn;
    if (photographer !== undefined) photo.photographer = photographer;
    if (location !== undefined) photo.location = location;
    if (isActive !== undefined) photo.isActive = isActive;
    if (date) {
      const photoDate = new Date(date);
      photoDate.setHours(0, 0, 0, 0);
      photo.date = photoDate;
    }

    // Upload new image if provided
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          'newspaper/photo-of-the-day',
          'image'
        );
        photo.image = uploadResult.url; // Use 'url' not 'secure_url'
      } catch (uploadError) {
        console.error('Error uploading to Cloudinary:', uploadError);
        return res.status(500).json({ error: 'Failed to upload image' });
      }
    } else if (req.body.image) {
      photo.image = req.body.image;
    }

    await photo.save();
    res.json(photo);
  } catch (error) {
    console.error('Error updating photo:', error);
    res.status(500).json({ error: 'Failed to update photo' });
  }
};

// Delete photo (admin)
export const deletePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const photo = await PhotoOfTheDay.findByIdAndDelete(id);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    res.json({ message: 'Photo deleted successfully' });
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
};

// Increment views
export const incrementViews = async (req, res) => {
  try {
    const { id } = req.params;
    await PhotoOfTheDay.findByIdAndUpdate(id, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing views:', error);
    res.status(500).json({ error: 'Failed to increment views' });
  }
};

