const path = require('path');
const fs = require('fs-extra');
const sqlite3 = require('sqlite3').verbose();
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const dbPath = process.env.LOCAL_DB_PATH || path.join(__dirname, '../data/photos.db');
const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos');

// Function to flush the database and remove photos
const flushData = async () => {
  try {
    console.log('Starting data flush operation...');
    
    // 1. Delete all photos in the local photos directory
    console.log(`Removing photos from ${photosDir}...`);
    const files = await fs.readdir(photosDir);
    
    // Only delete image files, not directories or system files
    const photoFiles = files.filter(file => 
      /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file));
    
    console.log(`Found ${photoFiles.length} photo files to delete`);
    
    for (const file of photoFiles) {
      await fs.unlink(path.join(photosDir, file));
    }
    
    console.log('All photos deleted successfully');
    
    // 2. Truncate database tables
    console.log(`Connecting to database at ${dbPath}...`);
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Could not connect to database', err);
        throw err;
      }
    });
    
    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        db.run('DELETE FROM downloaded_photos', (err) => {
          if (err) reject(err);
          console.log('Cleared downloaded_photos table');
        });
        db.run('DELETE FROM nas_photos', (err) => {
          if (err) reject(err);
          console.log('Cleared nas_photos table');
        });
        db.run('COMMIT', (err) => {
          if (err) {
            reject(err);
          } else {
            console.log('Database tables flushed successfully');
            resolve();
          }
        });
      });
    });
    
    // Close database connection
    await new Promise((resolve, reject) => {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
          reject(err);
        } else {
          console.log('Database connection closed');
          resolve();
        }
      });
    });
    
    console.log('Data flush completed successfully');
    return true;
  } catch (error) {
    console.error('Data flush failed:', error);
    throw error;
  }
};

// Run the function if this script is called directly
if (require.main === module) {
  flushData()
    .then(() => {
      console.log('Operation completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Operation failed:', error);
      process.exit(1);
    });
}

module.exports = { flushData };
