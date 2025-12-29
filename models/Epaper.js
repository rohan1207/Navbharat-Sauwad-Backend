import mongoose from 'mongoose';

const newsItemSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  // Made optional for simplified version 2 (cropped image only)
  title: { type: String, required: false, default: '' },
  content: { type: String, required: false, default: '' },
  articleId: { 
    type: mongoose.Schema.Types.Mixed, 
    default: null,
    validate: {
      validator: function(v) {
        return v === null || v === undefined || mongoose.Types.ObjectId.isValid(v);
      },
      message: 'articleId must be a valid ObjectId or null'
    }
  }
}, { _id: false, strict: false });

const pageSchema = new mongoose.Schema({
  pageNo: { type: Number, required: true },
  image: { type: String, required: true }, // Cloudinary URL
  thumbnail: { type: String, default: null }, // Cloudinary URL for thumbnail
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  news: { type: [newsItemSchema], default: [] }
}, { _id: false, strict: false });

const epaperSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  title: { type: String, required: true },
  date: { type: Date, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'published', 'archived'], 
    default: 'published' 
  },
  pages: { type: [pageSchema], default: [] },
  createdAt: { type: Date, default: () => new Date() },
  updatedAt: { type: Date, default: () => new Date() }
}, { strict: false }); // Allow extra fields to be ignored

// Update updatedAt before saving
epaperSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for faster queries
epaperSchema.index({ id: 1 });
epaperSchema.index({ date: -1 });
epaperSchema.index({ status: 1 });

const Epaper = mongoose.model('Epaper', epaperSchema);

export default Epaper;

