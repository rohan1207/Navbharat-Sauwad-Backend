// Utility to generate meta HTML for social media previews
// This is extracted from socialPreview routes for reuse

const getPlainText = (html) => {
  if (!html) return '';
  return String(html)
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Helper to ensure absolute image URL with HTTPS and proper formatting
export const getAbsoluteImageUrl = (imgUrl, baseUrl) => {
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
        // ULTRA-FAST loading: 600x315, JPEG format, quality 60, progressive, auto gravity
        // Minimal size = instant loading for iOS/Android WhatsApp
        absoluteImage = `${base}w_600,h_315,c_fill,g_auto,q_60,f_jpg,fl_progressive,dpr_1/${rest}`;
      } else {
        // Ensure HTTPS
        absoluteImage = absoluteImage.replace('http://', 'https://');
        // Force JPEG format for iOS/Android compatibility and faster loading
        absoluteImage = absoluteImage.replace(/f_(auto|webp)/g, 'f_jpg');
        // If no format specified, add f_jpg
        if (!absoluteImage.includes('f_')) {
          const parts = absoluteImage.split('/image/upload/');
          if (parts.length === 2) {
            absoluteImage = `${parts[0]}/image/upload/f_jpg/${parts[1]}`;
          }
        }
        // Force smaller dimensions and lower quality for existing transformations
        absoluteImage = absoluteImage.replace(/w_\d+/g, 'w_600');
        absoluteImage = absoluteImage.replace(/h_\d+/g, 'h_315');
        absoluteImage = absoluteImage.replace(/q_\d+/g, 'q_60');
        // Add progressive and dpr_1 if not present
        if (!absoluteImage.includes('fl_progressive')) {
          absoluteImage = absoluteImage.replace(/(\/image\/upload\/)([^\/]+)(\/)/, (match, prefix, transforms, suffix) => {
            return `${prefix}${transforms},fl_progressive,dpr_1${suffix}`;
          });
        }
      }
    }
  }
  
  // Force JPEG format for all Cloudinary images
  if (absoluteImage.includes('cloudinary.com') && absoluteImage.includes('/image/upload/')) {
    absoluteImage = absoluteImage.replace(/f_(auto|webp)/g, 'f_jpg');
    if (!absoluteImage.includes('f_')) {
      const parts = absoluteImage.split('/image/upload/');
      if (parts.length === 2) {
        absoluteImage = `${parts[0]}/image/upload/f_jpg/${parts[1]}`;
      }
    }
  }
  
  return absoluteImage;
};

// Helper to optimize e-paper images for vertical share cards
export const getEpaperImageUrl = (imgUrl, baseUrl) => {
  if (!imgUrl || imgUrl.trim() === '') {
    const logoBaseUrl = baseUrl || process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';
    return `${logoBaseUrl}/logo1.png`;
  }
  
  let absoluteImage = imgUrl.trim();
  
  if (absoluteImage.includes('cloudinary.com')) {
    if (absoluteImage.includes('/image/upload/')) {
      const uploadMatch = absoluteImage.match(/(https?:\/\/res\.cloudinary\.com\/[^\/]+\/image\/upload\/)(.*)/);
      if (uploadMatch) {
        const base = uploadMatch[1];
        const rest = uploadMatch[2];
        
        if (!rest.includes('w_') || !rest.includes('h_')) {
          absoluteImage = `${base}w_600,h_800,c_fit,g_auto,q_60,f_jpg,fl_progressive,dpr_1/${rest}`;
        } else {
          absoluteImage = absoluteImage.replace(/f_(auto|webp)/g, 'f_jpg');
          if (!absoluteImage.includes('f_')) {
            const parts = absoluteImage.split('/image/upload/');
            if (parts.length === 2) {
              absoluteImage = `${parts[0]}/image/upload/f_jpg/${parts[1]}`;
            }
          }
          absoluteImage = absoluteImage.replace(/w_\d+/g, 'w_600');
          absoluteImage = absoluteImage.replace(/h_\d+/g, 'h_800');
          absoluteImage = absoluteImage.replace(/q_\d+/g, 'q_60');
          if (!absoluteImage.includes('fl_progressive')) {
            absoluteImage = absoluteImage.replace(/(\/image\/upload\/)([^\/]+)(\/)/, (match, prefix, transforms, suffix) => {
              return `${prefix}${transforms},fl_progressive,dpr_1${suffix}`;
            });
          }
        }
      }
    }
    
    if (absoluteImage.startsWith('http://')) {
      absoluteImage = absoluteImage.replace('http://', 'https://');
    }
    
    return absoluteImage;
  }
  
  if (!absoluteImage.startsWith('http://') && !absoluteImage.startsWith('https://')) {
    const effectiveBaseUrl = baseUrl || process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';
    absoluteImage = `${effectiveBaseUrl}${absoluteImage.startsWith('/') ? '' : '/'}${absoluteImage}`;
  }
  
  if (absoluteImage.startsWith('http://')) {
    absoluteImage = absoluteImage.replace('http://', 'https://');
  }
  
  if (absoluteImage.includes('localhost') || absoluteImage.includes('127.0.0.1')) {
    const logoBaseUrl = baseUrl || process.env.FRONTEND_URL || process.env.SITE_URL || 'https://navmanchnews.com';
    return `${logoBaseUrl}/logo1.png`;
  }
  
  return absoluteImage;
};

