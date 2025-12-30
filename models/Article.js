import mongoose from 'mongoose';

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  titleEn: {
    type: String,
    trim: true
  },
  // Kept for backward compatibility but no longer used in forms/frontend
  subtitle: {
    type: String,
    trim: true
  },
  // Previously required "description"; now optional so new articles can rely on content only
  summary: {
    type: String
  },
  content: {
    type: String,
    required: true
  },
  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  subCategoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Author'
  },
  featuredImage: {
    type: String,
    default: ''
  },
  imageGallery: [{
    type: String
  }],
  isBreaking: {
    type: Boolean,
    default: false
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'published'],
    default: 'draft'
  },
  scheduledAt: {
    type: Date
  },
  publishedAt: {
    type: Date
  },
  date: {
    type: Date,
    default: Date.now
  },
  views: {
    type: Number,
    default: 0
  },
  metaKeywords: {
    type: String,
    default: ''
  },
  metaDescription: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
articleSchema.index({ categoryId: 1, status: 1 });
articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ isFeatured: 1, publishedAt: -1 });
articleSchema.index({ isBreaking: 1, publishedAt: -1 });
articleSchema.index({ scheduledAt: 1 });

// Check if model already exists to prevent overwrite errors during hot reload
const Article = mongoose.models.Article || mongoose.model('Article', articleSchema);

export default Article;


