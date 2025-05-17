const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs-extra');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const dbPath = process.env.LOCAL_DB_PATH || path.join(__dirname, '../data/photos.db');
const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos');

// Ensure data directory exists
const ensureDataDirectory = async () => {
  await fs.ensureDir(path.dirname(dbPath));
  await fs.ensureDir(photosDir);
};

// Initialize the database
const initDatabase = async () => {
  await ensureDataDirectory();
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Could not connect to database', err);
        reject(err);
        return;
      }
      
      console.log('Connected to SQLite database');
      
      // Create tables if they don't exist
      db.serialize(() => {
        // Table for available photos on NAS
        db.run(`
          CREATE TABLE IF NOT EXISTS nas_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE,
            filename TEXT NOT NULL,
            size INTEGER,
            last_modified TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Table for downloaded photos
        db.run(`
          CREATE TABLE IF NOT EXISTS downloaded_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nas_photo_id INTEGER,
            local_path TEXT NOT NULL,
            downloaded_at TEXT DEFAULT CURRENT_TIMESTAMP,
            last_displayed TEXT,
            display_count INTEGER DEFAULT 0,
            FOREIGN KEY (nas_photo_id) REFERENCES nas_photos (id)
          )
        `, (err) => {
          if (err) {
            console.error('Error creating tables:', err);
            reject(err);
          } else {
            console.log('Database tables created');
            resolve(db);
          }
        });
      });
    });
  });
};

// Get database connection
const getDb = () => {
  return new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Could not connect to database', err);
      throw err;
    }
  });
};

// Save photo info from NAS scan
const saveNASPhotos = (photos) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const stmt = db.prepare('INSERT OR IGNORE INTO nas_photos (path, filename, size, last_modified) VALUES (?, ?, ?, ?)');
    
    db.serialize(() => {
      db.run('BEGIN TRANSACTION');
      
      let inserted = 0;
      photos.forEach((photo) => {
        stmt.run(photo.path, photo.filename, photo.size, photo.lastModified, function(err) {
          if (err) {
            console.error('Error inserting photo:', err);
          } else if (this.changes) {
            inserted++;
          }
        });
      });
      
      stmt.finalize();
      
      db.run('COMMIT', (err) => {
        db.close();
        if (err) {
          reject(err);
        } else {
          resolve({ inserted, total: photos.length });
        }
      });
    });
  });
};

// Get random non-downloaded photos
const getRandomNonDownloadedPhotos = (count) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const query = `
      SELECT np.* FROM nas_photos np
      LEFT JOIN downloaded_photos dp ON np.id = dp.nas_photo_id
      WHERE dp.id IS NULL
      ORDER BY RANDOM()
      LIMIT ?
    `;
    
    db.all(query, [count], (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Record downloaded photo
const recordDownloadedPhoto = (nasPhotoId, localPath) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const query = 'INSERT INTO downloaded_photos (nas_photo_id, local_path) VALUES (?, ?)';
    
    db.run(query, [nasPhotoId, localPath], function(err) {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, nasPhotoId, localPath });
      }
    });
  });
};

// Update photo display stats
const updatePhotoDisplayed = (photoId) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const query = 'UPDATE downloaded_photos SET last_displayed = CURRENT_TIMESTAMP, display_count = display_count + 1 WHERE id = ?';
    
    db.run(query, [photoId], function(err) {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve({ updated: this.changes > 0 });
      }
    });
  });
};

module.exports = {
  initDatabase,
  getDb,
  saveNASPhotos,
  getRandomNonDownloadedPhotos,
  recordDownloadedPhoto,
  updatePhotoDisplayed
};
