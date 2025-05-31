const express = require('express');
const { getAllDatabasePhotos, getPhotoStats } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const photos = await getAllDatabasePhotos();
    res.json({ photos });
  } catch (error) {
    console.error('Error getting database photos:', error);
    res.status(500).json({ error: 'Failed to get database photos' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await getPhotoStats();
    res.json({ stats });
  } catch (error) {
    console.error('Error getting photo stats:', error);
    res.status(500).json({ error: 'Failed to get photo stats' });
  }
});

module.exports = router;
