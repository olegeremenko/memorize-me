const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const schedule = require('node-schedule');
const dotenv = require('dotenv');
const { initDatabase } = require('./db');
const { scanNAS } = require('./nas-service');
const { fetchPhotos } = require('./photo-service');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../../frontend/public')));

// Serve photos directory
app.use('/photos', express.static(process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos')));

// Initialize database on startup
initDatabase()
  .then(() => console.log('Database initialized'))
  .catch(err => console.error('Database initialization failed:', err));

// API Routes
app.get('/api/photos', async (req, res) => {
  try {
    const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos');
    const files = await fs.readdir(photosDir);
    
    const photos = files
      .filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file))
      .map(file => {
        const stats = fs.statSync(path.join(photosDir, file));
        return {
          name: file,
          path: `/photos/${file}`,
          date: stats.mtime,
          size: stats.size
        };
      });
      
    res.json({ photos });
  } catch (error) {
    console.error('Error getting photos:', error);
    res.status(500).json({ error: 'Failed to get photos' });
  }
});

// Trigger NAS scanning
app.post('/api/admin/scan', async (req, res) => {
  try {
    const result = await scanNAS();
    res.json({ success: true, message: 'NAS scan completed', result });
  } catch (error) {
    console.error('Error scanning NAS:', error);
    res.status(500).json({ error: 'Failed to scan NAS' });
  }
});

// Trigger photo fetching
app.post('/api/admin/fetch', async (req, res) => {
  try {
    const count = req.body.count || parseInt(process.env.PHOTOS_PER_DAY) || 10;
    const result = await fetchPhotos(count);
    res.json({ success: true, message: `${result.fetched} photos fetched`, result });
  } catch (error) {
    console.error('Error fetching photos:', error);
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

// Schedule daily photo fetching at midnight
schedule.scheduleJob('0 0 * * *', async () => {
  console.log('Running scheduled photo fetch job');
  try {
    const count = parseInt(process.env.PHOTOS_PER_DAY) || 10;
    await fetchPhotos(count);
    console.log('Scheduled photo fetch completed');
  } catch (error) {
    console.error('Scheduled photo fetch failed:', error);
  }
});

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Frontend available at http://localhost:${PORT}`);
});
