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
            downloads_count INTEGER DEFAULT 0,
            deleted_at TEXT DEFAULT NULL,
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
          resolve({ inserted, total: photos.length, existing: photos.length - inserted });
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

// Record downloaded photo (initializes downloads_count to 1)
const recordDownloadedPhoto = (nasPhotoId, localPath) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const query = 'INSERT INTO downloaded_photos (nas_photo_id, local_path, downloads_count) VALUES (?, ?, 1)';
    
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
    
    const query = 'UPDATE downloaded_photos SET last_displayed = CURRENT_TIMESTAMP WHERE id = ?';
    
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

// Update photo download stats
const incrementPhotoDownloads = (photoId) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const query = 'UPDATE downloaded_photos SET downloads_count = downloads_count + 1 WHERE id = ?';
    
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

// Mark a photo as deleted (soft delete)
const markPhotoAsDeleted = (photoId) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    
    const query = 'UPDATE downloaded_photos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?';
    
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

// Get all photos from the database
const getAllDatabasePhotos = async (limit = null, offset = 0, slideshowOnly = false) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    let query = `
      SELECT 
        np.id as nas_id,
        np.path as nas_path, 
        np.filename as nas_filename,
        np.size as nas_size,
        np.last_modified as nas_last_modified,
        dp.id as downloaded_id, 
        dp.local_path as local_path,
        dp.downloaded_at as downloaded_at,
        dp.downloads_count as downloads_count,
        dp.deleted_at as deleted_at
      FROM nas_photos np
      ${slideshowOnly ? 'INNER' : 'LEFT'} JOIN downloaded_photos dp ON np.id = dp.nas_photo_id
      ${slideshowOnly ? 'WHERE dp.local_path IS NOT NULL AND dp.deleted_at IS NULL' : ''}
      ORDER BY np.filename
    `;
    
    const params = [];
    if (limit) {
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);
    }
    
    db.all(query, params, async (err, rows) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        try {
          // Always check file existence for all photos with local_path
          await fs.ensureDir(photosDir);
          const actualFiles = await fs.readdir(photosDir);
          const imageFiles = actualFiles.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file));
          
          // Add file existence information to all rows
          const rowsWithExistence = rows.map(row => {
            let fileExists = false;
            if (row.local_path) {
              const filename = path.basename(row.local_path);
              fileExists = imageFiles.includes(filename);
            }
            
            return {
              ...row,
              file_exists_locally: fileExists
            };
          });
          
          if (slideshowOnly) {
            // Filter to only photos that exist locally
            const existingPhotos = rowsWithExistence.filter(row => row.file_exists_locally);
            resolve(existingPhotos);
          } else {
            resolve(rowsWithExistence);
          }
        } catch (error) {
          console.error('Error reading photos directory:', error);
          resolve(rows.map(row => ({ ...row, file_exists_locally: false })));
        }
      }
    });
  });
};

// Get statistics for the admin dashboard
const getPhotoStats = () => {
  return new Promise(async (resolve, reject) => {
    try {
      const db = getDb();
      const query = `
        SELECT 
          (SELECT COUNT(*) FROM nas_photos) as total_photos,
          (SELECT COUNT(*) FROM downloaded_photos WHERE deleted_at IS NULL) as active_photos,
          (SELECT COUNT(*) FROM downloaded_photos WHERE deleted_at IS NOT NULL) as deleted_photos,
          (SELECT MAX(created_at) FROM nas_photos) as last_scan_time
        FROM nas_photos LIMIT 1
      `;
      
      // Get database stats
      const dbStats = await new Promise((res, rej) => {
        db.get(query, [], (err, stats) => {
          db.close();
          if (err) {
            rej(err);
          } else {
            res(stats || {
              total_photos: 0,
              active_photos: 0,
              deleted_photos: 0,
              last_scan_time: null
            });
          }
        });
      });
      
      // Count actual files in photos directory
      const filesCount = await getLocalPhotoCount();
      
      // Combine stats
      resolve({
        ...dbStats,
        local_photos_count: filesCount
      });
    } catch (err) {
      reject(err);
    }
  });
};

// Count the number of image files in the local photos directory
const getLocalPhotoCount = () => {
  return new Promise(async (resolve, reject) => {
    try {
      await fs.ensureDir(photosDir);
      const files = await fs.readdir(photosDir);
      const imageFileCount = files.filter(file => /\.(jpg|jpeg|png|gif)$/i.test(file)).length;
      resolve(imageFileCount);
    } catch (err) {
      console.error('Error counting local photos:', err);
      reject(err);
    }
  });
};

// Get total count of photos for pagination
const getTotalPhotosCount = async (slideshowOnly = false) => {
  if (slideshowOnly) {
    // Use the same approach as getLocalPhotoCount for consistency
    return await getLocalPhotoCount();
  }
  
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = 'SELECT COUNT(*) as total FROM nas_photos np';
    
    db.get(query, [], (err, row) => {
      db.close();
      if (err) {
        reject(err);
      } else {
        resolve(row.total);
      }
    });
  });
};

// Get NAS photo by ID
const getNASPhotoById = async (photoId) => {
  return new Promise((resolve, reject) => {
    const db = getDb();
    const query = 'SELECT * FROM nas_photos WHERE id = ?';
    
    db.get(query, [photoId], (err, row) => {
      db.close();
      if (err) {
        console.error('Error getting NAS photo by ID:', err);
        reject(err);
      } else {
        resolve(row);
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
  updatePhotoDisplayed,
  incrementPhotoDownloads,
  markPhotoAsDeleted,
  getAllDatabasePhotos,
  getNASPhotoById,
  getTotalPhotosCount,
  getPhotoStats,
  getLocalPhotoCount
};
