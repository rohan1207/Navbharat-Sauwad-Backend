import express from 'express';
import mongoose from 'mongoose';
import Article from '../models/Article.js';
import Epaper from '../models/Epaper.js';
import { 
  generateArticleMetaHtml, 
  generateEpaperSectionMetaHtml, 
  generateEpaperMetaHtml,
  getAbsoluteImageUrl,
  getEpaperImageUrl,
  getCroppedImageUrl
} from '../utils/metaHtmlGenerator.js';

const router = express.Router();

// In-memory cache for instant meta tag responses (critical for iOS)
// Cache key: route + id, value: { html, timestamp }
const metaCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const MAX_CACHE_SIZE = 1000; // Limit cache size

// Clean old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of metaCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      metaCache.delete(key);
    }
  }
  // If cache is too large, remove oldest entries
  if (metaCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(metaCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, metaCache.size - MAX_CACHE_SIZE);
    toRemove.forEach(([key]) => metaCache.delete(key));
  }
}, 60 * 60 * 1000); // Clean every hour

// Helper to detect if request is from a crawler/bot
const isCrawler = (userAgent) => {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return /facebookexternalhit|whatsapp|twitterbot|linkedinbot|slackbot|telegrambot|applebot|bingbot|googlebot|baiduspider|yandex|sogou|duckduckbot|embedly|quora|showyoubot|outbrain|pinterest|vkShare|W3C_Validator/i.test(ua);
};

// Helper to get plain text from HTML
const getPlainText = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Re-export for backward compatibility (functions moved to metaHtmlGenerator)
export { getAbsoluteImageUrl, getEpaperImageUrl, getCroppedImageUrl } from '../utils/metaHtmlGenerator.js';

// Serve HTML with meta tags for news articles
router.get('/news/:id', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const { id } = req.params;
    // Use the frontend origin from the proxy header, or fallback to env or request origin
    const baseUrl = req.headers['x-frontend-origin'] || 
                    process.env.FRONTEND_URL || 
                    process.env.SITE_URL || 
                    (req.protocol + '://' + req.get('host')) ||
                    'https://navmanchnews.com';
    
    // Only serve HTML to crawlers, redirect others to React app
    if (!isCrawler(userAgent)) {
      return res.redirect(`${baseUrl}/news/${id}`);
    }
    
    // Check cache first (instant response for iOS)
    const cacheKey = `news:${id}:${baseUrl}`;
    const cached = metaCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`⚡ [CACHE HIT] Instant meta tags for news/${id}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      return res.send(cached.html);
    }
    
    // Fetch article - include metaHtml field for instant serving
    let article;
    if (mongoose.Types.ObjectId.isValid(id)) {
      article = await Article.findById(id)
        .populate('categoryId', 'name')
        .select('title summary content featuredImage imageGallery createdAt publishedAt slug metaHtml _id')
        .lean(); // Use lean() for 2-3x faster queries
    } else {
      article = await Article.findOne({ slug: id })
        .populate('categoryId', 'name')
        .select('title summary content featuredImage imageGallery createdAt publishedAt slug metaHtml _id')
        .lean(); // Use lean() for 2-3x faster queries
    }
    
    if (!article) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Article Not Found</title></head>
        <body><h1>Article not found</h1></body>
        </html>
      `);
    }
    
    // INSTANT: If pre-generated metaHtml exists, serve it immediately (zero latency)
    if (article.metaHtml && article.metaHtml.trim() !== '') {
      console.log(`⚡ [INSTANT] Serving pre-generated metaHtml for news/${id}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      return res.send(article.metaHtml); // INSTANT - just reading a string!
    }
    
    // Lazy generation: Generate on-the-fly for existing articles (non-blocking)
    console.log(`🔄 [LAZY GEN] Generating metaHtml on-the-fly for news/${id}`);
    const html = generateArticleMetaHtml(article, baseUrl);
    
    // Save it for next time (async, non-blocking - don't wait)
    Article.findByIdAndUpdate(article._id || id, { metaHtml: html })
      .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
    
    // Cache in memory for immediate future requests
    metaCache.set(cacheKey, { html, timestamp: Date.now() });
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours browser/CDN cache
    res.send(html);
  } catch (error) {
    console.error('Error generating news preview:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body><h1>Error loading article</h1></body>
      </html>
    `);
  }
});

