import mongoose from 'mongoose';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (if not already loaded)
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: join(__dirname, '../.env') });
}

const connectDB = async () => {
  try {
    // Get MongoDB URI from environment
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      console.error('Please check your .env file in the backend directory');
      process.exit(1);
    }

    if (typeof mongoURI !== 'string') {
      console.error('❌ MONGODB_URI must be a string');
      console.error('Current value:', mongoURI, 'Type:', typeof mongoURI);
      process.exit(1);
    }

    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('✅ MongoDB already connected, reusing connection');
      return mongoose.connection;
    }

    console.log('🔌 Connecting to MongoDB...');
    console.log(`   URI: ${mongoURI.substring(0, 20)}...`);
    const startTime = Date.now();
    
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5001, // Reduced to 5 seconds for faster failure
      socketTimeoutMS: 30000,
      connectTimeoutMS: 5001,
      maxPoolSize: 10, // Connection pool size
      minPoolSize: 1,
    });
    
    const connectionTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`⏱️  Connection took ${connectionTime} seconds`);
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('');
    console.error('═══════════════════════════════════════════════════');
    console.error('❌ MongoDB connection error');
    console.error('═══════════════════════════════════════════════════');
    console.error('Error:', error.message);
    if (error.message.includes('uri parameter')) {
      console.error('💡 Make sure MONGODB_URI is set correctly in .env file');
    }
    if (error.message.includes('timeout')) {
      console.error('💡 Connection timeout - check your internet connection and MongoDB URI');
    }
    if (error.message.includes('ENOTFOUND') || error.message.includes('querySrv')) {
      console.error('💡 DNS resolution failed - check your MongoDB URI format');
    }
    console.error('═══════════════════════════════════════════════════');
    console.error('');
    throw error; // Re-throw to be caught by startServer
  }
};

export default connectDB;

