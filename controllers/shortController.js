import Short from '../models/Short.js';

// Helper function to extract YouTube video ID from various URL formats
const extractVideoId = (url) => {
  if (!url) return null;
  
  // Handle different YouTube URL formats
  const patterns = [
    /(?:youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
};

// Get all shorts (public)
export const getShorts = async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    
    const shorts = await Short.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(shorts);
  } catch (error) {
    console.error('Error fetching shorts:', error);
    res.status(500).json({ error: 'Failed to fetch shorts' });
  }
};

// Get all shorts (admin)
export const getAllShorts = async (req, res) => {
  try {
    const shorts = await Short.find()
      .sort({ order: 1, createdAt: -1 });
    
    res.json(shorts);
  } catch (error) {
    console.error('Error fetching shorts:', error);
    res.status(500).json({ error: 'Failed to fetch shorts' });
  }
};

// Get single short
export const getShort = async (req, res) => {
  try {
    const { id } = req.params;
    const short = await Short.findById(id);
    
    if (!short) {
      return res.status(404).json({ error: 'Short not found' });
    }
    
    res.json(short);
  } catch (error) {
    console.error('Error fetching short:', error);
    res.status(500).json({ error: 'Failed to fetch short' });
  }
};

// Create short
export const createShort = async (req, res) => {
  try {
    const { youtubeUrl, order, isActive } = req.body;
    
    if (!youtubeUrl) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }
    
    const videoId = extractVideoId(youtubeUrl);
    
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube Shorts link.' });
    }
    
    const short = new Short({
      youtubeUrl,
      videoId,
      order: order || 0,
      isActive: isActive !== false
    });
    
    await short.save();
    res.status(201).json(short);
  } catch (error) {
    console.error('Error creating short:', error);
    const errorMessage = error.name === 'ValidationError' 
      ? Object.values(error.errors).map(e => e.message).join(', ')
      : error.message || 'Failed to create short';
    res.status(400).json({ error: errorMessage });
  }
};

// Update short
export const updateShort = async (req, res) => {
  try {
    const { id } = req.params;
    const { youtubeUrl, order, isActive } = req.body;
    
    const short = await Short.findById(id);
    if (!short) {
      return res.status(404).json({ error: 'Short not found' });
    }
    
    let updateData = {};
    
    if (youtubeUrl !== undefined) {
      const videoId = extractVideoId(youtubeUrl);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube URL. Please provide a valid YouTube Shorts link.' });
      }
      updateData.youtubeUrl = youtubeUrl;
      updateData.videoId = videoId;
    }
    
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    const updatedShort = await Short.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
    
    res.json(updatedShort);
  } catch (error) {
    console.error('Error updating short:', error);
    const errorMessage = error.name === 'ValidationError' 
      ? Object.values(error.errors).map(e => e.message).join(', ')
      : error.message || 'Failed to update short';
    res.status(400).json({ error: errorMessage });
  }
};

// Delete short
export const deleteShort = async (req, res) => {
  try {
    const { id } = req.params;
    const short = await Short.findByIdAndDelete(id);
    
    if (!short) {
      return res.status(404).json({ error: 'Short not found' });
    }
    
    res.json({ message: 'Short deleted successfully' });
  } catch (error) {
    console.error('Error deleting short:', error);
    res.status(500).json({ error: 'Failed to delete short' });
  }
};

// Increment views
export const incrementViews = async (req, res) => {
  try {
    const { id } = req.params;
    await Short.findByIdAndUpdate(id, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing views:', error);
    res.status(500).json({ error: 'Failed to increment views' });
  }
};

