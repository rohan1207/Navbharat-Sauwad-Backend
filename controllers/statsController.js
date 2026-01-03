import mongoose from 'mongoose';
import Article from '../models/Article.js';
import Category from '../models/Category.js';
import Author from '../models/Author.js';
import Media from '../models/Media.js';
import Subscriber from '../models/Subscriber.js';
import Epaper from '../models/Epaper.js';

export const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log('📊 Fetching dashboard stats...');
    console.log('📊 Article model:', Article.modelName);
    console.log('📊 Article collection name:', Article.collection.name);
    
    // First, let's verify the Article model is working
    let totalArticles = 0;
    try {
      // Check if model is connected
      const db = Article.db || mongoose.connection.db;
      if (!db || db.readyState !== 1) {
        console.warn('⚠️ Article model database not connected');
      } else {
        console.log('✅ Database connected, readyState:', db.readyState);
      }
      
      // Try multiple methods to count articles
      totalArticles = await Article.countDocuments({});
      console.log('📊 Article.countDocuments({}) result:', totalArticles);
      
      // If countDocuments returns 0, try other methods
      if (totalArticles === 0) {
        console.log('⚠️ countDocuments returned 0, trying alternative methods...');
        
        // Method 1: Try estimatedDocumentCount
        try {
          const estimated = await Article.estimatedDocumentCount();
          console.log('📊 Article.estimatedDocumentCount() result:', estimated);
          if (estimated > 0) {
            totalArticles = estimated;
          }
        } catch (e) {
          console.log('⚠️ estimatedDocumentCount failed:', e.message);
        }
        
        // Method 2: Try finding articles to verify they exist
        if (totalArticles === 0) {
          try {
            const allArticles = await Article.find({}).limit(5);
            console.log('📊 Article.find({}).limit(5) found:', allArticles.length, 'articles');
            if (allArticles.length > 0) {
              // If we can find articles but count is 0, use find().count()
              totalArticles = await Article.find({}).countDocuments();
              console.log('📊 Article.find({}).countDocuments() result:', totalArticles);
            }
          } catch (e) {
            console.log('⚠️ Article.find() failed:', e.message);
          }
        }
        
        // Method 3: Try direct collection access with different collection names
        if (totalArticles === 0 && db) {
          const possibleCollectionNames = ['articles', 'Articles', 'article', 'Article'];
          for (const collName of possibleCollectionNames) {
            try {
              const collection = db.collection(collName);
              const directCount = await collection.countDocuments({});
              console.log(`📊 Direct collection '${collName}' countDocuments result:`, directCount);
              if (directCount > 0) {
                totalArticles = directCount;
                console.log(`✅ Found articles in collection: ${collName}`);
                break;
              }
            } catch (e) {
              console.log(`⚠️ Collection '${collName}' not found or error:`, e.message);
            }
          }
        }
        
        // Method 4: List all collections to see what's available
        if (totalArticles === 0 && db) {
          try {
            const collections = await db.listCollections().toArray();
            console.log('📊 Available collections:', collections.map(c => c.name));
            // Look for any collection that might contain articles
            const articleLikeCollections = collections.filter(c => 
              c.name.toLowerCase().includes('article') || 
              c.name.toLowerCase().includes('post') ||
              c.name.toLowerCase().includes('news')
            );
            if (articleLikeCollections.length > 0) {
              console.log('📊 Found article-like collections:', articleLikeCollections.map(c => c.name));
              for (const coll of articleLikeCollections) {
                try {
                  const count = await db.collection(coll.name).countDocuments({});
                  console.log(`📊 Collection '${coll.name}' has ${count} documents`);
                  if (count > 0) {
                    totalArticles = count;
                    console.log(`✅ Using collection: ${coll.name}`);
                    break;
                  }
                } catch (e) {
                  console.log(`⚠️ Error counting '${coll.name}':`, e.message);
                }
              }
            }
          } catch (e) {
            console.log('⚠️ Error listing collections:', e.message);
          }
        }
      }
      
      console.log('📊 Final totalArticles count:', totalArticles);
    } catch (err) {
      console.error('❌ Error counting articles:', err);
      console.error('Error details:', err.message);
      if (err.stack) {
        console.error('Stack:', err.stack);
      }
      totalArticles = 0;
    }
    
    const [
      publishedToday,
      drafts,
      pendingReview,
      totalViews,
      totalCategories,
      totalAuthors,
      totalMedia,
      totalSubscribers,
      totalEpaper
    ] = await Promise.all([
      Article.countDocuments({ 
        status: 'published', 
        publishedAt: { $gte: today } 
      }).catch(() => 0),
      Article.countDocuments({ status: 'draft' }).catch(() => 0),
      Article.countDocuments({ status: 'pending' }).catch(() => 0),
      Article.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]).then(result => result[0]?.total || 0).catch(() => 0),
      Category.countDocuments({ isActive: true }).catch(() => 0),
      Author.countDocuments({ isActive: true }).catch(() => 0),
      Media.countDocuments().catch(() => 0),
      Subscriber.countDocuments({ isActive: true }).catch(() => 0),
      Epaper.countDocuments().catch(() => 0)
    ]);
    
    const stats = {
      totalArticles: totalArticles || 0,
      publishedToday: publishedToday || 0,
      drafts: drafts || 0,
      pendingReview: pendingReview || 0,
      totalViews: totalViews || 0,
      totalCategories: totalCategories || 0,
      totalAuthors: totalAuthors || 0,
      totalMedia: totalMedia || 0,
      totalSubscribers: totalSubscribers || 0,
      totalEpaper: totalEpaper || 0
    };
    
    console.log('📊 Stats fetched:', stats);
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      message: error.message 
    });
  }
};














