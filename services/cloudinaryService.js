import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

/**
 * Upload e-paper page image to Cloudinary
 * @param {Buffer} imageBuffer - Image buffer
 * @param {Number} epaperId - E-paper ID
 * @param {Number} pageNo - Page number
 * @returns {Promise<Object>} Upload result with URLs
 */
export const uploadEpaperPage = async (imageBuffer, epaperId, pageNo) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `epapers/${epaperId}/pages`,
        public_id: `page-${pageNo}`,
        resource_type: 'image',
        format: 'jpg',
        quality: 'auto',
        fetch_format: 'auto', // Auto WebP conversion
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          // Generate thumbnail URL
          const thumbnailUrl = cloudinary.url(result.public_id, {
            transformation: [
              { width: 800, height: 1000, crop: 'limit' },
              { quality: 'auto' },
              { fetch_format: 'auto' }
            ]
          });

          resolve({
            imageUrl: result.secure_url,
            thumbnailUrl: thumbnailUrl,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            bytes: result.bytes
          });
        }
      }
    );

    // Convert buffer to stream
    const bufferStream = new Readable();
    bufferStream.push(imageBuffer);
    bufferStream.push(null);
    
    bufferStream.on('error', (error) => {
      console.error('Stream error:', error);
      reject(error);
    });
    
    bufferStream.pipe(uploadStream);
  });
};

/**
 * Get optimized image URL from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @param {Object} options - Transformation options
 * @returns {String} Optimized URL
 */
export const getOptimizedUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    quality: 'auto',
    fetch_format: 'auto',
    ...options
  });
};

/**
 * Get cropped image URL for sharing
 * @param {String} publicId - Cloudinary public ID
 * @param {Number} x - X coordinate
 * @param {Number} y - Y coordinate
 * @param {Number} width - Width
 * @param {Number} height - Height
 * @returns {String} Cropped image URL
 */
export const getCroppedUrl = (publicId, x, y, width, height) => {
  return cloudinary.url(publicId, {
    transformation: [
      {
        crop: 'crop',
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height)
      },
      { quality: 'auto' },
      { fetch_format: 'auto' }
    ]
  });
};

/**
 * Delete image from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteImage = async (publicId) => {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};

/**
 * Delete folder (all images in an e-paper)
 * @param {String} folderPath - Folder path (e.g., 'epapers/1234567890/pages')
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFolder = async (folderPath) => {
  try {
    const result = await cloudinary.api.delete_resources_by_prefix(folderPath);
    return result;
  } catch (error) {
    console.error('Cloudinary folder delete error:', error);
    throw error;
  }
};

