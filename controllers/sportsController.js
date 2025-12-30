import fetch from 'node-fetch';

const SPORTS_MONK_API_KEY = process.env.SPORTS_MONK_KEY;
const CRICKET_BASE_URL = 'https://cricket.sportmonks.com/api/v2.0';
const FOOTBALL_BASE_URL = 'https://api.sportmonks.com/v3/football';

// Helper function to make API requests with error handling
const makeRequest = async (url) => {
  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Sports Monk API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Sports Monk API Error:', error);
    throw error;
  }
};

// Get live cricket scores
export const getCricketLiveScores = async (req, res) => {
  try {
    if (!SPORTS_MONK_API_KEY) {
      console.error('Sports Monk API key not configured');
      return res.json({ data: [] });
    }

    const url = `${CRICKET_BASE_URL}/livescores?api_token=${SPORTS_MONK_API_KEY}&include=localteam,visitorteam,venue,scoreboards`;
    const data = await makeRequest(url);
    
    console.log(`Cricket live scores: ${data?.data?.length || 0} matches found`);
    res.json(data || { data: [] });
  } catch (error) {
    console.error('Error fetching cricket live scores:', error);
    // Return empty array instead of error to prevent frontend issues
    res.json({ data: [] });
  }
};

// Get upcoming cricket matches
export const getCricketUpcomingMatches = async (req, res) => {
  try {
    if (!SPORTS_MONK_API_KEY) {
      console.error('Sports Monk API key not configured');
      return res.json({ data: [] });
    }

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const startDate = today.toISOString().split('T')[0];
    const endDate = nextWeek.toISOString().split('T')[0];

    const url = `${CRICKET_BASE_URL}/fixtures?api_token=${SPORTS_MONK_API_KEY}&filter[starts_between]=${startDate},${endDate}&include=localteam,visitorteam,venue&sort=starting_at`;
    const data = await makeRequest(url);
    
    console.log(`Cricket upcoming matches: ${data?.data?.length || 0} matches found`);
    res.json(data || { data: [] });
  } catch (error) {
    console.error('Error fetching upcoming cricket matches:', error);
    // Return empty array instead of error
    res.json({ data: [] });
  }
};

// Get live football scores (limited leagues in free tier)
export const getFootballLiveScores = async (req, res) => {
  try {
    if (!SPORTS_MONK_API_KEY) {
      console.error('Sports Monk API key not configured');
      return res.json({ data: [] });
    }

    // Free tier has limited leagues - Scottish Premiership (237) and Danish Superliga (271)
    const url = `${FOOTBALL_BASE_URL}/livescores/inplay?api_token=${SPORTS_MONK_API_KEY}&include=participants,league`;
    const data = await makeRequest(url);
    
    console.log(`Football live scores: ${data?.data?.length || 0} matches found`);
    res.json(data || { data: [] });
  } catch (error) {
    console.error('Error fetching football live scores:', error);
    // Return empty array instead of error
    res.json({ data: [] });
  }
};

// Get upcoming football matches
export const getFootballUpcomingMatches = async (req, res) => {
  try {
    if (!SPORTS_MONK_API_KEY) {
      console.error('Sports Monk API key not configured');
      return res.json({ data: [] });
    }

    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    const startDate = today.toISOString().split('T')[0];
    const endDate = nextWeek.toISOString().split('T')[0];

    // Football API v3 uses different endpoint structure
    const url = `${FOOTBALL_BASE_URL}/fixtures/date/${startDate}?api_token=${SPORTS_MONK_API_KEY}&include=participants,league`;
    const data = await makeRequest(url);
    
    // Filter for upcoming matches within date range
    if (data && data.data && Array.isArray(data.data)) {
      const filtered = data.data.filter(match => {
        const matchDate = match.starting_at || match.date;
        return matchDate && matchDate >= startDate && matchDate <= endDate;
      });
      data.data = filtered;
    }
    
    console.log(`Football upcoming matches: ${data?.data?.length || 0} matches found`);
    res.json(data || { data: [] });
  } catch (error) {
    console.error('Error fetching upcoming football matches:', error);
    // Return empty array instead of error
    res.json({ data: [] });
  }
};

