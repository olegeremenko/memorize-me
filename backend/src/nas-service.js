const fs = require('fs-extra');
const path = require('path');
const dotenv = require('dotenv');
const { saveNASPhotos } = require('./db');

// Load environment variables
dotenv.config();

// Get the path to the local photos directory
const photosDir = process.env.LOCAL_PHOTOS_PATH || path.join(__dirname, '../data/photos');
// Path to config file
const configPath = path.join(process.cwd(), 'config.json');

// Load config.json
const loadPhotoScanConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      const config = fs.readJsonSync(configPath);
      
      // Handle both new format (with recursive flag) and old format (just strings)
      let subfolders = [];
      if (config.photoScanConfig?.subfolders) {
        subfolders = config.photoScanConfig.subfolders.map(subfolder => {
          // If subfolder is a string, convert to object with default recursive=true
          if (typeof subfolder === 'string') {
            return {
              path: subfolder,
              recursive: true // Default to recursive scanning
            };
          }
          return subfolder;
        });
      }
      
      return {
        subfolders: subfolders,
        exclusionPatterns: config.photoScanConfig?.exclusionPatterns || [],
        imageFileExtensions: config.photoScanConfig?.imageFileExtensions || ['.jpg', '.jpeg', '.png', '.gif']
      };
    } else {
      console.log('Config file not found, using default empty configuration');
      return { 
        subfolders: [], 
        exclusionPatterns: [],
        imageFileExtensions: ['.jpg', '.jpeg', '.png', '.gif']
      };
    }
  } catch (error) {
    console.error(`Error loading config file: ${error.message}`);
    return { 
      subfolders: [], 
      exclusionPatterns: [],
      imageFileExtensions: ['.jpg', '.jpeg', '.png', '.gif']
    };
  }
};

// Local Folder client (reads from mounted directory)
class LocalFolderClient {
  constructor(config) {
    this.config = config;
    console.log(`Local folder client initialized with path: ${config.mountedPath}`);
  }

  async connect() {
    console.log(`Checking mounted folder at ${this.config.mountedPath}...`);
    // Check if the mounted folder exists
    return new Promise((resolve, reject) => {
      fs.access(this.config.mountedPath, fs.constants.F_OK | fs.constants.R_OK, (err) => {
        if (err) {
          console.error(`Mounted folder not accessible: ${err.message}`);
          reject(err);
        } else {
          console.log('Mounted folder is accessible');
          resolve(true);
        }
      });
    });
  }

