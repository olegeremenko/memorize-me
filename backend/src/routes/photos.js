const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const { getAllDatabasePhotos, updatePhotoDisplayed } = require('../db');

const router = express.Router();

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

        return {
          id: photoId,
          name: file,
          path: `/photos/${file}`,
          date: dbPhoto?.nas_last_modified || stats.mtime.toISOString(),
          size: stats.size,
          displayCount: dbPhoto ? dbPhoto.display_count || 0 : 0
        };
      });

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
    console.error('Error updating photo display count:', error);
    res.status(500).json({ error: 'Failed to update photo display count' });
  }
});

module.exports = router;
