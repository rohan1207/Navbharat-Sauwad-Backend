import mongoose from 'mongoose';
import Article from '../models/Article.js';

// Get all articles with filters
export const getArticles = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category, search, sort = 'createdAt:desc' } = req.query;
    
    const query = {};
    
    if (status) query.status = status;
    if (category) query.categoryId = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { summary: { $regex: search, $options: 'i' } }
      ];
    }
    
    const [sortField, sortOrder] = sort.split(':');
    const sortObj = { [sortField]: sortOrder === 'desc' ? -1 : 1 };
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const articles = await Article.find(query)
      .populate('categoryId', 'name nameEn')
      .populate('subCategoryId', 'name nameEn')
      .populate('authorId', 'name designation')
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Article.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    res.json({
      data: articles,
      page: parseInt(page),
      totalPages,
      total
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
};

// Get single article
export const getArticle = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ID
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'Invalid article ID' });
    }
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid article ID format' });
    }
    
    const article = await Article.findById(id)
      .populate('categoryId', 'name nameEn')
      .populate('subCategoryId', 'name nameEn')
      .populate('authorId', 'name designation profileImage');
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).json({ error: 'Failed to fetch article' });
  }
};

// Create article
export const createArticle = async (req, res) => {
  try {
    const articleData = req.body;
    
    // Clean up empty strings for ObjectId fields
    if (articleData.subCategoryId === '' || articleData.subCategoryId === null) {
      delete articleData.subCategoryId;
    }
    if (articleData.authorId === '' || articleData.authorId === null) {
      delete articleData.authorId;
    }
    if (articleData.scheduledAt === '' || articleData.scheduledAt === null) {
      delete articleData.scheduledAt;
    }
    
    // If status is published, set publishedAt
    if (articleData.status === 'published' && !articleData.publishedAt) {
      articleData.publishedAt = new Date();
    }
    
    const article = new Article(articleData);
    await article.save();
    
    const populatedArticle = await Article.findById(article._id)
      .populate('categoryId', 'name nameEn')
      .populate('subCategoryId', 'name nameEn')
      .populate('authorId', 'name designation');
    
    res.status(201).json(populatedArticle);
  } catch (error) {
    console.error('Error creating article:', error);
    // Provide more detailed error message
    const errorMessage = error.name === 'ValidationError' 
      ? Object.values(error.errors).map(e => e.message).join(', ')
      : error.message || 'Failed to create article';
    res.status(400).json({ error: errorMessage });
  }
};

// Update article
export const updateArticle = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Clean up empty strings for ObjectId fields
    if (updateData.subCategoryId === '' || updateData.subCategoryId === null) {
      updateData.subCategoryId = null;
    }
    if (updateData.authorId === '' || updateData.authorId === null) {
      updateData.authorId = null;
    }
    if (updateData.scheduledAt === '' || updateData.scheduledAt === null) {
      updateData.scheduledAt = null;
    }
    
    // If status changed to published, set publishedAt
    if (updateData.status === 'published' && !updateData.publishedAt) {
      updateData.publishedAt = new Date();
    }
    
    const article = await Article.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('categoryId', 'name nameEn')
      .populate('subCategoryId', 'name nameEn')
      .populate('authorId', 'name designation');
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.json(article);
  } catch (error) {
    console.error('Error updating article:', error);
    // Provide more detailed error message
    const errorMessage = error.name === 'ValidationError' 
      ? Object.values(error.errors).map(e => e.message).join(', ')
      : error.message || 'Failed to update article';
    res.status(400).json({ error: errorMessage });
  }
};

// Delete article
export const deleteArticle = async (req, res) => {
  try {
    const article = await Article.findByIdAndDelete(req.params.id);
    
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
};

// Bulk actions
export const bulkAction = async (req, res) => {
  try {
    const { action, ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid IDs array' });
    }
    
    let result;
    switch (action) {
      case 'publish':
        result = await Article.updateMany(
          { _id: { $in: ids } },
          { status: 'published', publishedAt: new Date() }
        );
        break;
      case 'draft':
        result = await Article.updateMany(
          { _id: { $in: ids } },
          { status: 'draft' }
        );
        break;
      case 'delete':
        result = await Article.deleteMany({ _id: { $in: ids } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
    
    res.json({ message: `Successfully ${action}ed ${result.modifiedCount || result.deletedCount} articles` });
  } catch (error) {
    console.error('Error in bulk action:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
};

// Increment views
export const incrementViews = async (req, res) => {
  try {
    await Article.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });
    res.json({ success: true });
  } catch (error) {
    console.error('Error incrementing views:', error);
    res.status(500).json({ error: 'Failed to increment views' });
  }
};


