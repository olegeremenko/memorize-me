const express = require('express');
const { scanNAS } = require('../nas-service');
const { fetchPhotos } = require('../photo-service');

const router = express.Router();

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
    const count = req.body.count || parseInt(process.env.PHOTOS_PER_DAY) || 10;
    const result = await fetchPhotos(count);
    res.json({ success: true, message: `${result.fetched} photos fetched`, result });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = router;
