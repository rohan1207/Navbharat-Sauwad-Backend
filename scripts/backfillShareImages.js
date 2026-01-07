import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Article from '../models/Article.js';
import Epaper from '../models/Epaper.js';
import { getOptimizedUrl, getCroppedUrl } from '../services/cloudinaryService.js';

// Setup env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const BATCH_LIMIT = 200; // Limit to avoid hammering Cloudinary in one run

async function connectDB() {
  const mongoURI = process.env.MONGODB_URI;
  if (!mongoURI) {
    console.error('❌ MONGODB_URI is not defined in backend/.env');
    process.exit(1);
  }
  await mongoose.connect(mongoURI);
  console.log('✅ MongoDB connected for backfill');
}

async function backfillArticles() {
  console.log('\n=== Backfilling Article.shareImageUrl ===');

  const query = {
    $or: [{ shareImageUrl: { $exists: false } }, { shareImageUrl: '' }],
    featuredImage: { $ne: '' }
  };

  const articles = await Article.find(query).limit(BATCH_LIMIT);
  console.log(`Found ${articles.length} articles needing shareImageUrl`);

  for (const article of articles) {
    try {
      article.shareImageUrl = article.featuredImage;
      await article.save();
      console.log('✓ Article', article._id.toString(), '->', article.shareImageUrl);
    } catch (e) {
      console.warn('⚠️ Failed article', article._id.toString(), e.message);
    }
  }
}

async function backfillEpapers() {
  console.log('\n=== Backfilling Epaper.shareImageUrl and section.shareImageUrl ===');

  const epapers = await Epaper.find({}).limit(BATCH_LIMIT);
  console.log(`Found ${epapers.length} epapers to inspect`);

  for (const epaper of epapers) {
    let changed = false;

    // Epaper-level share image (front page)
    if (!epaper.shareImageUrl && epaper.pages && epaper.pages.length > 0) {
      const firstPage = epaper.pages[0];
      try {
        if (firstPage.publicId) {
          epaper.shareImageUrl = getOptimizedUrl(firstPage.publicId, {
            width: 600,
            height: 800,
            crop: 'fill',
            quality: 60,
            fetch_format: 'jpg'
          });
        } else {
          epaper.shareImageUrl = firstPage.thumbnail || firstPage.image || '';
        }
        if (epaper.shareImageUrl) {
          changed = true;
          console.log('✓ Epaper', epaper.id, 'shareImageUrl set');
        }
      } catch (e) {
        console.warn('⚠️ Failed epaper shareImageUrl for', epaper.id, e.message);
      }
    }

    // Section-level share images
    if (epaper.pages && epaper.pages.length > 0) {
      for (const page of epaper.pages) {
        const pubId = page.publicId || null;
        if (!page.news || page.news.length === 0) continue;

        for (const section of page.news) {
          if (section.shareImageUrl) continue;
          if (!pubId || !section.width || !section.height) continue;

          try {
            section.shareImageUrl = getCroppedUrl(
              pubId,
              section.x || 0,
              section.y || 0,
              section.width || 0,
              section.height || 0
            );
            if (section.shareImageUrl) {
              changed = true;
              console.log('  ✓ Section', section.id, 'on epaper', epaper.id, 'got shareImageUrl');
            }
          } catch (e) {
            console.warn('⚠️ Failed section shareImageUrl for epaper', epaper.id, 'section', section.id, e.message);
          }
        }
      }
    }

    if (changed) {
      try {
        await epaper.save();
      } catch (e) {
        console.warn('⚠️ Failed saving epaper', epaper.id, e.message);
      }
    }
  }
}

async function run() {
  try {
    await connectDB();
    await backfillArticles();
    await backfillEpapers();
    console.log('\n✅ Backfill complete (batch limited to', BATCH_LIMIT, ')');
  } catch (e) {
    console.error('❌ Backfill failed:', e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();


