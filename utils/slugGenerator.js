// Slug generator that handles Marathi text and creates URL-friendly slugs
// Preserves Marathi characters - modern browsers support Unicode URLs!

/**
 * Generates a URL-friendly slug from text (preserves Marathi/Devanagari characters)
 * @param {string} text - The text to convert to slug
 * @returns {string} - URL-friendly slug with Marathi characters preserved
 */
export const generateSlug = (text) => {
  if (!text) return '';
  
  // Convert to string and trim
  let slug = String(text).trim();
  
  // Remove HTML tags if any
  slug = slug.replace(/<[^>]+>/g, '');
  
  // Remove special characters that are problematic in URLs
  // Keep: letters (including Marathi), numbers, spaces, hyphens
  // Remove: quotes, punctuation, brackets, etc.
  slug = slug
    .replace(/['"'"'""]/g, '')           // Remove quotes
    .replace(/[।.!?।,;:()\[\]{}]/g, '')  // Remove punctuation
    .replace(/[@#$%^&*+=|\\/<>~`]/g, '') // Remove special symbols
    .replace(/\s+/g, '-')                // Replace spaces with hyphens
    .replace(/-+/g, '-')                 // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '');            // Remove leading/trailing hyphens
  
  // If slug is empty or too short, generate from hash
  if (!slug || slug.length < 3) {
    const hash = text.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    slug = `लेख-${Math.abs(hash).toString(36).substring(0, 8)}`;
  }
  
  // Limit length to 100 characters (URLs can be longer, but this is reasonable)
  if (slug.length > 100) {
    slug = slug.substring(0, 100);
    slug = slug.replace(/-+$/, ''); // Remove trailing hyphens
  }
  
  return slug;
};

/**
 * Generates a unique slug by checking database and appending number if needed
 * @param {Model} Model - Mongoose model to check
 * @param {string} text - Text to generate slug from
 * @param {string} excludeId - ID to exclude from uniqueness check (for updates)
 * @returns {string} - Unique slug
 */
export const generateUniqueSlug = async (Model, text, excludeId = null) => {
  let slug = generateSlug(text);
  let counter = 1;
  let uniqueSlug = slug;
  
  while (true) {
    const query = { slug: uniqueSlug };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const existing = await Model.findOne(query);
    if (!existing) {
      return uniqueSlug;
    }
    
    uniqueSlug = `${slug}-${counter}`;
    counter++;
    
    // Safety limit
    if (counter > 1000) {
      uniqueSlug = `${slug}-${Date.now()}`;
      break;
    }
  }
  
  return uniqueSlug;
};

