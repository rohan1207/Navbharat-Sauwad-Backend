import WebsiteStats from '../models/WebsiteStats.js';

// Get today's date string (YYYY-MM-DD)
const getTodayString = () => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Track a visit or hit
export const trackStats = async (req, res) => {
  try {
    const { isNewVisit, isNewHit, timestamp, date } = req.body;
    
    if (!isNewVisit && !isNewHit) {
      return res.status(200).json({ message: 'No stats to track' });
    }

    const today = date || getTodayString();
    
    // Find or create today's stats
    let stats = await WebsiteStats.findOne({ date: today });
    
    if (!stats) {
      stats = new WebsiteStats({
        date: today,
        visits: 0,
        hits: 0
      });
    }
    
    // Increment visits if it's a new visit
    if (isNewVisit) {
      stats.visits += 1;
    }
    
    // Increment hits if it's a new hit
    if (isNewHit) {
      stats.hits += 1;
    }
    
    stats.lastUpdated = new Date();
    await stats.save();
    
    res.status(200).json({ 
      message: 'Stats tracked successfully',
      stats: {
        visits: stats.visits,
        hits: stats.hits,
        date: stats.date
      }
    });
  } catch (error) {
    console.error('Error tracking stats:', error);
    res.status(500).json({ 
      error: 'Failed to track stats',
      message: error.message 
    });
  }
};

// Get aggregated website stats
export const getWebsiteStats = async (req, res) => {
  try {
    const today = getTodayString();
    
    // Get today's stats
    const todayStats = await WebsiteStats.findOne({ date: today });
    
    // Get all-time totals by summing all days
    const allStats = await WebsiteStats.aggregate([
      {
        $group: {
          _id: null,
          totalVisits: { $sum: '$visits' },
          totalHits: { $sum: '$hits' }
        }
      }
    ]);
    
    const totals = allStats[0] || { totalVisits: 0, totalHits: 0 };
    
    const stats = {
      totalVisits: totals.totalVisits || 0,
      visitsToday: todayStats?.visits || 0,
      totalHits: totals.totalHits || 0,
      hitsToday: todayStats?.hits || 0,
      lastVisitDate: today
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching website stats:', error);
    res.status(500).json({ 
      error: 'Failed to fetch stats',
      message: error.message 
    });
  }
};

