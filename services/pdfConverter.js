import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMP_DIR = path.join(__dirname, '../temp');

// Ensure temp directory exists
fs.ensureDirSync(TEMP_DIR);

// Lazy load canvas and pdfjs-dist to handle missing dependencies gracefully
let canvasModule = null;
let createCanvas = null;
let pdfjsLib = null;

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

const loadPdfjs = async () => {
  if (pdfjsLib) return pdfjsLib;
  
  // Try different import paths for different pdfjs-dist versions and structures
  const importPaths = [
    'pdfjs-dist/build/pdf.mjs',
    'pdfjs-dist',
    'pdfjs-dist/legacy/build/pdf.mjs'
  ];
  
  for (const importPath of importPaths) {
    try {
      console.log(`Trying to import pdfjs-dist from: ${importPath}`);
      const pdfjsModule = await import(importPath);
      
      // pdfjs-dist exports as default or named exports depending on version
      pdfjsLib = pdfjsModule.default || pdfjsModule;
      
      // Verify we have getDocument method (check multiple possible locations)
      const hasGetDocument = pdfjsLib.getDocument || 
                            (pdfjsLib.default && pdfjsLib.default.getDocument) ||
                            (typeof pdfjsLib === 'function');
      
      if (hasGetDocument) {
        console.log(`✅ Successfully loaded pdfjs-dist from: ${importPath}`);
        
        // Set worker source for Node.js (optional, but good practice)
        if (pdfjsLib.GlobalWorkerOptions) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.0.379'}/pdf.worker.min.js`;
        }
        
        return pdfjsLib;
      } else {
        console.log(`Import from ${importPath} succeeded but getDocument not found`);
      }
    } catch (error) {
      console.log(`Failed to import from ${importPath}:`, error.message);
      continue;
    }
  }
  
  throw new Error('Failed to load pdfjs-dist from any known path. Please check the package installation.');
};

/**
 * Convert PDF to images using pdfjs-dist (pure JavaScript, works on all platforms)
 * @param {String} pdfPath - Path to PDF file
 * @returns {Promise<Array>} Array of page images as buffers
 */
export const convertPDFToImages = async (pdfPath) => {
  try {
    // Ensure canvas and pdfjs are loaded
    const canvas = await loadCanvas();
    if (!canvas) {
      throw new Error('Canvas module is not available');
    }

    const pdfjs = await loadPdfjs();
    if (!pdfjs) {
      throw new Error('pdfjs-dist module is not available');
    }

    // Read PDF file
    const pdfBuffer = fs.readFileSync(pdfPath);
    const pdfData = new Uint8Array(pdfBuffer);

    // Load PDF document - handle different export structures
    let getDocument = pdfjs.getDocument;
    if (!getDocument && pdfjs.default) {
      getDocument = pdfjs.default.getDocument;
    }
    if (!getDocument) {
      // Try accessing it directly from the module
      getDocument = pdfjs;
    }
    
    if (typeof getDocument !== 'function') {
      throw new Error('getDocument method not found in pdfjs-dist. Available methods: ' + Object.keys(pdfjs).join(', '));
    }

    const loadingTask = getDocument({ 
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
      const viewport = page.getViewport({ scale: 3.5 }); // Higher scale for better quality (increased from 2.0)

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

      // Convert to JPEG buffer for better compression with high quality
      const jpegBuffer = await sharp(imageBuffer)
        .jpeg({ quality: 95 }) // Increased quality from 90 to 95
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
