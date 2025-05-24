const schedule = require('node-schedule');
const { fetchPhotos } = require('./photo-service');

function setupSchedule() {
  schedule.scheduleJob(process.env.FETCH_PHOTOS_SCHEDULE || '0 0 * * *', async () => {
    console.log('Running scheduled photo fetch job');
    try {
      const count = parseInt(process.env.PHOTOS_PER_DAY) || 10;
      await fetchPhotos(count);
      console.log('Scheduled photo fetch completed');
    } catch (error) {
      console.error('Scheduled photo fetch failed:', error);
    }
  });
}

module.exports = setupSchedule;
