const fs = require('fs-extra');
const path = require('path');
const sharp = require('sharp');
const dotenv = require('dotenv');
const { getRandomNonDownloadedPhotos, recordDownloadedPhoto, getSameDayPhotosFromPastYears, markPhotoAsDeleted } = require('./db');
const { getNASClient, clearLocalPhotos } = require('./nas-service');
const { ensureMountAndVerify } = require('./nas-mount-service');

// Load environment variables
dotenv.config();

const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos');

// Track if fetch is currently in progress
let isFetchInProgress = false;

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
  // Check if fetch is already in progress
  if (isFetchInProgress) {
    throw new Error('Photo fetch is already in progress. Please wait for the current fetch to complete.');
  }
  
  console.log(`Fetching ${count} random photos...`);
  isFetchInProgress = true;
  
  try {
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
      if (error.code === 'ENOENT' || error.message.includes('no such file')) {
        console.log(`Photo no longer exists on NAS, marking as deleted: ${photo.filename}`);
        await markPhotoAsDeleted(photo.id);
      } else {
        console.error(`Error processing photo ${photo.filename}:`, error);
      }
    }
  }
  
  // Fetch same-day photos from past years
  let sameDayFetched = 0;
  try {
    // Load settings to get sameDayPhotos count
    const settingsPath = path.join(process.cwd(), 'settings.json');
    let sameDayPhotosCount = 1; // default
    
    if (await fs.pathExists(settingsPath)) {
      const settingsData = await fs.readJson(settingsPath);
      sameDayPhotosCount = settingsData.sameDayPhotos || 1;
    }
    
    if (sameDayPhotosCount > 0) {
      console.log(`Fetching ${sameDayPhotosCount} same-day photos from past years...`);
      const sameDayPhotos = await getSameDayPhotosFromPastYears(new Date(), sameDayPhotosCount);
      console.log(`Found ${sameDayPhotos.length} same-day photos from past years`);
      
      for (const sameDayPhoto of sameDayPhotos) {
        try {
          // Check if this photo is already downloaded as same-day
          const existingPath = path.join(photosDir, path.basename(sameDayPhoto.local_path));
          if (fs.existsSync(existingPath)) {
            console.log(`Same-day photo already exists: ${sameDayPhoto.filename}`);
            continue;
          }
          
          // Get NAS client and download the file
          const client = getNASClient();
          await client.connect();
          
          const nasFilePath = path.join(process.env.MOUNTED_PHOTOS_PATH || '', sameDayPhoto.path);
          
          if (await fs.pathExists(nasFilePath)) {
            // Generate local filename with same-day prefix
            const localFilename = `sameday_${path.basename(sameDayPhoto.local_path)}`;
            const localPath = path.join(photosDir, localFilename);
            
            // Copy and resize the image
            await sharp(nasFilePath)
              .resize({ width: 1920, withoutEnlargement: true })
              .jpeg({ quality: 85 })
              .toFile(localPath);
            
            // Record in database
            await recordDownloadedPhoto(sameDayPhoto.nas_id || sameDayPhoto.id, localFilename);
            
            sameDayFetched++;
            console.log(`Downloaded same-day photo: ${sameDayPhoto.filename}`);
          }
        } catch (error) {
          if (error.code === 'ENOENT' || error.message.includes('no such file')) {
            console.log(`Same-day photo no longer exists on NAS, marking as deleted: ${sameDayPhoto.filename}`);
            await markPhotoAsDeleted(sameDayPhoto.nas_id || sameDayPhoto.id);
          } else {
            console.error(`Error processing same-day photo ${sameDayPhoto.filename}:`, error);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching same-day photos:', error);
    // Continue without same-day photos if there's an error
  }
  
    return {
      fetched,
      sameDayFetched,
      total: photosToDownload.length,
      message: `Downloaded ${fetched} regular photos and ${sameDayFetched} same-day photos`
    };
  } catch (error) {
    console.error(`Error in fetchPhotos: ${error.message}`);
    throw error;
  } finally {
    // Always reset the flag when fetch completes or fails
    isFetchInProgress = false;
    console.log('Photo fetch operation completed, flag reset');
  }
};

// Check if fetch is currently in progress
const isFetchingInProgress = () => {
  return isFetchInProgress;
};

// Initialize the photos directory
const initializePhotosDirectory = async () => {
  await fs.ensureDir(photosDir);
  console.log(`Photos directory initialized: ${photosDir}`);
  return photosDir;
};

module.exports = {
  fetchPhotos,
  initializePhotosDirectory,
  isFetchingInProgress
};
