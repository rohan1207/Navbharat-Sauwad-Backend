import express from 'express';
import Article from '../models/Article.js';
import Epaper from '../models/Epaper.js';

const router = express.Router();

router.get('/sitemap.xml', async (req, res) => {
  try {
    const baseUrl = 'https://navmanchnews.com';
    const currentDate = new Date().toISOString().split('T')[0];

    // Static pages
    const staticPages = [
      { url: '/', priority: '1.0', changefreq: 'daily' },
      { url: '/epaper', priority: '0.9', changefreq: 'daily' },
      { url: '/epaper2', priority: '0.9', changefreq: 'daily' },
      { url: '/gallery', priority: '0.8', changefreq: 'weekly' },
      { url: '/blogs', priority: '0.8', changefreq: 'daily' },
      { url: '/articles', priority: '0.8', changefreq: 'daily' },
      { url: '/shorts', priority: '0.7', changefreq: 'daily' },
      { url: '/events', priority: '0.7', changefreq: 'weekly' },
    ];

    // Fetch published articles (last 1000)
    const articles = await Article.find({ status: 'published' })
      .select('_id slug updatedAt createdAt publishedAt')
      .sort({ publishedAt: -1, createdAt: -1 })
      .limit(1000)
      .lean();

    // Fetch published e-papers (last 100)
    const epapers = await Epaper.find({ status: 'published' })
      .select('id _id slug date updatedAt')
      .sort({ date: -1 })
      .limit(100)
      .lean();

    // Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

    // Add static pages
    staticPages.forEach(page => {
      xml += `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    });

    // Add article pages
    articles.forEach(article => {
      const articleId = article._id.toString();
      const lastmod = (article.updatedAt || article.publishedAt || article.createdAt || new Date()).toISOString().split('T')[0];
      xml += `
  <url>
    <loc>${baseUrl}/news/${articleId}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    });

    // Add e-paper pages
    epapers.forEach(epaper => {
      const epaperId = epaper.id || epaper._id.toString();
      const lastmod = (epaper.date || epaper.updatedAt || new Date()).toISOString().split('T')[0];
      xml += `
  <url>
    <loc>${baseUrl}/epaper/${epaperId}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;
    });

    xml += `
</urlset>`;

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).send('Error generating sitemap');
  }
});

export default router;

