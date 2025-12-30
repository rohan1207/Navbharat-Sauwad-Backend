import mongoose from 'mongoose';

const adSchema = new mongoose.Schema({
  position: {
    type: String,
    required: true,
    enum: ['left', 'right', 'horizontal-video', 'right-vertical-video', 'horizontal-image'],
    index: true
  },
  title: {
    type: String,
    default: ''
  },
  imageUrl: {
    type: String,
    default: ''
  },
  videoUrl: {
    type: String,
    default: ''
  },
  link: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  order: {
    type: Number,
    default: 0
  },
  cloudinaryPublicId: {
    type: String,
    default: ''
  },
  cloudinaryVideoPublicId: {
    type: String,
    default: ''
  },
  clicks: {
    type: Number,
    default: 0
  },
  impressions: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
adSchema.index({ position: 1, isActive: 1, order: 1 });

// Custom validation: at least one of imageUrl or videoUrl must be present
adSchema.pre('validate', function(next) {
  if (!this.imageUrl && !this.videoUrl) {
    this.invalidate('imageUrl', 'Either imageUrl or videoUrl must be provided');
  }
  next();
});

const Ad = mongoose.model('Ad', adSchema);

export default Ad;

