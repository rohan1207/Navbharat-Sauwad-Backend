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

    console.log('🔌 Connecting to MongoDB...');
    const conn = await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 5000,
    });
    
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    console.log(`📊 Database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    if (error.message.includes('uri parameter')) {
      console.error('💡 Make sure MONGODB_URI is set correctly in .env file');
    }
    process.exit(1);
  }
};

export default connectDB;

