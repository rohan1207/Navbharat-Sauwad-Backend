import mongoose from 'mongoose';
import Media from '../models/Media.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../services/uploadService.js';

// Get all media
export const getMedia = async (req, res) => {
  try {
    const { type, search } = req.query;
    const query = {};
    
    if (type && type !== 'all') {
      query.type = { $regex: `^${type}`, $options: 'i' };
    }
    
    if (search) {
      query.name = { $regex: search, $options: 'i' };
    }
    
    const media = await Media.find(query)
      .sort({ createdAt: -1 })
      .limit(100);
    
    res.json({ data: media });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
};

// Upload media
export const uploadMedia = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const uploadedFiles = [];
    
    for (const file of req.files) {
      let folder = 'newspaper/files';
      let resourceType = 'raw';
      
      // Determine resource type based on MIME type
      if (file.mimetype.startsWith('image/')) {
        folder = 'newspaper/images';
        resourceType = 'image';
      } else if (file.mimetype.startsWith('video/')) {
        folder = 'newspaper/videos';
        resourceType = 'video';
      } else if (file.mimetype === 'application/pdf') {
        folder = 'newspaper/pdfs';
        resourceType = 'raw'; // PDFs are uploaded as raw files
      }
      
      const uploadResult = await uploadToCloudinary(file.buffer, folder, resourceType);
      
      const media = new Media({
        name: file.originalname,
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        type: file.mimetype,
        size: uploadResult.bytes
      });
      
      await media.save();
      uploadedFiles.push(media);
    }
    
    res.status(201).json({ 
      data: uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles,
      urls: uploadedFiles.map(f => f.url)
    });
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
};

// Upload single image
export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image uploaded' });
    }
    
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'newspaper/images', 'image');
    
    const media = new Media({
      name: req.file.originalname,
      url: uploadResult.url,
      publicId: uploadResult.publicId,
      type: req.file.mimetype,
      size: uploadResult.bytes
    });
    
    await media.save();
    
    res.status(201).json({ url: uploadResult.url, media });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
};

// Delete media
export const deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid media ID' });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid media ID format' });
    }
    
    const media = await Media.findById(id);
    
    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }
    
    // Delete from Cloudinary if publicId exists
    if (media.publicId) {
      try {
        await deleteFromCloudinary(media.publicId, media.type.startsWith('image/') ? 'image' : 'raw');
      } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        // Continue with database deletion even if Cloudinary deletion fails
      }
    }
    
    await Media.findByIdAndDelete(id);
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
};


