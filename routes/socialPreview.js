import express from 'express';
import mongoose from 'mongoose';
import Article from '../models/Article.js';
import Epaper from '../models/Epaper.js';

const router = express.Router();

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

// Helper to ensure absolute image URL with HTTPS and proper formatting
const getAbsoluteImageUrl = (imgUrl, baseUrl) => {
  if (!imgUrl || imgUrl.trim() === '') {
    return `${baseUrl}/logo1.png`;
  }
  
  let absoluteImage = imgUrl.trim();
  
  // If relative URL, make it absolute
  if (!absoluteImage.startsWith('http://') && !absoluteImage.startsWith('https://')) {
    absoluteImage = `${baseUrl}${absoluteImage.startsWith('/') ? '' : '/'}${absoluteImage}`;
  }
  
  // Force HTTPS (required by WhatsApp/Facebook)
  if (absoluteImage.startsWith('http://')) {
    absoluteImage = absoluteImage.replace('http://', 'https://');
  }
  
  // Optimize Cloudinary URLs for preview cards
  if (absoluteImage.includes('cloudinary.com') && absoluteImage.includes('/image/upload/')) {
    // Check if transformations already exist
    const uploadMatch = absoluteImage.match(/(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.*)/);
    if (uploadMatch) {
      const base = uploadMatch[1];
      const rest = uploadMatch[2];
      
      // If no transformations or simple ones, add optimal preview size
      if (!rest.includes('w_') || !rest.includes('h_')) {
        // Default: 1600x840 for articles (landscape) - larger for better share cards
        // For e-papers, we'll use vertical format in the e-paper route
        absoluteImage = `${base}w_1600,h_840,c_fill,q_auto,f_auto/${rest}`;
      } else {
        // Ensure HTTPS
        absoluteImage = absoluteImage.replace('http://', 'https://');
      }
    }
  }
  
  return absoluteImage;
};