// Helper to generate cropped Cloudinary URL for mapped sections
export const getCroppedImageUrl = (pageImageUrl, section) => {
  if (!pageImageUrl || !section) return pageImageUrl;
  
  if (!pageImageUrl.includes('cloudinary.com')) {
    return pageImageUrl;
  }
  
  try {
    const uploadIndex = pageImageUrl.indexOf('/image/upload/');
    if (uploadIndex === -1) return pageImageUrl;
    
    const baseUrl = pageImageUrl.substring(0, uploadIndex + '/image/upload'.length);
    const afterUpload = pageImageUrl.substring(uploadIndex + '/image/upload/'.length);
    
    const transformations = [
      `c_crop`,
      `w_${Math.round(section.width || 0)}`,
      `h_${Math.round(section.height || 0)}`,
      `x_${Math.round(section.x || 0)}`,
      `y_${Math.round(section.y || 0)}`,
      `q_60`,
      `f_jpg`
    ].join(',');
    
    return `${baseUrl}/${transformations}/${afterUpload}`;
  } catch (error) {
    console.error('Error generating cropped URL:', error);
    return pageImageUrl;
  }
};

// Generate meta HTML for news articles
export const generateArticleMetaHtml = (article, baseUrl) => {
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
  
  if (!imageUrl || imageUrl === '') {
    imageUrl = `${baseUrl}/logo1.png`;
  }
  
  const absoluteImage = getAbsoluteImageUrl(imageUrl, baseUrl);
  const articleId = article._id ? String(article._id) : (article.id ? String(article.id) : '');
  const articleUrl = `${baseUrl}/news/${articleId}`;
  const siteName = 'नव मंच - Nav Manch';
  
  const safeTitle = escapeHtml(article.title);
  const safeDescription = escapeHtml(description);
  
  return `<!DOCTYPE html>
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
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="315">
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
};

// Generate meta HTML for e-paper sections
export const generateEpaperSectionMetaHtml = (epaper, page, section, baseUrl) => {
  // Get image - use cropped section if available
  let imageUrl = '';
  if (section && section.x !== undefined && section.y !== undefined && 
      section.width !== undefined && section.height !== undefined && 
      page.image) {
    const croppedUrl = getCroppedImageUrl(page.image, section);
    imageUrl = croppedUrl;
  } else {
    imageUrl = page.image || epaper.thumbnail || '';
  }
  
  if (!imageUrl || imageUrl.trim() === '') {
    imageUrl = `${baseUrl}/logo1.png`;
  }
  
  // Optimize image URL
  let absoluteImage;
  if (imageUrl.includes('cloudinary.com') && imageUrl.includes('c_crop')) {
    absoluteImage = imageUrl.replace('http://', 'https://');
    if (!absoluteImage.includes('fl_progressive')) {
      absoluteImage = absoluteImage.replace(/(\/image\/upload\/)([^\/]+)(\/)/, (match, prefix, transforms, suffix) => {
        return `${prefix}${transforms},fl_progressive,dpr_1${suffix}`;
      });
    }
    absoluteImage = absoluteImage.replace(/w_\d+/g, (match) => {
      const width = parseInt(match.replace('w_', ''));
      return width > 600 ? 'w_600' : match;
    });
    absoluteImage = absoluteImage.replace(/h_\d+/g, (match) => {
      const height = parseInt(match.replace('h_', ''));
      return height > 315 ? 'h_315' : match;
    });
  } else {
    absoluteImage = getAbsoluteImageUrl(imageUrl, baseUrl);
  }
  
  // Clean section title
  let sectionTitle = section?.title || '';
  if (!sectionTitle || sectionTitle.trim() === '' || sectionTitle.toLowerCase() === 'untitled') {
    sectionTitle = 'बातमी विभाग';
  } else {
    sectionTitle = sectionTitle.trim();
  }
  
  // Clean e-paper title
  let epaperTitle = epaper.title || 'ई-पेपर';
  epaperTitle = epaperTitle
    .replace(/\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/gi, '')
    .replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/g, '')
    .replace(/\s*-\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\s*-\s*पृष्ठ\s*\d+/gi, '')
    .replace(/\s*-\s*Page\s*\d+/gi, '')
    .trim();
  
  const title = `${sectionTitle} - ${epaperTitle}`;
  const description = `${epaperTitle} - पृष्ठ ${page.pageNo}`;
  
  // Use IDs in URLs
  let epaperIdentifier;
  if (epaper.slug && epaper.slug.trim() !== '' && epaper.slug.toLowerCase() !== 'untitled') {
    epaperIdentifier = epaper.slug;
  } else {
    epaperIdentifier = epaper.id !== undefined ? String(epaper.id) : (epaper._id ? String(epaper._id) : '');
  }
  
  let sectionIdentifier;
  if (section) {
    if (section.id !== undefined && section.id !== null) {
      sectionIdentifier = String(section.id);
    } else if (section._id) {
      sectionIdentifier = String(section._id);
    } else {
      sectionIdentifier = '';
    }
  } else {
    sectionIdentifier = '';
  }
  
  const sectionUrl = `${baseUrl}/epaper/${epaperIdentifier}/page/${page.pageNo}/section/${sectionIdentifier}`;
  const siteName = 'नव मंच - Nav Manch';
  
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  
  return `<!DOCTYPE html>
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
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="315">
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
};

