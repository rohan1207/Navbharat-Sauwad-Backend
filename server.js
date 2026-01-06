import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mongoose from 'mongoose';
import connectDB from './config/database.js';
import epaperRoutes from './routes/epapers.js';
import adminRoutes from './routes/admin.js';
import articleRoutes from './routes/articles.js';
import adRoutes from './routes/ads.js';
import ttsRoutes from './routes/tts.js';
import photoOfTheDayRoutes from './routes/photoOfTheDay.js';
import shortsRoutes from './routes/shorts.js';
import sportsRoutes from './routes/sports.js';
import metaRoutes from './routes/meta.js';
import socialPreviewRoutes from './routes/socialPreview.js';
import subscriberRoutes from './routes/subscribers.js';
import sitemapRoutes from './routes/sitemap.js';
import statsRoutes from './routes/stats.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file in backend directory
dotenv.config({ path: join(__dirname, '.env') });

// Verify environment variables are loaded
console.log('🔍 Environment check:');
console.log('  MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
console.log('  CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('  PORT:', process.env.PORT || 5001);

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware - CORS configuration
const allowedOrigins = [
  'http://localhost:5174', // Old Frontend (Vite)
  'http://localhost:5175', // Admin Panel
  'http://localhost:3000', // Next.js Frontend
  'https://navmanch.onrender.com',
  'https://navmanch-admin.onrender.com',
  'https://navmanchnews.com',
  'https://admin.navmanchnews.com',
  'http://127.0.0.1:5500/',
  
  process.env.FRONTEND_URL,
  process.env.ADMIN_PANEL_URL
].filter(Boolean); // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Always allow TTS endpoint for audio playback
    if (origin && (origin.includes('navbharat-sauwad') || origin.includes('navmanch'))) {
      return callback(null, true);
    }
    
    if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      // In development, allow all origins
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Sitemap route (MUST be before other routes)
app.use('/', sitemapRoutes);

// Social media preview routes (MUST be before API routes to catch crawler requests)
// These routes serve HTML with meta tags for WhatsApp, Facebook, Twitter crawlers
// When crawlers visit /news/:id or /epaper/:id, they get HTML with proper meta tags
app.use('/', socialPreviewRoutes);

// API Routes
app.use('/api/epapers', epaperRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api/admin/ads', adRoutes);
app.use('/api/ads', adRoutes); // Public route for frontend
app.use('/api/tts', ttsRoutes); // TTS proxy route
app.use('/api/photo-of-the-day', photoOfTheDayRoutes); // Photo of the Day route
app.use('/api/shorts', shortsRoutes); // Shorts route
app.use('/api/sports', sportsRoutes); // Sports Monk API routes
app.use('/api/meta', metaRoutes); // Meta tags route
app.use('/api/subscribers', subscriberRoutes); // Subscribers route
app.use('/api/stats', statsRoutes); // Website stats route

// Ping/Pong endpoint - Keep server alive on Render
app.get('/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.json({ 
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    message: 'Server is running',
    database: dbStatus,
    storage: 'Cloudinary',
    readyState: mongoose.connection.readyState
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    console.log('');
    console.log('⚙️  Initializing server...');
    const initStartTime = Date.now();
    
    // Check if already connected (useful for hot reloads)
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected, skipping connection step');
    } else {
      console.log('🔄 Starting server...');
      console.log('📡 Attempting to connect to MongoDB...');
      
      // Set a timeout for MongoDB connection (reduced to 8 seconds)
      const connectionPromise = connectDB();
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('MongoDB connection timeout after 8 seconds. Check your MONGODB_URI and network connection.'));
        }, 8000);
      });
      
      // Connect to MongoDB first with timeout
      await Promise.race([connectionPromise, timeoutPromise]);
      console.log('✅ MongoDB connected successfully');
    }
    
    console.log('🌐 Starting HTTP server...');
    
    // Start server after database connection
    app.listen(PORT, () => {
      const totalTime = ((Date.now() - initStartTime) / 1000).toFixed(2);
      console.log('');
      console.log('═══════════════════════════════════════════════════');
      console.log(`🚀 Server is running on http://localhost:${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`💾 Database: MongoDB`);
      console.log(`☁️  Storage: Cloudinary`);
      console.log(`📡 API Base: http://localhost:${PORT}/api`);
      console.log(`⏱️  Startup time: ${totalTime} seconds`);
      console.log('═══════════════════════════════════════════════════');
      console.log('');
    });
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════');
    console.error('❌ Failed to start server');
    console.error('═══════════════════════════════════════════════════');
    console.error('Error:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('   1. Check if MONGODB_URI is set in .env file');
    console.error('   2. Verify MongoDB connection string is correct');
    console.error('   3. Check your internet connection');
    console.error('   4. Ensure MongoDB Atlas IP whitelist includes your IP');
    console.error('═══════════════════════════════════════════════════');
    console.error('');
    process.exit(1);
  }
};

// Start the server
startServer().catch((error) => {
  console.error('❌ Unhandled error in startServer:', error);
  process.exit(1);
});