// Helper to optimize e-paper images for vertical share cards
const getEpaperImageUrl = (imgUrl, baseUrl) => {
  if (!imgUrl || imgUrl.trim() === '') {
    // Use the provided baseUrl (which comes from the request), or fallback
    const logoBaseUrl = baseUrl || process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';
    return `${logoBaseUrl}/logo1.png`;
  }
  
  let absoluteImage = imgUrl.trim();
  
  // If it's already a Cloudinary URL (most common case), use it directly
  if (absoluteImage.includes('cloudinary.com')) {
    // Optimize Cloudinary URLs for vertical e-paper pages (portrait orientation)
    if (absoluteImage.includes('/image/upload/')) {
      const uploadMatch = absoluteImage.match(/(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.*)/);
      if (uploadMatch) {
        const base = uploadMatch[1];
        const rest = uploadMatch[2];
        
        // If no transformations or simple ones, add optimal vertical size for e-paper
        if (!rest.includes('w_') || !rest.includes('h_')) {
        // Big vertical format: 1600x2133 for large, prominent share cards
        // This makes the newspaper page big and clearly visible
        absoluteImage = `${base}w_1600,h_2133,c_fit,q_auto,f_auto/${rest}`;
        }
      }
    }
    
    // Force HTTPS (required by WhatsApp/Facebook)
    if (absoluteImage.startsWith('http://')) {
      absoluteImage = absoluteImage.replace('http://', 'https://');
    }
    
    return absoluteImage;
  }
  
  // If relative URL, make it absolute using baseUrl
  if (!absoluteImage.startsWith('http://') && !absoluteImage.startsWith('https://')) {
    const effectiveBaseUrl = baseUrl || process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';
    absoluteImage = `${effectiveBaseUrl}${absoluteImage.startsWith('/') ? '' : '/'}${absoluteImage}`;
  }
  
  // Force HTTPS (required by WhatsApp/Facebook)
  if (absoluteImage.startsWith('http://')) {
    absoluteImage = absoluteImage.replace('http://', 'https://');
  }
  
  // Don't use localhost URLs for share cards - crawlers can't access them
  if (absoluteImage.includes('localhost') || absoluteImage.includes('127.0.0.1')) {
    // Fallback to logo using baseUrl or production URL
    const logoBaseUrl = baseUrl || process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';
    return `${logoBaseUrl}/logo1.png`;
  }
  
  return absoluteImage;
};

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
    
    // Fetch article by slug or ID - include all image fields
    let article;
    if (mongoose.Types.ObjectId.isValid(id)) {
      article = await Article.findById(id)
        .populate('categoryId', 'name')
        .select('title summary content featuredImage imageGallery createdAt publishedAt slug');
    } else {
      article = await Article.findOne({ slug: id })
        .populate('categoryId', 'name')
        .select('title summary content featuredImage imageGallery createdAt publishedAt slug');
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
    
    // Get description
    const description = article.summary || 
      (article.content ? getPlainText(article.content).substring(0, 200) : '') ||
      article.title || '';
    
    // Get image - prioritize featuredImage, then imageGallery, then default
    let imageUrl = '';
    
    if (article.featuredImage && article.featuredImage.trim() !== '') {
      imageUrl = article.featuredImage.trim();
    } else if (article.imageGallery && article.imageGallery.length > 0) {
      const firstImage = article.imageGallery.find(img => img && img.trim() !== '');
      if (firstImage) {
        imageUrl = firstImage.trim();
      }
    }
    
    // If still no image, use default logo
    if (!imageUrl || imageUrl === '') {
      imageUrl = `${baseUrl}/logo1.png`;
    }
    
    // Get properly formatted absolute image URL
    const absoluteImage = getAbsoluteImageUrl(imageUrl, baseUrl);
    
    // Log for debugging
    console.log('📰 [SOCIAL PREVIEW] Article preview image:', {
      articleId: id,
      articleTitle: article.title?.substring(0, 50),
      featuredImage: article.featuredImage ? article.featuredImage.substring(0, 80) : 'NONE',
      imageGalleryCount: article.imageGallery?.length || 0,
      selectedImageUrl: imageUrl ? imageUrl.substring(0, 80) : 'NONE',
      finalAbsoluteImage: absoluteImage.substring(0, 100),
      hasCloudinary: absoluteImage.includes('cloudinary.com'),
      isLogoFallback: absoluteImage.includes('logo1.png'),
      isValid: absoluteImage.startsWith('https://'),
      userAgent: userAgent.substring(0, 50)
    });
    
    // Warn if using logo fallback
    if (absoluteImage.includes('logo1.png')) {
      console.warn('⚠️  [SOCIAL PREVIEW] Using logo fallback - article has no image!', {
        articleId: id,
        title: article.title
      });
    }
    
    // Always use article ID in URL (not slug) for cleaner, more trustworthy URLs
    const articleId = article._id ? String(article._id) : id;
    const articleUrl = `${baseUrl}/news/${articleId}`;
    const siteName = 'नव मंच - Nav Manch';
    
    // Escape HTML entities properly
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    const safeTitle = escapeHtml(article.title);
    const safeDescription = escapeHtml(description);
    
    // Generate HTML with meta tags
    const html = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="title" content="${safeTitle}">
  <meta name="description" content="${safeDescription}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${absoluteImage}">
  <meta property="og:image:secure_url" content="${absoluteImage}">
  <meta property="og:image:width" content="1600">
  <meta property="og:image:height" content="840">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="mr_IN">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${articleUrl}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${absoluteImage}">
  <meta name="twitter:image:src" content="${absoluteImage}">
  
  <!-- Canonical -->
  <link rel="canonical" href="${articleUrl}">
  
  <!-- Redirect to actual React app (only for non-crawlers) -->
  <script>
    if (!navigator.userAgent.match(/facebookexternalhit|whatsapp|twitterbot|linkedinbot/i)) {
      window.location.href = "${articleUrl}";
    }
  </script>
</head>
<body>
  <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <img src="${absoluteImage}" alt="${safeTitle}" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 8px;">
    <p><a href="${articleUrl}">Read full article</a></p>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
    
    // Fetch e-paper - supports slug or ID
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('title date pages thumbnail slug');
    } else if (!isNaN(id)) {
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('title date pages thumbnail slug');
    } else {
      epaper = await Epaper.findOne({ slug: id }).select('title date pages thumbnail slug');
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
    
    // Generate cropped image URL if section exists
    let imageUrl = page.image || epaper.thumbnail || '';
    
    // If no page image, use default logo
    if (!imageUrl || imageUrl.trim() === '') {
      imageUrl = `${baseUrl}/logo1.png`;
    }
    
    // For section share cards, use the full page image instead of cropped section
    // This is more reliable and shows the complete context
    // The full page image works correctly (as seen in e-paper share cards)
    // No need to crop - just use the page image directly
    if (section) {
      // Always use full page image for section share cards
      imageUrl = page.image || epaper.thumbnail || imageUrl;
      console.log('Using full page image for section share card:', {
        pageImage: page.image,
        thumbnail: epaper.thumbnail,
        finalImage: imageUrl
      });
    }
    
    // Final fallback - ensure we always have a valid image URL
    if (!imageUrl || imageUrl.trim() === '') {
      imageUrl = `${baseUrl}/logo1.png`;
    }
    
    // Get properly formatted absolute image URL
    const absoluteImage = getAbsoluteImageUrl(imageUrl, baseUrl);
    
    // Log for debugging
    console.log('E-paper section preview image:', {
      epaperId: id,
      pageNo: pageNo,
      sectionId: sectionId,
      pageImage: page.image,
      thumbnail: epaper.thumbnail,
      selected: imageUrl,
      finalImage: absoluteImage,
      hasCloudinary: absoluteImage.includes('cloudinary.com'),
      isValid: absoluteImage.startsWith('https://'),
      userAgent: userAgent.substring(0, 50)
    });
    
    // Get title and description
    // Clean section title - remove "Untitled" and empty titles
    let sectionTitle = section?.title || '';
    if (!sectionTitle || sectionTitle.trim() === '' || sectionTitle.toLowerCase() === 'untitled') {
      sectionTitle = 'बातमी विभाग';
    } else {
      sectionTitle = sectionTitle.trim();
    }
    
    // Clean e-paper title - remove date patterns
    let epaperTitle = epaper.title || 'ई-पेपर';
    epaperTitle = epaperTitle
      .replace(/\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/gi, '')
      .replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/g, '')
      .replace(/\s*-\s*\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\s*-\s*पृष्ठ\s*\d+/gi, '')
      .replace(/\s*-\s*Page\s*\d+/gi, '')
      .trim();
    
    const title = `${sectionTitle} - ${epaperTitle}`;
    // Description without date duplication - just e-paper name and page number
    const description = `${epaperTitle} - पृष्ठ ${pageNo}`;
    
    // Use IDs in URLs for sections to avoid "Untitled" slugs and encoded characters
    // This provides cleaner, more trustworthy URLs
    // For e-paper, use slug if meaningful, otherwise use ID
    let epaperIdentifier;
    if (epaper.slug && epaper.slug.trim() !== '' && epaper.slug.toLowerCase() !== 'untitled') {
      epaperIdentifier = epaper.slug;
    } else {
      // Use ID for cleaner URL (avoid encoded characters)
      epaperIdentifier = epaper.id !== undefined ? String(epaper.id) : (epaper._id ? String(epaper._id) : id);
    }
    
    // Always use ID for sections (never use "Untitled" slug)
    let sectionIdentifier;
    if (section) {
      if (section.id !== undefined && section.id !== null) {
        sectionIdentifier = String(section.id);
      } else if (section._id) {
        sectionIdentifier = String(section._id);
      } else {
        sectionIdentifier = sectionId; // Fallback to what was in URL
      }
    } else {
      sectionIdentifier = sectionId;
    }
    
    const sectionUrl = `${baseUrl}/epaper/${epaperIdentifier}/page/${pageNo}/section/${sectionIdentifier}`;
    const siteName = 'नव मंच - Nav Manch';
    
    // Escape HTML entities properly
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    
    // Generate HTML with meta tags
    const html = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="title" content="${safeTitle}">
  <meta name="description" content="${safeDescription}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${sectionUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${absoluteImage}">
  <meta property="og:image:secure_url" content="${absoluteImage}">
  <meta property="og:image:width" content="1600">
  <meta property="og:image:height" content="840">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="mr_IN">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${sectionUrl}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${absoluteImage}">
  <meta name="twitter:image:src" content="${absoluteImage}">
  
  <!-- Canonical -->
  <link rel="canonical" href="${sectionUrl}">
  
  <!-- Redirect to actual React app (only for non-crawlers) -->
  <script>
    if (!navigator.userAgent.match(/facebookexternalhit|whatsapp|twitterbot|linkedinbot/i)) {
      window.location.href = "${sectionUrl}";
    }
  </script>
