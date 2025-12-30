import express from 'express';
import {
  getCricketLiveScores,
  getCricketUpcomingMatches,
  getFootballLiveScores,
  getFootballUpcomingMatches
} from '../controllers/sportsController.js';

const router = express.Router();

// Cricket routes
router.get('/cricket/livescores', getCricketLiveScores);
router.get('/cricket/upcoming', getCricketUpcomingMatches);

// Football routes
router.get('/football/livescores', getFootballLiveScores);
router.get('/football/upcoming', getFootballUpcomingMatches);

export default router;

