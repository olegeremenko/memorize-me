const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { initDatabase } = require('./db');
const photosRoute = require('./routes/photos');
const adminRoute = require('./routes/admin');
const statsRoute = require('./routes/stats');
const settingsRoute = require('./routes/settings');
const setupSchedule = require('./schedule');

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
app.use('/api/photos', photosRoute);
app.use('/api/admin', adminRoute);
app.use('/api/stats', statsRoute);
app.use('/api/settings', settingsRoute);

// Schedule daily photo fetching at midnight
setupSchedule();

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/index.html'));
});

// Serve the admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/admin.html'));
});

// Serve the slideshow photos page
app.get('/slideshow-photos', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/public/slideshow-photos.html'));
});

// Start server
app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log(`Frontend available at http://localhost:${PORT}`);
  console.log(`Admin panel available at http://localhost:${PORT}/admin`);
});