</head>
<body>
  <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <img src="${absoluteImage}" alt="${safeTitle}" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 8px;">
    <p><a href="${sectionUrl}">View section</a></p>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
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
    
    // Fetch e-paper - supports slug or ID
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('title date thumbnail pages slug');
    } else if (!isNaN(id)) {
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('title date thumbnail pages slug');
    } else {
      epaper = await Epaper.findOne({ slug: id }).select('title date thumbnail pages slug');
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
    
    // Get image (use first page image or thumbnail) - optimized for vertical share cards
    const imageUrl = epaper.pages?.[0]?.image || epaper.thumbnail || `${baseUrl}/logo1.png`;
    const absoluteImage = getEpaperImageUrl(imageUrl, baseUrl);
    
    // Log for debugging
    console.log('E-paper preview image:', {
      epaperId: id,
      thumbnail: epaper.thumbnail,
      firstPageImage: epaper.pages?.[0]?.image,
      finalImage: absoluteImage,
      hasCloudinary: absoluteImage.includes('cloudinary.com'),
      isValid: absoluteImage.startsWith('https://'),
      userAgent: userAgent.substring(0, 50)
    });
    
    // Get title - only e-paper name (no date, no page number)
    let epaperTitle = epaper.title || 'नव मंच';
    
    // Clean title - remove any date patterns that might be in the title
    // Remove patterns like " - 31 Dec 2025", " - 31/12/2025", " - पृष्ठ 1", etc.
    epaperTitle = epaperTitle
      .replace(/\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/gi, '') // Remove " - 31 Dec 2025"
      .replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/g, '') // Remove " - 31/12/2025"
      .replace(/\s*-\s*\d{4}-\d{2}-\d{2}/g, '') // Remove " - 2025-12-31"
      .replace(/\s*-\s*पृष्ठ\s*\d+/gi, '') // Remove " - पृष्ठ 1"
      .replace(/\s*-\s*Page\s*\d+/gi, '') // Remove " - Page 1"
      .trim();
    
    // Just the e-paper name for title
    const title = epaperTitle || 'नव मंच';
    // Description with site name only (no date duplication)
    const description = `${title} | navmanchnews.com`;
    
    // Use ID for cleaner URL (avoid encoded characters for better trust)
    // Only use slug if it's meaningful and not "Untitled"
    let epaperIdentifier;
    if (epaper.slug && epaper.slug.trim() !== '' && epaper.slug.toLowerCase() !== 'untitled') {
      epaperIdentifier = epaper.slug;
    } else {
      // Use ID for cleaner, more trustworthy URL
      epaperIdentifier = epaper.id !== undefined ? String(epaper.id) : (epaper._id ? String(epaper._id) : id);
    }
    const epaperUrl = `${baseUrl}/epaper/${epaperIdentifier}`;
    const siteName = 'नव मंच - Nav Manch';
    
    // Escape HTML entities properly
    const escapeHtml = (str) => {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    };
    
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);
    
    // Generate HTML with meta tags
    const html = `<!DOCTYPE html>
<html lang="mr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${safeTitle} | ${siteName}</title>
  <meta name="title" content="${safeTitle}">
  <meta name="description" content="${safeDescription}">
  
  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="article">
  <meta property="og:url" content="${epaperUrl}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDescription}">
  <meta property="og:image" content="${absoluteImage}">
  <meta property="og:image:secure_url" content="${absoluteImage}">
  <meta property="og:image:width" content="1600">
  <meta property="og:image:height" content="2133">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:site_name" content="${siteName}">
  <meta property="og:locale" content="mr_IN">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="${epaperUrl}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDescription}">
  <meta name="twitter:image" content="${absoluteImage}">
  <meta name="twitter:image:src" content="${absoluteImage}">
  
  <!-- Canonical -->
  <link rel="canonical" href="${epaperUrl}">
  
  <!-- Redirect to actual React app (only for non-crawlers) -->
  <script>
    if (!navigator.userAgent.match(/facebookexternalhit|whatsapp|twitterbot|linkedinbot/i)) {
      window.location.href = "${epaperUrl}";
    }
  </script>
</head>
<body>
  <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
    <h1>${safeTitle}</h1>
    <p>${safeDescription}</p>
    <img src="${absoluteImage}" alt="${safeTitle}" style="max-width: 100%; height: auto; margin: 20px 0; border-radius: 8px;">
    <p><a href="${epaperUrl}">View e-paper</a></p>
  </div>
</body>
</html>`;
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
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

export default router;

