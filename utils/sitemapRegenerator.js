import fetch from 'node-fetch';
import fs from 'fs';
import { join } from 'path';

/**
 * Regenerate sitemap and optionally save to static file
 * This can be called when articles or e-papers are published
 */
export async function regenerateSitemap(options = {}) {
  const {
    saveToFile = false,
    filePath = null,
    notifyFrontend = false,
    frontendUrl = null
  } = options;

  try {
    // Fetch fresh sitemap from backend
    const backendUrl = process.env.BACKEND_URL || 'https://navmanch-backend.onrender.com';
    const response = await fetch(`${backendUrl}/sitemap.xml`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch sitemap: ${response.status}`);
    }
    
    const xml = await response.text();
    
    // Save to file if requested (for static hosting)
    if (saveToFile && filePath) {
      const fullPath = join(process.cwd(), filePath);
      fs.writeFileSync(fullPath, xml, 'utf-8');
      console.log(`✅ Sitemap saved to: ${fullPath}`);
    }
    
    // Notify frontend to regenerate (if using static hosting)
    if (notifyFrontend && frontendUrl) {
      try {
        await fetch(`${frontendUrl}/api/regenerate-sitemap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ Frontend notified to regenerate sitemap');
      } catch (error) {
        console.warn('⚠️  Could not notify frontend:', error.message);
      }
    }
    
    return xml;
  } catch (error) {
    console.error('❌ Error regenerating sitemap:', error);
    throw error;
  }
}