// Generate meta HTML for complete e-paper
export const generateEpaperMetaHtml = (epaper, baseUrl) => {
  const imageUrl = epaper.pages?.[0]?.image || epaper.thumbnail || '';
  const absoluteImage = getEpaperImageUrl(imageUrl, baseUrl);
  
  // Clean title
  let epaperTitle = epaper.title || 'नव मंच';
  epaperTitle = epaperTitle
    .replace(/\s*-\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/gi, '')
    .replace(/\s*-\s*\d{1,2}\/\d{1,2}\/\d{4}/g, '')
    .replace(/\s*-\s*\d{4}-\d{2}-\d{2}/g, '')
    .replace(/\s*-\s*पृष्ठ\s*\d+/gi, '')
    .replace(/\s*-\s*Page\s*\d+/gi, '')
    .trim();
  
  const title = epaperTitle || 'नव मंच';
  const description = `${title} | navmanchnews.com`;
  
  // Use ID for URL
  let epaperIdentifier;
  if (epaper.slug && epaper.slug.trim() !== '' && epaper.slug.toLowerCase() !== 'untitled') {
    epaperIdentifier = epaper.slug;
  } else {
    epaperIdentifier = epaper.id !== undefined ? String(epaper.id) : (epaper._id ? String(epaper._id) : '');
  }
  
  const epaperUrl = `${baseUrl}/epaper/${epaperIdentifier}`;
  const siteName = 'नव मंच - Nav Manch';
  
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  
  return `<!DOCTYPE html>
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
  <meta property="og:image:width" content="600">
  <meta property="og:image:height" content="800">
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
};

