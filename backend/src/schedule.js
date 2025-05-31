const schedule = require('node-schedule');
const fs = require('fs-extra');
const path = require('path');
const { fetchPhotos } = require('./photo-service');

// Path to settings file
const settingsPath = path.join(process.cwd(), 'settings.json');

// Helper function to read settings
const getSettings = async () => {
  try {
    if (fs.existsSync(settingsPath)) {
      return await fs.readJson(settingsPath);
    }
    return { photosPerDay: 10 }; // Default if file doesn't exist
  } catch (error) {
    console.error('Error reading settings:', error);
    return { photosPerDay: 10 }; // Default on error
  }
};

function setupSchedule() {
  schedule.scheduleJob(process.env.FETCH_PHOTOS_SCHEDULE || '0 0 * * *', async () => {
    console.log('Running scheduled photo fetch job');
    try {
      const settings = await getSettings();
      const count = settings.photosPerDay || parseInt(process.env.PHOTOS_PER_DAY) || 10;
      await fetchPhotos(count);
      console.log(`Scheduled photo fetch completed: ${count} photos`);
    } catch (error) {
      console.error('Scheduled photo fetch failed:', error);
    }
  });
}

module.exports = setupSchedule;
