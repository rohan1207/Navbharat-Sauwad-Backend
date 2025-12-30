import Article from '../models/Article.js';
import EPaper from '../models/EPaper.js';

// Get meta tags for a given URL path
export const getMetaTags = async (req, res) => {
  try {
    const { path } = req.query;
    
    if (!path) {
      return res.status(400).json({ error: 'Path parameter is required' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'https://navmanch.com';
    const fullUrl = `${baseUrl}${path}`;
    
    // Extract article ID from path like /news/:id
    const newsMatch = path.match(/^\/news\/(.+)$/);
    const epaperMatch = path.match(/^\/epaper\/(.+)$/);
    
    let metaData = {
      title: 'नव मंच - मराठी वृत्तपत्र | Nav Manch',
      description: 'ताज्या बातम्या, ई-पेपर, लेख, ब्लॉग आणि घटनांची माहिती.',
      image: `${baseUrl}/logo1.png`,
      url: fullUrl,
      type: 'website'
    };

    // If it's a news article
    if (newsMatch) {
      const articleId = newsMatch[1];
      try {
        const article = await Article.findById(articleId)
          .populate('categoryId', 'name')
          .select('title summary content featuredImage image');
        
        if (article) {
          // Get plain text from HTML content (server-side)
          const getPlainText = (html) => {
            if (!html) return '';
            // Remove HTML tags and clean up whitespace
            return String(html)
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
          };

          const description = article.summary || 
            (article.content ? getPlainText(article.content).substring(0, 200) : '') ||
            article.title || '';
          
          const image = article.featuredImage || article.image || `${baseUrl}/logo1.png`;
          const absoluteImage = image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`;

          metaData = {
            title: `${article.title} | नव मंच`,
            description: description,
            image: absoluteImage,
            url: fullUrl,
            type: 'article'
          };
        }
      } catch (error) {
        console.error('Error fetching article for meta tags:', error);
      }
    }
    
    // If it's an e-paper
    if (epaperMatch) {
      const epaperId = epaperMatch[1];
      try {
        const epaper = await EPaper.findById(epaperId)
          .select('title date thumbnail');
        
        if (epaper) {
          const image = epaper.thumbnail || `${baseUrl}/logo1.png`;
          const absoluteImage = image.startsWith('http') ? image : `${baseUrl}${image.startsWith('/') ? '' : '/'}${image}`;

          metaData = {
            title: `${epaper.title} | नव मंच ई-पेपर`,
            description: `${epaper.title} - ${epaper.date ? new Date(epaper.date).toLocaleDateString('mr-IN') : ''}`,
            image: absoluteImage,
            url: fullUrl,
            type: 'article'
          };
        }
      } catch (error) {
        console.error('Error fetching epaper for meta tags:', error);
      }
    }

    res.json(metaData);
  } catch (error) {
    console.error('Error generating meta tags:', error);
    res.status(500).json({ error: 'Failed to generate meta tags' });
  }
};

