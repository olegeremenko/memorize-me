const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { getAllDatabasePhotos, updatePhotoDisplayed, incrementPhotoDownloads, markPhotoAsDeleted } = require('../db');

const router = express.Router();

// Helper function to calculate relative time
function getRelativeTimeString(date) {
  const now = new Date();
  const diffInSeconds = Math.floor((now - date) / 1000);
  
  const intervals = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60
  };
  
  for (const [unit, seconds] of Object.entries(intervals)) {
    const interval = Math.floor(diffInSeconds / seconds);
    if (interval >= 1) {
      return interval === 1 ? `1 ${unit} ago` : `${interval} ${unit}s ago`;
    }
  }
  
  return 'just now';
}

router.get('/', async (req, res) => {
  try {
    const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../../data/photos');
    const files = await fs.readdir(photosDir);

    // Get all photos from database to match filenames with IDs
    const dbPhotos = await getAllDatabasePhotos();

    const photos = files
      .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
      .map(file => {
        const stats = fs.statSync(path.join(photosDir, file));

        // Match with database record to get ID
        const dbPhoto = dbPhotos.find(p => p.local_path === file);
        const photoId = dbPhoto ? dbPhoto.downloaded_id : null;
        const isDeleted = dbPhoto ? dbPhoto.deleted_at !== null : false;
        const originalFileName = dbPhoto ? dbPhoto.nas_filename : file;
        
        // Parse timestamp from filename if it matches the pattern YYYY-MM-DD_HH-MM-SS.ext
        let relativeTime = null;
        // Extract the base filename without extension
        const baseName = originalFileName.replace(/\.[^/.]+$/, "");
        const timestampMatch = baseName.match(/^(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})/);
        if (timestampMatch) {
          // Convert the date format from YYYY-MM-DD_HH-MM-SS to YYYY-MM-DDTHH:MM:SS
          const dateStr = `${timestampMatch[1]}T${timestampMatch[2].replace(/-/g, ':')}`;
          const timestamp = new Date(dateStr);
          if (!isNaN(timestamp)) {
            relativeTime = getRelativeTimeString(timestamp);
          }
        }

        return {
          id: photoId,
          name: file,
          originalFileName: originalFileName, // Add original filename from NAS
          path: `/photos/${file}`,
          date: dbPhoto?.nas_last_modified || stats.mtime.toISOString(),
          size: stats.size,
          downloadsCount: dbPhoto ? dbPhoto.downloads_count || 0 : 0,
          isDeleted: isDeleted,
          relativeTime: relativeTime
        };
      })
      // Filter out deleted photos
      .filter(photo => !photo.isDeleted);

    res.json({ photos });
  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

router.post('/viewed', async (req, res) => {
  try {
    const { photoId } = req.body;
    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    const result = await updatePhotoDisplayed(photoId);
    res.json({ success: true, updated: result.updated });
  } catch (error) {
    console.error('Error updating photo display timestamp:', error);
    res.status(500).json({ error: 'Failed to update photo display timestamp' });
  }
});

router.get('/download/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    // Get photo information
    const dbPhotos = await getAllDatabasePhotos();
    const photoInfo = dbPhotos.find(p => p.downloaded_id === parseInt(photoId));

    if (!photoInfo || !photoInfo.local_path) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Construct the file path
    const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../../data/photos');
    const photoPath = path.join(photosDir, photoInfo.local_path);

    // Check if file exists
    if (!fs.existsSync(photoPath)) {
      return res.status(404).json({ error: 'Photo file not found' });
    }

    // Increment download count
    await incrementPhotoDownloads(photoId);

    // Set headers for downloading
    const originalFilename = photoInfo.nas_filename || photoInfo.local_path;
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(originalFilename)}"`);
    
    // Send the file for download
    res.sendFile(photoPath);
  } catch (error) {
    console.error('Error downloading photo:', error);
    res.status(500).json({ error: 'Failed to download photo' });
  }
});

router.post('/delete/:photoId', async (req, res) => {
  try {
    const photoId = req.params.photoId;
    if (!photoId) {
      return res.status(400).json({ error: 'Photo ID is required' });
    }

    // Mark the photo as deleted in the database
    const result = await markPhotoAsDeleted(photoId);
    
    if (result.updated) {
      res.json({ success: true, message: 'Photo deleted successfully' });
    } else {
      res.status(404).json({ success: false, error: 'Photo not found' });
    }
  } catch (error) {
    console.error('Error deleting photo:', error);
    res.status(500).json({ error: 'Failed to delete photo' });
  }
});

module.exports = router;
