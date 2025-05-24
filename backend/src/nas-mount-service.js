const { exec } = require('child_process');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config();

const MOUNTED_PHOTOS_PATH = process.env.MOUNTED_PHOTOS_PATH;
const NAS_HOST = process.env.NAS_HOST;
const NAS_SHARE = process.env.NAS_SHARE;
const NAS_USERNAME = process.env.NAS_USERNAME;
const NAS_PASSWORD = process.env.NAS_PASSWORD;

// Check if the mount point is already mounted
function isMounted(mountPath) {
  return new Promise((resolve, reject) => {
    fs.readFile('/proc/mounts', 'utf8', (err, data) => {
      if (err) return reject(err);
      resolve(data.includes(mountPath));
    });
  });
}

// Mount the NAS share if not already mounted
async function ensureMount() {
  const alreadyMounted = await isMounted(MOUNTED_PHOTOS_PATH);
  if (alreadyMounted) {
    console.log(`Mount point ${MOUNTED_PHOTOS_PATH} is already mounted.`);
    return { mounted: true, alreadyMounted: true };
  }

  // Ensure the mount directory exists
  if (!fs.existsSync(MOUNTED_PHOTOS_PATH)) {
    fs.mkdirSync(MOUNTED_PHOTOS_PATH, { recursive: true });
  }

  // Build the mount command (CIFS/SMB)
  const remote = `//${NAS_HOST}/${NAS_SHARE}`;
  
  // First try with standard options
  const standardOptions = [
    `username='${NAS_USERNAME}'`,
    `password='${NAS_PASSWORD}'`,
    'vers=3.0',
    'sec=ntlmssp',
    'iocharset=utf8',
    'file_mode=0777',
    'dir_mode=0777',
    'noperm'
  ].join(',');
  
  const mountCmd = `mount -t cifs '${remote}' '${MOUNTED_PHOTOS_PATH}' -o ${standardOptions}`;

  return new Promise((resolve, reject) => {
    exec(mountCmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error mounting NAS: ${stderr}`);
        return reject(error);
      }
      console.log(`Mounted NAS share ${remote} to ${MOUNTED_PHOTOS_PATH}`);
      resolve({ mounted: true, alreadyMounted: false });
    });
  });
}

// Verify accessibility of the mounted directory
async function verifyMountAccess() {
  try {
    // Check if the path exists and is readable
    await fs.promises.access(MOUNTED_PHOTOS_PATH, fs.constants.F_OK | fs.constants.R_OK);
    
    // Try to list files in the directory as a connectivity test
    const files = await fs.promises.readdir(MOUNTED_PHOTOS_PATH);
    console.log(`Mount verification successful. Found ${files.length} items in root directory.`);
    return true;
  } catch (error) {
    console.error(`Mount verification failed: ${error.message}`);
    return false;
  }
}

// Comprehensive helper: ensure mount and verify access
async function ensureMountAndVerify() {
  try {
    // First ensure the mount is done
    const mountResult = await ensureMount();
    
    // Then verify we can actually access it
    const isAccessible = await verifyMountAccess();
    
    if (!isAccessible) {
      // If we can't access it even though it's mounted, try remounting
      if (mountResult.alreadyMounted) {
        console.log('Mount point exists but is not accessible. Attempting to remount...');
        
        // Check mount status for debugging
        await new Promise((resolve) => {
          exec('mount | grep cifs', (error, stdout) => {
            if (!error && stdout) {
              console.log('Current CIFS mounts:', stdout);
            }
            resolve();
          });
        });
        
        // Force unmount the current mount
        await new Promise((resolve, reject) => {
          exec(`umount -f ${MOUNTED_PHOTOS_PATH}`, async (error) => {
            if (error) {
              console.warn(`Could not force unmount: ${error.message}`);
              // Continue anyway
            }
            
            // Try mounting again
            try {
              await ensureMount();
              const retryAccess = await verifyMountAccess();
              if (retryAccess) {
                resolve({ mounted: true, accessible: true, remounted: true });
              } else {
                reject(new Error('Remount succeeded but access verification still failed'));
              }
            } catch (remountError) {
              reject(new Error(`Remount failed: ${remountError.message}`));
            }
          });
        });
      } else {
        throw new Error('Mount succeeded but access verification failed');
      }
    }
    
    return { mounted: true, accessible: true };
  } catch (error) {
    console.error(`Failed to ensure mount and verify access: ${error.message}`);
    throw error;
  }
}

module.exports = {
  ensureMount,
  verifyMountAccess,
  ensureMountAndVerify
};
