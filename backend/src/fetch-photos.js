const { scanNAS } = require('./nas-service');
const { fetchPhotos } = require('./photo-service');
const { initDatabase } = require('./db');

// Run a one-time job to fetch photos
(async () => {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    // Scan NAS if needed
    const scanResult = await scanNAS();
    console.log('NAS scan result:', scanResult);
    
    // Fetch photos
    const count = process.argv[2] ? parseInt(process.argv[2]) : 10;
    console.log(`Fetching ${count} photos...`);
    
    const fetchResult = await fetchPhotos(count);
    console.log('Fetch photos result:', fetchResult);
    
    console.log('Job completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Job failed:', error);
    process.exit(1);
  }
})();
