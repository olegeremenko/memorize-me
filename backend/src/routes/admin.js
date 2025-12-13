const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const { scanNAS, isScanningInProgress } = require('../nas-service');
const { fetchPhotos, isFetchingInProgress } = require('../photo-service');

const router = express.Router();

// Path to settings file
const settingsPath = path.join(process.cwd(), 'settings.json');

// Job tracking system
const jobs = new Map();

const createJob = (type, status = 'running') => {
  const jobId = Date.now().toString();
  const job = {
    id: jobId,
    type,
    status, // 'running', 'completed', 'failed'
    startTime: new Date().toISOString(),
    endTime: null,
    result: null,
    error: null
  };
  jobs.set(jobId, job);
  return job;
};

const updateJob = (jobId, updates) => {
  const job = jobs.get(jobId);
  if (job) {
    Object.assign(job, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      job.endTime = new Date().toISOString();
    }
  }
  return job;
};

const getJob = (jobId) => jobs.get(jobId);

const getActiveJobs = () => {
  return Array.from(jobs.values()).filter(job => job.status === 'running');
};

router.post('/scan', async (req, res) => {
  try {
    // Check if scan is already running
    if (isScanningInProgress()) {
      return res.status(409).json({ 
        success: false,
        error: 'NAS scan is already in progress',
        isScanInProgress: true 
      });
    }

    // Create job and start async operation
    const job = createJob('scan');
    
    // Start scan in background
    scanNAS().then(result => {
      updateJob(job.id, {
        status: 'completed',
        result: result
      });
      console.log(`Scan job ${job.id} completed successfully`);
    }).catch(error => {
      updateJob(job.id, {
        status: 'failed',
        error: error.message
      });
      console.error(`Scan job ${job.id} failed:`, error.message);
    });

    // Return immediately with job info
    res.json({ 
      success: true, 
      message: 'NAS scan started in background',
      jobId: job.id,
      isAsync: true
    });
    
  } catch (error) {
    console.error('Error starting NAS scan:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to start NAS scan: ' + error.message 
    });
  }
});

router.post('/fetch', async (req, res) => {
  try {
    // Check if fetch is already running
    if (isFetchingInProgress()) {
      return res.status(409).json({ 
        success: false,
        error: 'Photo fetch is already in progress',
        isFetchInProgress: true 
      });
    }
    
    let defaultCount = 10;
    
    // Try to read from settings file
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = await fs.readJson(settingsPath);
        if (settings.photosPerDay) {
          defaultCount = settings.photosPerDay;
        }
      }
    } catch (err) {
      console.error('Error reading settings file:', err);
      // Use fallback if settings file can't be read
    }
    
    const count = req.body.count || defaultCount || parseInt(process.env.PHOTOS_PER_DAY);
    
    // Create job and start async operation
    const job = createJob('fetch');
    
    // Start fetch in background
    fetchPhotos(count).then(result => {
      updateJob(job.id, {
        status: 'completed',
        result: result
      });
      console.log(`Fetch job ${job.id} completed successfully`);
    }).catch(error => {
      updateJob(job.id, {
        status: 'failed',
        error: error.message
      });
      console.error(`Fetch job ${job.id} failed:`, error.message);
    });

    // Return immediately with job info
    res.json({ 
      success: true, 
      message: `Photo fetch started in background (${count} photos)`,
      jobId: job.id,
      count: count,
      isAsync: true
    });
    
  } catch (error) {
    console.error('Error starting photo fetch:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to start photo fetch: ' + error.message 
    });
  }
});

// Endpoint to check scan status
router.get('/scan/status', (req, res) => {
  res.json({ 
    isScanInProgress: isScanningInProgress() 
  });
});

// Get job status
router.get('/jobs/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  res.json(job);
});

// Get all active jobs
router.get('/jobs', (req, res) => {
  const activeJobs = getActiveJobs();
  res.json({ 
    activeJobs,
    hasActiveJobs: activeJobs.length > 0
  });
});

// Get operation status
router.get('/status', (req, res) => {
  res.json({ 
    isScanInProgress: isScanningInProgress(),
    isFetchInProgress: isFetchingInProgress(),
    hasActiveOperations: isScanningInProgress() || isFetchingInProgress()
  });
});

module.exports = router;
