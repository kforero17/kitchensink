const fetch = require('node-fetch');
const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  // You'll need to set up your Firebase service account key
  // For now, this assumes the GOOGLE_APPLICATION_CREDENTIALS environment variable is set
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'your-project-id.appspot.com'
  });
}

const bucket = admin.storage().bucket();

/**
 * Download image from URL and upload to Firebase Storage
 * @param {string} imageUrl - URL of the image to download
 * @param {string} recipeSlug - Slug for the recipe (used in filename)
 * @returns {Promise<string>} Public URL of the uploaded image
 */
async function uploadImage(imageUrl, recipeSlug) {
  if (!imageUrl || !imageUrl.startsWith('http')) {
    console.warn('Invalid image URL provided');
    return '';
  }
  
  try {
    console.log(`Downloading image: ${imageUrl}`);
    
    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      timeout: 30000
    });
    
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const imageBuffer = await response.buffer();
    
    // Determine file extension from URL or content type
    let extension = 'jpg';
    const contentType = response.headers.get('content-type');
    
    if (contentType) {
      if (contentType.includes('png')) extension = 'png';
      else if (contentType.includes('webp')) extension = 'webp';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) extension = 'jpg';
    } else {
      // Try to get extension from URL
      const urlExtension = path.extname(imageUrl).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp'].includes(urlExtension)) {
        extension = urlExtension.substring(1);
      }
    }
    
    // Create filename
    const filename = `recipes/tasty/${recipeSlug}.${extension}`;
    
    // Upload to Firebase Storage
    const file = bucket.file(filename);
    
    await file.save(imageBuffer, {
      metadata: {
        contentType: contentType || `image/${extension}`,
        metadata: {
          source: 'tasty-scraper',
          originalUrl: imageUrl,
          uploadedAt: new Date().toISOString()
        }
      }
    });
    
    // Make the file publicly accessible
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;
    
    console.log(`✅ Image uploaded successfully: ${publicUrl}`);
    return publicUrl;
    
  } catch (error) {
    console.error(`❌ Failed to upload image for ${recipeSlug}:`, error.message);
    
    // Return the original URL as fallback
    return imageUrl;
  }
}

/**
 * Generate a URL-safe slug from recipe title
 * @param {string} title - Recipe title
 * @returns {string} URL-safe slug
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50); // Limit length
}

/**
 * Clean up old uploaded images (optional utility function)
 * @param {string} prefix - Prefix to filter files (e.g., 'recipes/tasty/')
 * @returns {Promise<number>} Number of files deleted
 */
async function cleanupOldImages(prefix = 'recipes/tasty/') {
  try {
    console.log(`Cleaning up old images with prefix: ${prefix}`);
    
    const [files] = await bucket.getFiles({ prefix });
    
    // Delete files older than 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let deletedCount = 0;
    
    for (const file of files) {
      const [metadata] = await file.getMetadata();
      const uploadDate = new Date(metadata.timeCreated);
      
      if (uploadDate < thirtyDaysAgo) {
        await file.delete();
        deletedCount++;
        console.log(`Deleted old image: ${file.name}`);
      }
    }
    
    console.log(`Cleanup completed. Deleted ${deletedCount} old images.`);
    return deletedCount;
    
  } catch (error) {
    console.error('Error during cleanup:', error.message);
    return 0;
  }
}

/**
 * Check if Firebase Storage is properly configured
 * @returns {Promise<boolean>} True if storage is accessible
 */
async function checkStorageAccess() {
  try {
    // Try to list files in the bucket
    const [files] = await bucket.getFiles({ maxResults: 1 });
    console.log('✅ Firebase Storage access confirmed');
    return true;
  } catch (error) {
    console.error('❌ Firebase Storage access failed:', error.message);
    console.error('Make sure GOOGLE_APPLICATION_CREDENTIALS and FIREBASE_STORAGE_BUCKET are set correctly');
    return false;
  }
}

module.exports = {
  uploadImage,
  generateSlug,
  cleanupOldImages,
  checkStorageAccess
}; 