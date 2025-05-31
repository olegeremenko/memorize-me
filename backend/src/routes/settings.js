const express = require('express');
const fs = require('fs-extra');
const path = require('path');

const router = express.Router();

// Define path to settings file
const settingsPath = path.join(process.cwd(), 'settings.json');

// Get system settings
router.get('/', async (req, res) => {
  try {
    // Default settings
    let settings = {
      slideshowInterval: 300, // 5 minutes in seconds
      photosPerDay: 10
    };
    
    // Check if settings file exists
    if (fs.existsSync(settingsPath)) {
      const fileSettings = await fs.readJson(settingsPath);
      // Merge with defaults
      settings = { ...settings, ...fileSettings };
    } else {
      // Create settings file with defaults if it doesn't exist
      await fs.writeJson(settingsPath, settings, { spaces: 2 });
    }
    
    res.json({ settings });
  } catch (error) {
    console.error('Error getting settings:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update system settings
router.post('/', async (req, res) => {
  try {
    const { slideshowInterval, photosPerDay } = req.body;
    
    // Validate settings
    const settings = {};
    
    if (slideshowInterval !== undefined) {
      const interval = parseInt(slideshowInterval);
      if (isNaN(interval) || interval < 5) {
        return res.status(400).json({ error: 'Slideshow interval must be at least 5 seconds' });
      }
      settings.slideshowInterval = interval;
    }
    
    if (photosPerDay !== undefined) {
      const count = parseInt(photosPerDay);
      if (isNaN(count) || count < 1 || count > 100) {
        return res.status(400).json({ error: 'Photos per day must be between 1 and 100' });
      }
      settings.photosPerDay = count;
    }
    
    // Read existing settings
    let existingSettings = {};
    if (fs.existsSync(settingsPath)) {
      existingSettings = await fs.readJson(settingsPath);
    }
    
    // Update settings
    const updatedSettings = { ...existingSettings, ...settings };
    await fs.writeJson(settingsPath, updatedSettings, { spaces: 2 });
    
    res.json({ success: true, settings: updatedSettings });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
