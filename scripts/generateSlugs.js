// Migration script to regenerate slugs for articles and e-papers
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Article from '../models/Article.js';
import Epaper from '../models/Epaper.js';
import { generateUniqueSlug, generateSlug } from '../utils/slugGenerator.js';

dotenv.config();

const regenerateArticleSlugs = async () => {
  try {
    // Find ALL articles (to regenerate all slugs)
    const articles = await Article.find({});
    console.log(`\n📰 Found ${articles.length} articles to process\n`);

    if (articles.length === 0) {
      console.log('ℹ️  No articles found');
      return { success: 0, error: 0, total: 0 };
    }

    let successCount = 0;
    let errorCount = 0;

    // Regenerate slugs for each article
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      try {
        // Clear existing slug to force regeneration
        article.slug = undefined;
        
        // Generate new slug
        const slug = await generateUniqueSlug(Article, article.title, article._id);
        article.slug = slug;
        await article.save();
        successCount++;
        console.log(`✅ [${i + 1}/${articles.length}] Regenerated slug: "${article.title.substring(0, 50)}..." -> ${slug}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ [${i + 1}/${articles.length}] Error for article ${article._id}:`, error.message);
      }
    }

    return { success: successCount, error: errorCount, total: articles.length };
  } catch (error) {
    console.error('❌ Error in regenerateArticleSlugs:', error);
    throw error;
  }
};

const regenerateEpaperSlugs = async () => {
  try {
    // Find ALL e-papers
    const epapers = await Epaper.find({});
    console.log(`\n📄 Found ${epapers.length} e-papers to process\n`);

    if (epapers.length === 0) {
      console.log('ℹ️  No e-papers found');
      return { success: 0, error: 0, total: 0, sections: 0 };
    }

    let successCount = 0;
    let errorCount = 0;
    let sectionsCount = 0;

    // Regenerate slugs for each e-paper
    for (let i = 0; i < epapers.length; i++) {
      const epaper = epapers[i];
      try {
        // Generate slug for e-paper itself
        if (!epaper.slug && epaper.title) {
          const slug = await generateUniqueSlug(Epaper, epaper.title, epaper._id);
          epaper.slug = slug;
          console.log(`✅ [${i + 1}/${epapers.length}] E-paper slug: "${epaper.title.substring(0, 50)}..." -> ${slug}`);
        }

        // Generate slugs for sections (news items) in each page
        if (epaper.pages && Array.isArray(epaper.pages)) {
          for (let pageIndex = 0; pageIndex < epaper.pages.length; pageIndex++) {
            const page = epaper.pages[pageIndex];
            if (page.news && Array.isArray(page.news)) {
              for (let newsIndex = 0; newsIndex < page.news.length; newsIndex++) {
                const newsItem = page.news[newsIndex];
                
                // Generate slug from title or content
                if (newsItem.title || newsItem.content) {
                  const textForSlug = newsItem.title || 
                    (newsItem.content ? newsItem.content.substring(0, 100) : '');
                  
                  if (textForSlug) {
                    // Generate a simple slug (no uniqueness check needed for sections)
                    newsItem.slug = generateSlug(textForSlug);
                    sectionsCount++;
                  }
                }
              }
            }
          }
        }

        await epaper.save();
        successCount++;
      } catch (error) {
        errorCount++;
        console.error(`❌ [${i + 1}/${epapers.length}] Error for e-paper ${epaper.id}:`, error.message);
      }
    }

    return { 
      success: successCount, 
      error: errorCount, 
      total: epapers.length,
      sections: sectionsCount 
    };
  } catch (error) {
    console.error('❌ Error in regenerateEpaperSlugs:', error);
    throw error;
  }
};

const regenerateAllSlugs = async () => {
  try {
    // Connect to database
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/newspaper';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    console.log('\n🔄 Starting slug regeneration...\n');
    console.log('='.repeat(60));

    // Regenerate article slugs
    console.log('\n📰 REGENERATING ARTICLE SLUGS');
    console.log('-'.repeat(60));
    const articleStats = await regenerateArticleSlugs();

    // Regenerate e-paper slugs
    console.log('\n📄 REGENERATING E-PAPER SLUGS');
    console.log('-'.repeat(60));
    const epaperStats = await regenerateEpaperSlugs();

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 REGENERATION SUMMARY');
    console.log('='.repeat(60));
    console.log('\n📰 Articles:');
    console.log(`   ✅ Success: ${articleStats.success}`);
    console.log(`   ❌ Errors: ${articleStats.error}`);
    console.log(`   📝 Total: ${articleStats.total}`);
    
    console.log('\n📄 E-Papers:');
    console.log(`   ✅ Success: ${epaperStats.success}`);
    console.log(`   ❌ Errors: ${epaperStats.error}`);
    console.log(`   📝 Total: ${epaperStats.total}`);
    console.log(`   📑 Sections: ${epaperStats.sections}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Slug regeneration completed!\n');

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
};

// Run the migration
regenerateAllSlugs();

