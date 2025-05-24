const express = require('express');
const { getAllDatabasePhotos } = require('../db');

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

module.exports = router;
