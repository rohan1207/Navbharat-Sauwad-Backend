import mongoose from 'mongoose';

const websiteStatsSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  visits: {
    type: Number,
    default: 0
  },
  hits: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Create index on date for faster queries
websiteStatsSchema.index({ date: 1 });

const WebsiteStats = mongoose.model('WebsiteStats', websiteStatsSchema);

export default WebsiteStats;

