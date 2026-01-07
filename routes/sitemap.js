import express from 'express';
import Article from '../models/Article.js';
import Epaper from '../models/Epaper.js';

const router = express.Router();

// Base URL for the site
const BASE_URL = process.env.FRONTEND_URL || 'https://navmanchnews.com';

// Generate sitemap XML
router.get('/sitemap.xml', async (req, res) => {
  try {
    const urls = [];

    // Static pages
    urls.push({
      loc: `${BASE_URL}/`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '1.0'
    });

    urls.push({
      loc: `${BASE_URL}/epaper`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '0.9'
    });

    urls.push({
      loc: `${BASE_URL}/epaper`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '0.9'
    });

    urls.push({
      loc: `${BASE_URL}/gallery`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: '0.8'
    });

    urls.push({
      loc: `${BASE_URL}/blogs`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '0.8'
    });

    urls.push({
      loc: `${BASE_URL}/articles`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '0.8'
    });

    urls.push({
      loc: `${BASE_URL}/shorts`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'daily',
      priority: '0.7'
    });

    urls.push({
      loc: `${BASE_URL}/events`,
      lastmod: new Date().toISOString().split('T')[0],
      changefreq: 'weekly',
      priority: '0.7'
    });

    // Published articles
    try {
      const articles = await Article.find({ 
        status: 'published',
        slug: { $exists: true, $ne: null }
      })
        .select('slug updatedAt publishedAt')
        .sort({ publishedAt: -1 })
        .limit(5000); // Limit to prevent huge sitemaps

      articles.forEach(article => {
        if (article.slug) {
          urls.push({
            loc: `${BASE_URL}/news/${article.slug}`,
            lastmod: (article.updatedAt || article.publishedAt || new Date()).toISOString().split('T')[0],
            changefreq: 'weekly',
            priority: '0.8'
          });
        }
      });
    } catch (error) {
      console.error('Error fetching articles for sitemap:', error);
      // Continue even if articles fail
    }

    // Epapers
    try {
      const epapers = await Epaper.find()
        .select('date updatedAt')
        .sort({ date: -1 })
        .limit(100); // Limit recent epapers

      epapers.forEach(epaper => {
        if (epaper.date) {
          const dateStr = epaper.date.toISOString().split('T')[0];
          urls.push({
            loc: `${BASE_URL}/epaper/${dateStr}`,
            lastmod: (epaper.updatedAt || epaper.date).toISOString().split('T')[0],
            changefreq: 'daily',
            priority: '0.7'
          });
        }
      });
    } catch (error) {
      console.error('Error fetching epapers for sitemap:', error);
      // Continue even if epapers fail
    }

    // Generate XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(url => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.send(xml);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    // Return a basic fallback sitemap
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${BASE_URL}/epaper</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
</urlset>`;
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.status(200).send(fallbackSitemap);
  }
});

// Helper function to escape XML special characters
function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export default router;