  // List files from a given directory
  async listFiles(directory) {
    console.log(`Listing files in ${directory}...`);
    
    // Create a full path for the directory to read
    const fullPath = path.resolve(this.config.mountedPath, directory.replace(/^\//, ''));
    console.log(`Reading from: ${fullPath}`);
    
    return new Promise((resolve, reject) => {
      fs.readdir(fullPath, { withFileTypes: true }, async (err, entries) => {
        if (err) {
          console.error(`Error reading directory: ${err.message}`);
          reject(err);
          return;
        }
        
        // Process files and collect stats
        const filePromises = entries
          .filter(entry => entry.isFile())
          .map(async entry => {
            const filePath = path.join(fullPath, entry.name);
            try {
              const stats = await fs.promises.stat(filePath);
              return {
                path: path.join(directory, entry.name),  // Keep the original directory structure
                filename: entry.name,
                size: stats.size,
                lastModified: stats.mtime.toISOString()
              };
            } catch (statError) {
              console.error(`Error getting stats for ${entry.name}: ${statError.message}`);
              return null;
            }
          });
          
        // Wait for all file stats to be collected
        const files = (await Promise.all(filePromises)).filter(file => file !== null);
        console.log(`Found ${files.length} files in ${fullPath}`);
        resolve(files);
      });
    });
  }

  // List files from specified subfolders
  async listFilesFromSubfolders(subfolders, exclusionPatterns = []) {
    // Format for logging
    const subfolderStrings = subfolders.map(sub => {
      if (typeof sub === 'string') return sub;
      return `${sub.path}${sub.recursive ? ' (recursive)' : ' (non-recursive)'}`;
    });
    
    console.log(`Listing files from subfolders: ${subfolderStrings.join(', ')}`);
    if (exclusionPatterns.length > 0) {
      console.log(`With exclusion patterns: ${exclusionPatterns.join(', ')}`);
    }
    
    let allFiles = [];
    
    for (const subfolder of subfolders) {
      // Handle both object and string format
      const folderPath = typeof subfolder === 'string' ? subfolder : subfolder.path;
      const recursive = typeof subfolder === 'string' ? true : (subfolder.recursive !== false);
      
      console.log(`Processing subfolder: ${folderPath} (${recursive ? 'recursive' : 'non-recursive'})`);
      const fullPath = path.join(this.config.mountedPath, folderPath);
      
      try {
        // Check if the subfolder exists
        if (!await fs.pathExists(fullPath)) {
          console.log(`Subfolder does not exist: ${fullPath}`);
          continue;
        }
        
        // Get files, optionally recursively
        const getFiles = async (dirPath, shouldRecurse) => {
          const entries = await fs.readdir(dirPath, { withFileTypes: true });
          
          let files = [];
          
          for (const entry of entries) {
            const fullEntryPath = path.join(dirPath, entry.name);
            
            // Skip if matches exclusion pattern
            const relativePath = fullEntryPath.substring(this.config.mountedPath.length + 1);
            
            if (exclusionPatterns.some(pattern => {
              // Convert glob pattern to regex
              const regexPattern = pattern
                .replace(/\./g, '\\.')
                .replace(/\*/g, '.*')
                .replace(/\?/g, '.');
              const regex = new RegExp(`^${regexPattern}$`, 'i');
              return regex.test(relativePath) || regex.test(entry.name);
            })) {
              console.log(`Skipping excluded path: ${relativePath}`);
              continue;
            }
            
            if (entry.isDirectory() && shouldRecurse) {
              // Recursively get files from subdirectories only if recursive is enabled
              const nestedFiles = await getFiles(fullEntryPath, shouldRecurse);
              files = files.concat(nestedFiles);
            } else if (entry.isFile()) {
              try {
                const stats = await fs.stat(fullEntryPath);
                files.push({
                  path: relativePath,
                  filename: entry.name,
                  size: stats.size,
                  lastModified: stats.mtime.toISOString()
                });
              } catch (statError) {
                console.error(`Error getting stats for ${entry.name}: ${statError.message}`);
              }
            }
          }
          
          return files;
        };
        
        const files = await getFiles(fullPath, recursive);
        console.log(`Found ${files.length} files in subfolder: ${folderPath}`);
        
        allFiles = allFiles.concat(files);
      } catch (error) {
        console.error(`Error processing subfolder ${subfolder}: ${error.message}`);
      }
    }
    
    console.log(`Total files found across all subfolders: ${allFiles.length}`);
    return allFiles;
  }

  async downloadFile(remotePath, localPath) {
    console.log(`Copying ${remotePath} to ${localPath}...`);
    
    // Create full path for the source file
    let sourcePath;
    if (path.isAbsolute(remotePath)) {
      sourcePath = remotePath;
    } else {
      // Remove leading slash if present and join with mounted path
      sourcePath = path.join(this.config.mountedPath, remotePath.replace(/^\//, ''));
    }
    
    return new Promise((resolve, reject) => {
      // Ensure the destination directory exists
      const dir = path.dirname(localPath);
      fs.ensureDir(dir)
        .then(() => {
          // Copy the file
          fs.copy(sourcePath, localPath)
            .then(() => {
              console.log(`Copied ${remotePath}`);
              resolve({ success: true, path: localPath });
            })
            .catch(err => {
              console.error(`Error copying file: ${err.message}`);
              reject(err);
            });
        })
        .catch(err => {
          console.error(`Error creating directory: ${err.message}`);
          reject(err);
        });
    });
  }

  // Function to clear local photos directory
  async clearLocalPhotos() {
    console.log(`Clearing local photos directory at: ${photosDir}`);
    
    try {
      // Read all files in the directory
      const files = await fs.readdir(photosDir);
      
      // Delete each file
      for (const file of files) {
        const filePath = path.join(photosDir, file);
        
        // Check if it's a file (not a directory)
        const stats = await fs.stat(filePath);
        if (stats.isFile()) {
          await fs.unlink(filePath);
          console.log(`Removed file: ${file}`);
        }
      }
      
      console.log('Local photos directory cleared successfully');
      return { success: true, count: files.length };
    } catch (error) {
      console.error(`Error clearing local photos directory: ${error.message}`);
      throw error;
    }
  }
}

// Create client instance
const getNASClient = () => {
  return new LocalFolderClient({
    mountedPath: process.env.MOUNTED_PHOTOS_PATH || '/mnt/photos',
    // Keep these for backward compatibility
    host: process.env.NAS_HOST || '192.168.1.100',
    username: process.env.NAS_USERNAME || 'admin',
    password: process.env.NAS_PASSWORD || 'password'
  });
};

// Helper function to clear local photos directory
const clearLocalPhotos = async () => {
  const client = getNASClient();
  return await client.clearLocalPhotos();
};

// Scan mounted folder for photos
const scanNAS = async () => {
  console.log('Starting mounted folder scan...');
  
  try {
    const client = getNASClient();
    await client.connect();
    
    // Get configuration from config.json
    const { subfolders, exclusionPatterns, imageFileExtensions } = loadPhotoScanConfig();
    
    let photos;
    
    if (subfolders.length > 0) {
      // Format for logging
      const subfolderLog = subfolders.map(sub => {
        if (typeof sub === 'string') return sub;
        return `${sub.path}${sub.recursive ? ' (recursive)' : ' (non-recursive)'}`;
      }).join(', ');
      
      console.log(`Using configured subfolders: ${subfolderLog}`);
      photos = await client.listFilesFromSubfolders(subfolders, exclusionPatterns);
    } else {
      // Fallback to scanning the root directory if no subfolders are specified
      const photosSubDir = '';
      console.log(`No subfolders found, scanning root directory: "${photosSubDir}"`);
      photos = await client.listFiles(photosSubDir);
    }
    
    console.log(`Found ${photos.length} files in mounted folder`);
    
    // Filter for image files only
    console.log(`Filtering for image file extensions: ${imageFileExtensions.join(', ')}`);
    const imageFiles = photos.filter(photo => {
      const ext = path.extname(photo.filename).toLowerCase();
      return imageFileExtensions.includes(ext);
    });
    
    console.log(`Found ${imageFiles.length} image files`);
    
    // Save to database
    const result = await saveNASPhotos(imageFiles);
    console.log(`Saved ${result.inserted} new photos to database`);
    
    return result;
  } catch (error) {
    console.error(`Error scanning mounted folder: ${error.message}`);
    throw error;
  }
};

module.exports = {
  getNASClient,
  scanNAS,
  clearLocalPhotos
};
