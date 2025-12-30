import mongoose from 'mongoose';

const shortSchema = new mongoose.Schema({
  youtubeUrl: {
    type: String,
    required: true,
    trim: true
  },
  videoId: {
    type: String,
    required: true,
    index: true
  },
  order: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
shortSchema.index({ isActive: 1, order: 1, createdAt: -1 });

// Check if model already exists to prevent overwrite errors during hot reload
const Short = mongoose.models.Short || mongoose.model('Short', shortSchema);

export default Short;

