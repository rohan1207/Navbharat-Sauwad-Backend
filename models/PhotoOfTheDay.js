import mongoose from 'mongoose';

const photoOfTheDaySchema = new mongoose.Schema({
  image: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    required: true,
    trim: true
  },
  captionEn: {
    type: String,
    trim: true
  },
  photographer: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
    // Note: We check uniqueness in controller, not schema, to allow better error handling
  },
  isActive: {
    type: Boolean,
    default: true
  },
  views: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
photoOfTheDaySchema.index({ date: -1, isActive: 1 });

// Check if model already exists to prevent overwrite errors during hot reload
export default mongoose.models.PhotoOfTheDay || mongoose.model('PhotoOfTheDay', photoOfTheDaySchema);

