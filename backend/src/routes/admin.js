const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { scanNAS } = require('../nas-service');
const { fetchPhotos } = require('../photo-service');

const router = express.Router();

// Path to settings file
const settingsPath = path.join(process.cwd(), 'settings.json');

router.post('/scan', async (req, res) => {
  try {
    const result = await scanNAS();
    res.json({ success: true, message: 'NAS scan completed', result });
  } catch (error) {
    console.error('Error scanning NAS:', error);
    res.status(500).json({ error: 'Failed to scan NAS' });
  }
});

router.post('/fetch', async (req, res) => {
  try {
    let defaultCount = 10;
    
    // Try to read from settings file
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = await fs.readJson(settingsPath);
        if (settings.photosPerDay) {
          defaultCount = settings.photosPerDay;
        }
      }
    } catch (err) {
      console.error('Error reading settings file:', err);
      // Use fallback if settings file can't be read
    }
    
    const count = req.body.count || parseInt(process.env.PHOTOS_PER_DAY) || defaultCount;
    const result = await fetchPhotos(count);
    res.json({ success: true, message: `${result.fetched} photos fetched`, result });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = router;
