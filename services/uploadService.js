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
 * Upload image to Cloudinary
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} folder - Folder path in Cloudinary
 * @param {String} resourceType - 'image' or 'raw' (for PDFs)
 * @returns {Promise<Object>} Upload result with URL
 */
export const uploadToCloudinary = async (fileBuffer, folder = 'newspaper', resourceType = 'image') => {
  return new Promise((resolve, reject) => {
    // Configure upload options based on resource type
    const uploadOptions = {
      folder: folder,
      resource_type: resourceType,
    };

    // For images: high quality, auto format optimization
    if (resourceType === 'image') {
      uploadOptions.quality = 'auto:best'; // Best quality with auto optimization
      uploadOptions.fetch_format = 'auto'; // Auto WebP/AVIF when beneficial
      // Don't use 'format' parameter - let Cloudinary keep original format or use fetch_format
    }
    // For videos: high quality
    else if (resourceType === 'video') {
      uploadOptions.quality = 'auto:best';
      uploadOptions.fetch_format = 'auto';
    }
    // For PDFs and other raw files: no transformations
    // Just upload as-is for maximum quality

    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(error);
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width || null,
            height: result.height || null,
            bytes: result.bytes
          });
        }
      }
    );

    // Convert buffer to stream
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);
    
    bufferStream.on('error', (error) => {
      console.error('Stream error:', error);
      reject(error);
    });
    
    bufferStream.pipe(uploadStream);
  });
};

/**
 * Delete file from Cloudinary
 * @param {String} publicId - Cloudinary public ID
 * @param {String} resourceType - 'image' or 'raw'
 * @returns {Promise<Object>} Deletion result
 */
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    throw error;
  }
};


