import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  publicId: {
    type: String,
    default: ''
  },
  type: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

mediaSchema.index({ type: 1, createdAt: -1 });

const Media = mongoose.model('Media', mediaSchema);

export default Media;




















