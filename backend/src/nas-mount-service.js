const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const MOUNTED_PHOTOS_PATH = process.env.MOUNTED_PHOTOS_PATH || '/mnt/photos';
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
  const mountCmd = `mount -t cifs '${remote}' '${MOUNTED_PHOTOS_PATH}' -o username='${NAS_USERNAME}',password='${NAS_PASSWORD}',rw,vers=3.0`;

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

module.exports = {
  ensureMount
};
