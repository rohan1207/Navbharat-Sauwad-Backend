// Quick test script to check if server can start
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

console.log('🧪 Testing server startup...');
console.log('');
console.log('Environment variables:');
console.log('  MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set (' + process.env.MONGODB_URI.substring(0, 30) + '...)' : '❌ Missing');
console.log('  CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME ? '✅ Set' : '❌ Missing');
console.log('  PORT:', process.env.PORT || 5001);
console.log('');

// Test MongoDB connection
if (process.env.MONGODB_URI) {
  console.log('Testing MongoDB connection...');
  import('mongoose').then(({ default: mongoose }) => {
    mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5001,
    })
    .then(() => {
      console.log('✅ MongoDB connection test: SUCCESS');
      mongoose.connection.close();
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ MongoDB connection test: FAILED');
      console.error('Error:', error.message);
      process.exit(1);
    });
  });
} else {
  console.error('❌ MONGODB_URI not set');
  process.exit(1);
}




























