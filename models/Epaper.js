import mongoose from 'mongoose';

const newsItemSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  slug: { type: String, trim: true },
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
  slug: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    index: true
  },
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
epaperSchema.pre('save', async function(next) {
  this.updatedAt = new Date();
  
  // Auto-generate slug from title if it doesn't exist
  if (!this.slug && this.title) {
    try {
      const { generateUniqueSlug } = await import('../utils/slugGenerator.js');
      this.slug = await generateUniqueSlug(
        mongoose.models.Epaper || Epaper,
        this.title,
        this._id
      );
    } catch (error) {
      console.error('Error generating e-paper slug:', error);
      // Continue even if slug generation fails
    }
  }
  
  // Auto-generate slugs for sections (news items) if they don't have slugs
  if (this.pages && Array.isArray(this.pages)) {
    const { generateSlug } = await import('../utils/slugGenerator.js');
    for (const page of this.pages) {
      if (page.news && Array.isArray(page.news)) {
        for (const newsItem of page.news) {
          if (!newsItem.slug) {
            const textForSlug = newsItem.title || 
              (newsItem.content ? newsItem.content.substring(0, 100) : '');
            if (textForSlug) {
              newsItem.slug = generateSlug(textForSlug);
            }
          }
        }
      }
    }
  }
  
  next();
});

// Index for faster queries
epaperSchema.index({ id: 1 });
epaperSchema.index({ slug: 1 });
epaperSchema.index({ date: -1 });
epaperSchema.index({ status: 1 });

// Check if model already exists to prevent overwrite errors during hot reload
const Epaper = mongoose.models.Epaper || mongoose.model('Epaper', epaperSchema);

export default Epaper;