// Serve HTML with meta tags for e-paper sections
router.get('/epaper/:id/page/:pageNo/section/:sectionId', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const { id, pageNo, sectionId } = req.params;
    // Use the frontend origin from the proxy header, or fallback to env or request origin
    const baseUrl = req.headers['x-frontend-origin'] || 
                    process.env.FRONTEND_URL || 
                    process.env.SITE_URL || 
                    (req.protocol + '://' + req.get('host')) ||
                    'https://navmanchnews.com';
    
    // Only serve HTML to crawlers, redirect others to React app
    if (!isCrawler(userAgent)) {
      return res.redirect(`${baseUrl}/epaper/${id}/page/${pageNo}/section/${sectionId}`);
    }
    
    // Check cache first (instant response for iOS)
    const cacheKey = `epaper-section:${id}:${pageNo}:${sectionId}:${baseUrl}`;
    const cached = metaCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`⚡ [CACHE HIT] Instant meta tags for epaper section ${id}/${pageNo}/${sectionId}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      return res.send(cached.html);
    }
    
    // Fetch e-paper - include pages for section lookup
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('title date pages thumbnail slug').lean();
    } else if (!isNaN(id)) {
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('title date pages thumbnail slug').lean();
    } else {
      epaper = await Epaper.findOne({ slug: id }).select('title date pages thumbnail slug').lean();
    }
    
    if (!epaper) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>E-Paper Not Found</title></head>
        <body><h1>E-Paper not found</h1></body>
        </html>
      `);
    }
    
    // Find the page
    const page = epaper.pages?.find(p => p.pageNo === parseInt(pageNo));
    if (!page) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Page Not Found</title></head>
        <body><h1>Page not found</h1></body>
        </html>
      `);
    }
    
    // Find the section by slug or ID
    const section = page.news?.find(s => {
      const sId = s.id !== undefined ? s.id : s._id;
      const sSlug = s.slug;
      // Match by slug first, then by ID
      return (sSlug && sSlug === sectionId) || String(sId) === String(sectionId);
    });
    
    // For sections, we generate on-the-fly (lazy generation)
    // Each section is unique, so storing in epaper.metaHtml wouldn't work
    console.log(`🔄 [LAZY GEN] Generating metaHtml on-the-fly for epaper section ${id}/${pageNo}/${sectionId}`);
    const html = generateEpaperSectionMetaHtml(epaper, page, section, baseUrl);
    
    // Cache in memory for immediate future requests
    metaCache.set(cacheKey, { html, timestamp: Date.now() });
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours browser/CDN cache
    res.send(html);
  } catch (error) {
    console.error('Error generating e-paper section preview:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body><h1>Error loading e-paper section</h1></body>
      </html>
    `);
  }
});

// Serve HTML with meta tags for complete e-paper
router.get('/epaper/:id', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const { id } = req.params;
    // Use the frontend origin from the proxy header, or fallback to env or request origin
    const baseUrl = req.headers['x-frontend-origin'] || 
                    process.env.FRONTEND_URL || 
                    process.env.SITE_URL || 
                    (req.protocol + '://' + req.get('host')) ||
                    'https://navmanchnews.com';
    
    // Only serve HTML to crawlers, redirect others to React app
    if (!isCrawler(userAgent)) {
      return res.redirect(`${baseUrl}/epaper/${id}`);
    }
    
    // Check cache first (instant response for iOS)
    const cacheKey = `epaper:${id}:${baseUrl}`;
    const cached = metaCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      console.log(`⚡ [CACHE HIT] Instant meta tags for epaper/${id}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      return res.send(cached.html);
    }
    
    // Fetch e-paper - include metaHtml field for instant serving
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('title date thumbnail pages slug metaHtml _id id').lean();
    } else if (!isNaN(id)) {
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('title date thumbnail pages slug metaHtml _id id').lean();
    } else {
      epaper = await Epaper.findOne({ slug: id }).select('title date thumbnail pages slug metaHtml _id id').lean();
    }
    
    if (!epaper) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head><title>E-Paper Not Found</title></head>
        <body><h1>E-Paper not found</h1></body>
        </html>
      `);
    }
    
    // INSTANT: If pre-generated metaHtml exists, serve it immediately (zero latency)
    if (epaper.metaHtml && epaper.metaHtml.trim() !== '') {
      console.log(`⚡ [INSTANT] Serving pre-generated metaHtml for epaper/${id}`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      return res.send(epaper.metaHtml); // INSTANT - just reading a string!
    }
    
    // Lazy generation: Generate on-the-fly for existing e-papers (non-blocking)
    console.log(`🔄 [LAZY GEN] Generating metaHtml on-the-fly for epaper/${id}`);
    const html = generateEpaperMetaHtml(epaper, baseUrl);
    
    // Save it for next time (async, non-blocking - don't wait)
    const epaperId = epaper._id || (epaper.id ? { id: parseInt(epaper.id) } : id);
    Epaper.findByIdAndUpdate(epaper._id || epaperId, { metaHtml: html })
      .catch(err => console.error('Error saving metaHtml (non-critical):', err.message));
    
    // Cache in memory for immediate future requests
    metaCache.set(cacheKey, { html, timestamp: Date.now() });
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours browser/CDN cache
    res.send(html);
  } catch (error) {
    console.error('Error generating e-paper preview:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body><h1>Error loading e-paper</h1></body>
      </html>
    `);
  }
});

// Export cache for clearing when articles/epapers are updated
export const clearMetaCache = (type, id) => {
  // Clear all cache entries for this article/epaper
  for (const key of metaCache.keys()) {
    if (key.includes(`${type}:${id}`)) {
      metaCache.delete(key);
      console.log(`🗑️  [CACHE CLEAR] Cleared meta cache for ${key}`);
    }
  }
};

export default router;

