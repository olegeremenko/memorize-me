const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const dotenv = require('dotenv');
const { getRandomNonDownloadedPhotos, recordDownloadedPhoto } = require('./db');
const { getNASClient, clearLocalPhotos } = require('./nas-service');
const { ensureMountAndVerify } = require('./nas-mount-service');

// Load environment variables
dotenv.config();

const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos');

// Resize image using sharp
const resizeImage = async (inputPath, outputPath, width = 1920) => {
  try {
    await sharp(inputPath)
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(outputPath);
    return true;
  } catch (error) {
    console.error('Error resizing image:', error);
    return false;
  }
};

// Fetch random photos from NAS
const fetchPhotos = async (count = 10) => {
  console.log(`Fetching ${count} random photos...`);
  
  // Clear out existing photos
  console.log('Clearing local photos directory before fetching new photos');
  await clearLocalPhotos();
  
  // Ensure photos directory exists
  await fs.ensureDir(photosDir);
  
  // Get random photos that haven't been downloaded yet
  const photosToDownload = await getRandomNonDownloadedPhotos(count);
  console.log(`Found ${photosToDownload.length} photos to download`);
  
  if (photosToDownload.length === 0) {
    return { fetched: 0, message: 'No new photos to fetch' };
  }
    // Ensure NAS is mounted and accessible
  await ensureMountAndVerify();
  
  // Connect to NAS
  const nasClient = getNASClient();
  await nasClient.connect();
  
  let fetched = 0;
  
  // Download each photo
  for (const photo of photosToDownload) {
    try {
      const localFilename = `${Date.now()}-${photo.filename}`;
      const tempPath = path.join(photosDir, `temp-${localFilename}`);
      const finalPath = path.join(photosDir, localFilename);
      
      // Download from NAS
      await nasClient.downloadFile(photo.path, tempPath);
      
      // Resize image
      await resizeImage(tempPath, finalPath);
      
      // Clean up temp file
      await fs.remove(tempPath);
      
      // Record in database
      await recordDownloadedPhoto(photo.id, localFilename);
      
      fetched++;
      console.log(`Downloaded and processed: ${photo.filename}`);
    } catch (error) {
      console.error(`Error processing photo ${photo.filename}:`, error);
    }
  }
  
  return {
    fetched,
    total: photosToDownload.length,
    message: `Downloaded ${fetched} photos`
  };
};

// Initialize the photos directory
const initializePhotosDirectory = async () => {
  await fs.ensureDir(photosDir);
  console.log(`Photos directory initialized: ${photosDir}`);
  return photosDir;
};

module.exports = {
  fetchPhotos,
  initializePhotosDirectory
};
