import pdf from 'pdf-poppler';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure temp directory exists
fs.ensureDirSync(TEMP_DIR);

/**
 * Convert PDF to images
 * @param {String} pdfPath - Path to PDF file
 * @returns {Promise<Array>} Array of page images as buffers
 */
export const convertPDFToImages = async (pdfPath) => {
  try {
    const options = {
      format: 'png',
      out_dir: TEMP_DIR,
      out_prefix: `page_${Date.now()}`,
      page: null // Convert all pages
    };

    // Convert PDF to images
    await pdf.convert(pdfPath, options);

    // Get all generated image files
    const files = fs.readdirSync(TEMP_DIR);
    const pageFiles = files
      .filter(file => file.startsWith(options.out_prefix))
      .sort((a, b) => {
        const numA = parseInt(a.match(/\d+/)?.[0] || 0);
        const numB = parseInt(b.match(/\d+/)?.[0] || 0);
        return numA - numB;
      });

    const pages = [];

    for (let i = 0; i < pageFiles.length; i++) {
      const filePath = path.join(TEMP_DIR, pageFiles[i]);
      const imageBuffer = fs.readFileSync(filePath);
      
      // Get image dimensions
      const metadata = await sharp(imageBuffer).metadata();
      
      // Convert to JPEG buffer for better compression
      const jpegBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();

      pages.push({
        pageNo: i + 1,
        imageBuffer: jpegBuffer,
        width: metadata.width,
        height: metadata.height
      });

      // Clean up temp file
      fs.unlinkSync(filePath);
    }

    return pages;
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error('Failed to convert PDF: ' + error.message);
  }
};

/**
 * Clean up temp directory
 */
export const cleanupTemp = () => {
  try {
    const files = fs.readdirSync(TEMP_DIR);
    files.forEach(file => {
      const filePath = path.join(TEMP_DIR, file);
      if (fs.statSync(filePath).isFile()) {
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};



