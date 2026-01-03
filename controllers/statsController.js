import Article from '../models/Article.js';
import Category from '../models/Category.js';
import Author from '../models/Author.js';
import Media from '../models/Media.js';

export const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [
      totalArticles,
      publishedToday,
      drafts,
      pendingReview,
      totalViews,
      totalCategories,
      totalAuthors,
      totalMedia
    ] = await Promise.all([
      Article.countDocuments(),
      Article.countDocuments({ 
        status: 'published', 
        publishedAt: { $gte: today } 
      }),
      Article.countDocuments({ status: 'draft' }),
      Article.countDocuments({ status: 'pending' }),
      Article.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]).then(result => result[0]?.total || 0),
      Category.countDocuments({ isActive: true }),
      Author.countDocuments({ isActive: true }),
      Media.countDocuments()
    ]);
    
    res.json({
      totalArticles,
      publishedToday,
      drafts,
      pendingReview,
      totalViews,
      totalCategories,
      totalAuthors,
      totalMedia
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};














