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
  
  // Optimize Cloudinary URLs for preview cards (1200x630 is optimal)
  if (absoluteImage.includes('cloudinary.com') && absoluteImage.includes('/image/upload/')) {
    // Check if transformations already exist
    const uploadMatch = absoluteImage.match(/(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.*)/);
    if (uploadMatch) {
      const base = uploadMatch[1];
      const rest = uploadMatch[2];
      
      // If no transformations or simple ones, add optimal preview size
      if (!rest.includes('w_') || !rest.includes('h_')) {
        // Add transformation for optimal preview size
        absoluteImage = `${base}w_1200,h_630,c_fill,q_auto,f_auto/${rest}`;
      } else {
        // Ensure HTTPS
        absoluteImage = absoluteImage.replace('http://', 'https://');
      }
    }
  }
  
  return absoluteImage;
};

// Serve HTML with meta tags for news articles
router.get('/news/:id', async (req, res) => {
  try {
    const userAgent = req.headers['user-agent'] || '';
    const { id } = req.params;
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanch.com';
    
    // Only serve HTML to crawlers, redirect others to React app
    if (!isCrawler(userAgent)) {
      return res.redirect(`${baseUrl}/news/${id}`);
    }
    
    // Fetch article - include all image fields
    const article = await Article.findById(id)
      .populate('categoryId', 'name')
      .select('title summary content featuredImage imageGallery createdAt publishedAt');
    
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
    console.log('Article preview image:', {
      articleId: id,
      featuredImage: article.featuredImage,
      imageGallery: article.imageGallery,
      selected: imageUrl,
      finalImage: absoluteImage,
      hasCloudinary: absoluteImage.includes('cloudinary.com'),
      isValid: absoluteImage.startsWith('https://'),
      userAgent: userAgent.substring(0, 50)
    });
    
    const articleUrl = `${baseUrl}/news/${id}`;
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
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
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
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanch.com';
    
    // Only serve HTML to crawlers, redirect others to React app
    if (!isCrawler(userAgent)) {
      return res.redirect(`${baseUrl}/epaper/${id}/page/${pageNo}/section/${sectionId}`);
    }
    
    // Fetch e-paper - EPaper uses 'id' (number) not '_id' (ObjectId)
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('title date pages thumbnail');
    } else {
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('title date pages thumbnail');
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
    
    // Find the section
    const section = page.news?.find(s => {
      const sId = s.id !== undefined ? s.id : s._id;
      return String(sId) === String(sectionId);
    });
    
    // Generate cropped image URL if section exists
    let imageUrl = page.image || epaper.thumbnail || '';
    
    // If no page image, use default logo
    if (!imageUrl || imageUrl.trim() === '') {
      imageUrl = `${baseUrl}/logo1.png`;
    }
    
    // Generate Cloudinary cropped URL if section exists and page has Cloudinary image
    if (section && section.width && section.height && page.image && page.image.includes('cloudinary.com')) {
      try {
        const uploadIndex = page.image.indexOf('/image/upload/');
        if (uploadIndex !== -1) {
          const baseUrlCloudinary = page.image.substring(0, uploadIndex + '/image/upload'.length);
          const afterUpload = page.image.substring(uploadIndex + '/image/upload/'.length);
          const transformations = [
            `c_crop`,
            `w_${Math.round(section.width)}`,
            `h_${Math.round(section.height)}`,
            `x_${Math.round(section.x)}`,
            `y_${Math.round(section.y)}`,
            `q_auto:best`,
            `f_auto`
          ].join(',');
          imageUrl = `${baseUrlCloudinary}/${transformations}/${afterUpload}`;
        }
      } catch (error) {
        console.error('Error generating cropped URL:', error);
        // Fallback to full page image
        imageUrl = page.image || epaper.thumbnail || `${baseUrl}/logo1.png`;
      }
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
    const sectionTitle = section?.title || 'बातमी विभाग';
    const epaperTitle = epaper.title || 'ई-पेपर';
    const title = `${sectionTitle} - ${epaperTitle}`;
    const description = section?.content 
      ? getPlainText(section.content).substring(0, 200)
      : `${epaperTitle} - पृष्ठ ${pageNo}`;
    
    const sectionUrl = `${baseUrl}/epaper/${id}/page/${pageNo}/section/${sectionId}`;
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
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
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
    const baseUrl = process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanch.com';
    
    // Only serve HTML to crawlers, redirect others to React app
    if (!isCrawler(userAgent)) {
      return res.redirect(`${baseUrl}/epaper/${id}`);
    }
    
    // Fetch e-paper - EPaper uses 'id' (number) not '_id' (ObjectId)
    let epaper;
    if (mongoose.Types.ObjectId.isValid(id)) {
      epaper = await Epaper.findById(id).select('title date thumbnail pages');
    } else {
      epaper = await Epaper.findOne({ id: parseInt(id) }).select('title date thumbnail pages');
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
    
    // Get image (use first page image or thumbnail)
    const imageUrl = epaper.pages?.[0]?.image || epaper.thumbnail || `${baseUrl}/logo1.png`;
    const absoluteImage = getAbsoluteImageUrl(imageUrl, baseUrl);
    
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
    
    // Get title and description
    const epaperTitle = epaper.title || 'ई-पेपर';
    const dateStr = epaper.date ? new Date(epaper.date).toLocaleDateString('mr-IN') : '';
    const title = `${epaperTitle} - नव मंच`;
    const description = `${epaperTitle} - ${dateStr}`;
    
    const epaperUrl = `${baseUrl}/epaper/${id}`;
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
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
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

