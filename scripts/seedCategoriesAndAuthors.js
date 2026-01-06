import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Category from '../models/Category.js';
import Author from '../models/Author.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Navigation menu categories from Frontend/src/components/Navigation.jsx
const categories = [
  { id: 'latest-news', name: 'ताज्या बातम्या', nameEn: 'Latest News', displayOrder: 1 },
  { id: 'pune', name: 'पुणे', nameEn: 'Pune', displayOrder: 2 },
  { id: 'maharashtra', name: 'महाराष्ट्र', nameEn: 'Maharashtra', displayOrder: 3 },
  { id: 'national-international', name: 'देश विदेश', nameEn: 'National International', displayOrder: 4 },
  { id: 'information-technology', name: 'माहिती तंत्रज्ञान', nameEn: 'Information Technology', displayOrder: 5 },
  { id: 'lifestyle', name: 'लाईफस्टाईल', nameEn: 'Lifestyle', displayOrder: 6 },
  { id: 'column-articles', name: 'स्तंभ लेख', nameEn: 'Column Articles', displayOrder: 7 },
  { id: 'entertainment', name: 'मनोरंजन', nameEn: 'Entertainment', displayOrder: 8 },
  { id: 'sports', name: 'क्रीडा', nameEn: 'Sports', displayOrder: 9 },
  { id: 'health', name: 'आरोग्य', nameEn: 'Health', displayOrder: 10 },
  { id: 'editorial', name: 'संपादकीय', nameEn: 'Editorial', displayOrder: 11 },
];

// Subcategories (if any - you can add more here)
const subcategories = [
  // Example: If you want to add subcategories under 'pune'
  // { parentId: 'pune', name: 'पुणे शहर', nameEn: 'Pune City', displayOrder: 1 },
  // { parentId: 'pune', name: 'पुणे जिल्हा', nameEn: 'Pune District', displayOrder: 2 },
];

// Authors
const authors = [
  { name: 'प्रतिनिधी', nameEn: 'Representative', designation: 'प्रतिनिधी', isActive: true },
];

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI;
    if (!mongoURI) {
      console.error('❌ MONGODB_URI is not defined in environment variables');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB Connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }
};

const seedCategories = async () => {
  try {
    console.log('\n📁 Seeding categories...');
    let createdCount = 0;
    let updatedCount = 0;

    for (const catData of categories) {
      // Check if category exists by name or id
      const existing = await Category.findOne({
        $or: [
          { name: catData.name },
          { nameEn: catData.nameEn }
        ]
      });

      if (existing) {
        // Update existing category
        existing.nameEn = catData.nameEn || existing.nameEn;
        existing.displayOrder = catData.displayOrder;
        existing.isActive = true;
        await existing.save();
        updatedCount++;
        console.log(`  ✓ Updated: ${catData.name}`);
      } else {
        // Create new category
        const category = new Category({
          name: catData.name,
          nameEn: catData.nameEn,
          displayOrder: catData.displayOrder,
          isActive: true,
          parentId: null
        });
        await category.save();
        createdCount++;
        console.log(`  ✓ Created: ${catData.name}`);
      }
    }

    // Handle subcategories
    if (subcategories.length > 0) {
      console.log('\n📁 Seeding subcategories...');
      for (const subcatData of subcategories) {
        // Find parent category
        const parent = await Category.findOne({
          $or: [
            { name: subcatData.parentId },
            { nameEn: subcatData.parentId },
            { _id: subcatData.parentId }
          ]
        });

        if (parent) {
          const existing = await Category.findOne({
            name: subcatData.name,
            parentId: parent._id
          });

          if (existing) {
            existing.nameEn = subcatData.nameEn || existing.nameEn;
            existing.displayOrder = subcatData.displayOrder;
            existing.isActive = true;
            await existing.save();
            console.log(`  ✓ Updated subcategory: ${subcatData.name} (under ${parent.name})`);
          } else {
            const subcategory = new Category({
              name: subcatData.name,
              nameEn: subcatData.nameEn,
              parentId: parent._id,
              displayOrder: subcatData.displayOrder,
              isActive: true
            });
            await subcategory.save();
            console.log(`  ✓ Created subcategory: ${subcatData.name} (under ${parent.name})`);
          }
        } else {
          console.log(`  ⚠ Skipped subcategory: ${subcatData.name} (parent not found)`);
        }
      }
    }

    console.log(`\n✅ Categories: ${createdCount} created, ${updatedCount} updated`);
  } catch (error) {
    console.error('❌ Error seeding categories:', error);
    throw error;
  }
};

const seedAuthors = async () => {
  try {
    console.log('\n👤 Seeding authors...');
    let createdCount = 0;
    let updatedCount = 0;

    for (const authorData of authors) {
      const existing = await Author.findOne({ name: authorData.name });

      if (existing) {
        existing.nameEn = authorData.nameEn || existing.nameEn;
        existing.designation = authorData.designation || existing.designation;
        existing.isActive = authorData.isActive !== undefined ? authorData.isActive : existing.isActive;
        await existing.save();
        updatedCount++;
        console.log(`  ✓ Updated: ${authorData.name}`);
      } else {
        const author = new Author(authorData);
        await author.save();
        createdCount++;
        console.log(`  ✓ Created: ${authorData.name}`);
      }
    }

    console.log(`\n✅ Authors: ${createdCount} created, ${updatedCount} updated`);
  } catch (error) {
    console.error('❌ Error seeding authors:', error);
    throw error;
  }
};

const seed = async () => {
  try {
    await connectDB();
    
    await seedCategories();
    await seedAuthors();

    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  }
};

// Run the seed script
seed();

















