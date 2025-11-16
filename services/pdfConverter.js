import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure temp directory exists
fs.ensureDirSync(TEMP_DIR);

// Lazy load canvas to handle missing dependencies gracefully
let canvasModule = null;
let createCanvas = null;

const loadCanvas = async () => {
  if (createCanvas) return createCanvas;
  
  try {
    canvasModule = await import('canvas');
    createCanvas = canvasModule.createCanvas;
    return createCanvas;
  } catch (error) {
    console.error('❌ Failed to load canvas module:', error.message);
    throw new Error('Canvas module is required for PDF conversion. On Render, ensure canvas dependencies are installed.');
  }
};

/**
 * Convert PDF to images using pdfjs-dist (pure JavaScript, works on all platforms)
 * @param {String} pdfPath - Path to PDF file
 * @returns {Promise<Array>} Array of page images as buffers
 */
export const convertPDFToImages = async (pdfPath) => {
  try {
    // Ensure canvas is loaded
    const canvas = await loadCanvas();
    if (!canvas) {
      throw new Error('Canvas module is not available');
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: pdfData,
      useSystemFonts: true 
    });
    const pdf = await loadingTask.promise;
    const numPages = pdf.numPages;

    console.log(`📄 PDF has ${numPages} pages`);

    const pages = [];

    // Convert each page to image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for better quality

      // Create canvas
      const canvasInstance = canvas(viewport.width, viewport.height);
      const context = canvasInstance.getContext('2d');

      // Render PDF page to canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;

      // Convert canvas to buffer
      const imageBuffer = canvasInstance.toBuffer('image/png');

      // Get image dimensions using sharp
      const metadata = await sharp(imageBuffer).metadata();

      // Convert to JPEG buffer for better compression
      const jpegBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 90 })
        .toBuffer();

      pages.push({
        pageNo: pageNum,
        imageBuffer: jpegBuffer,
        width: metadata.width,
        height: metadata.height
      });

      console.log(`✅ Converted page ${pageNum}/${numPages}`);
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
