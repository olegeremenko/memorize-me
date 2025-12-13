const express = require('express');
const { getAllDatabasePhotos, getPhotoStats, getTotalPhotosCount } = require('../db');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100;
    const offset = (page - 1) * limit;
    
    const photos = await getAllDatabasePhotos(limit, offset);
    const totalCount = await getTotalPhotosCount();
    const totalPages = Math.ceil(totalCount / limit);
    
    res.json({ 
      photos,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNext: page < totalPages,
        hasPrevious: page > 1
      }
    });
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
