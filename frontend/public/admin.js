// Admin panel script
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const scanButton = document.getElementById('scan-button');
    const fetchButton = document.getElementById('fetch-button');
    const statusMessageEl = document.getElementById('status-message');
    const showDatabaseButton = document.getElementById('show-database-button');
    const photoDatabaseModal = document.getElementById('photo-database-modal');
    const photoTableBody = document.getElementById('photos-table-body');
    const photoCount = document.getElementById('photo-count');
    const closeModal = document.querySelector('.close');
    const backgroundProcessesPanel = document.getElementById('background-processes');
    
    // Stats elements
    const statsTotalPhotos = document.getElementById('stats-total-photos');
    const statsLastScan = document.getElementById('stats-last-scan');
    const statsLocalPhotos = document.getElementById('stats-local-photos');
    const statsDeletedPhotos = document.getElementById('stats-deleted-photos');
    
    // Settings elements
    const slideshowIntervalInput = document.getElementById('slideshow-interval');
    const photosPerDayInput = document.getElementById('photos-per-day');
    const sameDayPhotosInput = document.getElementById('same-day-photos');
    const saveSettingsButton = document.getElementById('save-settings-button');
    const showNasConfigButton = document.getElementById('show-nas-config-button');
    
    // Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
    // NAS Config modal elements
    const nasConfigModal = document.getElementById('nas-config-modal');
    const nasConfigModalClose = nasConfigModal.querySelector('.close');
    const nasConfigContent = document.getElementById('nas-config-content');
    
    // Global variable to store NAS config
    let currentNasConfig = null;
    
    // Job tracking
    const activeJobs = new Set();
    let jobPollingInterval = null;
    
    // Pagination state
    let currentPage = 1;
    let totalPages = 1;
    let totalPhotos = 0;
    const pageSize = 100;
    let deletedFilter = false;
    
    // Initialize tab functionality
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));
            
            // Hide all tab contents
            tabContents.forEach(content => content.style.display = 'none');
            
            // Add active class to clicked button
            button.classList.add('active');
            
            // Show corresponding tab content
            const tabId = button.getAttribute('data-tab');
            document.getElementById(`${tabId}-tab`).style.display = 'block';
        });
    });
    
    // Load the statistics and settings when the page loads
    loadPhotoStats();
    loadSettings();
    
    // Function to load and display photo statistics
    async function loadPhotoStats() {
        const statsLoader = document.getElementById('stats-loader');
        const statsContent = document.getElementById('stats-content');
        
        try {
            statsLoader.style.display = 'block';
            statsContent.style.display = 'none';
            
            const response = await fetch('/api/stats/stats');
            const data = await response.json();
            
            if (data && data.stats) {
                const stats = data.stats;
                
                // Format the last scan time
                const lastScanTime = stats.last_scan_time 
                    ? new Date(stats.last_scan_time).toLocaleString()
                    : 'Never';
                
                // Update the DOM elements
                statsTotalPhotos.textContent = stats.total_photos || 0;
                statsLastScan.textContent = lastScanTime;
                statsDeletedPhotos.textContent = stats.deleted_photos || 0;
                
                // Get dynamic slideshow stats from photos endpoint
                updateSlideshowStats();
            } else {
                // Set default values if no stats were returned
                statsTotalPhotos.textContent = '0';
                statsLastScan.textContent = 'Never';
                statsLocalPhotos.textContent = '0';
                statsDeletedPhotos.textContent = '0';
            }
            
            statsLoader.style.display = 'none';
            statsContent.style.display = 'block';
        } catch (error) {
            console.error('Error loading photo stats:', error);
            showStatusMessage('Error loading photo stats', 'error');
            statsLoader.style.display = 'none';
            statsContent.style.display = 'block';
            // Set error state
            statsTotalPhotos.textContent = 'Error';
            statsLastScan.textContent = 'Error';
            statsLocalPhotos.textContent = 'Error';
            statsDeletedPhotos.textContent = 'Error';
        }
    }
    
    // Show error message
    const showErrorMessage = (message) => {
        statusMessageEl.textContent = message;
        statusMessageEl.style.color = 'red';
        
        setTimeout(() => {
            statusMessageEl.textContent = '';
        }, 5000);
    };
    
    // Show success message
    const showSuccessMessage = (message) => {
        statusMessageEl.textContent = message;
        statusMessageEl.style.color = '#4CAF50';
        
        setTimeout(() => {
            statusMessageEl.textContent = '';
        }, 5000);
    };

    // Update slideshow statistics dynamically from photos endpoint
    const updateSlideshowStats = async () => {
        try {
            const response = await fetch('/api/photos');
            const data = await response.json();
            
            if (data && data.photos) {
                const totalSlideshowPhotos = data.photos.length;
                const sameDayCount = data.photos.filter(photo => photo.same_day).length;
                
                statsLocalPhotos.textContent = `${totalSlideshowPhotos}${sameDayCount > 0 ? ` (${sameDayCount} Same day)` : ''}`;
            } else {
                statsLocalPhotos.textContent = '0';
            }
        } catch (error) {
            console.error('Error fetching slideshow stats:', error);
            statsLocalPhotos.textContent = 'Error loading';
        }
    };

    // Navigate to specific photo in slideshow
    const navigateToPhotoInSlideshow = (photo) => {
        // Store the target photo info in localStorage for the slideshow to pick up
        const targetPhoto = {
            filename: photo.local_path,
            nas_filename: photo.nas_filename,
            downloaded_id: photo.downloaded_id,
            timestamp: Date.now()
        };
        localStorage.setItem('memorize_me_target_photo', JSON.stringify(targetPhoto));
        
        // Close the modal and navigate to slideshow
        closeDatabaseModal();
        window.location.href = '/';
    };

    // Make functions globally accessible for pagination and navigation
    window.navigateToPhotoInSlideshow = navigateToPhotoInSlideshow;
    
    // Set button loading state
    const setButtonLoading = (button, loading) => {
        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
        } else {
            button.disabled = false;
            button.classList.remove('loading');
        }
    };
    
    // Job polling functions
    const startJobPolling = () => {
        if (jobPollingInterval) return;
        
        jobPollingInterval = setInterval(async () => {
            if (activeJobs.size === 0) {
                stopJobPolling();
                return;
            }
            
            try {
                // Check each active job
                for (const jobId of activeJobs) {
                    const response = await fetch(`/api/admin/jobs/${jobId}`);
                    if (response.ok) {
                        const job = await response.json();
                        
                        if (job.status === 'completed') {
                            handleJobCompleted(job);
                            activeJobs.delete(jobId);
                        } else if (job.status === 'failed') {
                            handleJobFailed(job);
                            activeJobs.delete(jobId);
                        }
                    } else if (response.status === 404) {
                        // Job not found, probably completed and cleaned up
                        console.log(`Job ${jobId} not found, removing from tracking`);
                        removeProcessFromPanel(jobId);
                        activeJobs.delete(jobId);
                    }
                }
            } catch (error) {
                console.error('Error polling jobs:', error);
            }
        }, 2000); // Poll every 2 seconds
    };
    
    const stopJobPolling = () => {
        if (jobPollingInterval) {
            clearInterval(jobPollingInterval);
            jobPollingInterval = null;
        }
    };
    
    const handleJobCompleted = (job) => {
        removeProcessFromPanel(job.id);
        
        if (job.type === 'scan') {
            showSuccessMessage(`NAS scan completed: ${job.result?.inserted || 0} new photos found`);
        } else if (job.type === 'fetch') {
            showSuccessMessage(`Photo fetch completed: ${job.result?.fetched || 0} of ${job.result?.total || 0} photos fetched`);
        }
        loadPhotoStats(); // Refresh stats
    };
    
    const handleJobFailed = (job) => {
        removeProcessFromPanel(job.id);
        
        if (job.type === 'scan') {
            showErrorMessage(`NAS scan failed: ${job.error || 'Unknown error'}`);
        } else if (job.type === 'fetch') {
            showErrorMessage(`Photo fetch failed: ${job.error || 'Unknown error'}`);
        }
    };
    
    const addActiveJob = (jobId, type, description) => {
        activeJobs.add(jobId);
        addProcessToPanel(jobId, type, description);
        startJobPolling();
    };
    
    const addProcessToPanel = (jobId, type, description, isResumed = false) => {
        const processItem = document.createElement('div');
        processItem.className = 'process-item';
        processItem.id = `process-${jobId}`;
        
        const statusText = isResumed ? 'In Progress...' : 'Running...';
        
        processItem.innerHTML = `
            <div class="process-info">
                <span class="process-running"></span>
                <span class="process-description">${description}</span>
            </div>
            <div class="process-status">${statusText}</div>
        `;
        
        backgroundProcessesPanel.appendChild(processItem);
        backgroundProcessesPanel.style.display = 'block';
    };
    
    const removeProcessFromPanel = (jobId) => {
        const processItem = document.getElementById(`process-${jobId}`);
        if (processItem) {
            processItem.remove();
        }
        
        // Hide panel if no processes remain
        if (backgroundProcessesPanel.children.length === 0) {
            backgroundProcessesPanel.style.display = 'none';
        }
    };
    
    // Check for existing active jobs on page load
    const checkForActiveJobs = async () => {
        try {
            const response = await fetch('/api/admin/jobs');
            if (response.ok) {
                const data = await response.json();
                
                if (data.hasActiveJobs && data.activeJobs.length > 0) {
                    // Resume tracking existing jobs
                    data.activeJobs.forEach(job => {
                        activeJobs.add(job.id);
                        
                        let description = '';
                        if (job.type === 'scan') {
                            description = 'Scanning NAS for new photos';
                        } else if (job.type === 'fetch') {
                            description = 'Fetching photos from NAS';
                        }
                        
                        addProcessToPanel(job.id, job.type, description, true);
                        
                        // Add resumed styling
                        const processItem = document.getElementById(`process-${job.id}`);
                        if (processItem) {
                            processItem.classList.add('resumed');
                        }
                    });
                    
                    // Start polling to track these jobs
                    startJobPolling();
                    
                    // Update status message
                    const jobTypes = data.activeJobs.map(job => job.type).join(' and ');
                    statusMessageEl.textContent = `Resuming tracking of ${jobTypes} operation(s)...`;
                    statusMessageEl.style.color = '#ffa500';
                }
            }
        } catch (error) {
            console.error('Error checking for active jobs:', error);
        }
    };
    
    // Scan NAS for photos
    const scanNAS = async () => {
        try {
            setButtonLoading(scanButton, true);
            statusMessageEl.textContent = 'Starting NAS scan...';
            
            const response = await fetch('/api/admin/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.isAsync) {
                // Async operation started
                showSuccessMessage('NAS scan started in background. You will be notified when complete.');
                addActiveJob(data.jobId, 'scan', 'Scanning NAS for new photos');
                statusMessageEl.textContent = 'NAS scan running in background...';
            } else if (data.success) {
                // Synchronous completion (shouldn't happen anymore)
                showSuccessMessage(`NAS scan completed: ${data.result?.inserted || 0} new photos found`);
                loadPhotoStats();
            } else {
                // Handle specific case where scan is already in progress
                if (response.status === 409 && data.isScanInProgress) {
                    showErrorMessage('A NAS scan is already in progress. Please wait for it to complete.');
                } else {
                    showErrorMessage('NAS scan failed: ' + (data.error || 'Unknown error'));
                }
            }
        } catch (error) {
            console.error('Error scanning NAS:', error);
            showErrorMessage('Failed to communicate with server for NAS scan');
        } finally {
            setButtonLoading(scanButton, false);
        }
    };
    
    // Fetch photos from NAS
    const fetchPhotos = async () => {
        try {
            setButtonLoading(fetchButton, true);
            // Use the value from the settings input field
            const count = parseInt(photosPerDayInput.value) || 10;
            statusMessageEl.textContent = `Starting fetch of ${count} photos...`;
            
            const response = await fetch('/api/admin/fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ count: count })
            });
            
            const data = await response.json();
            
            if (data.success && data.isAsync) {
                // Async operation started
                showSuccessMessage(`Photo fetch started in background (${data.count} photos). You will be notified when complete.`);
                addActiveJob(data.jobId, 'fetch', `Fetching ${data.count} photos from NAS`);
                statusMessageEl.textContent = `Fetching ${data.count} photos in background...`;
            } else if (data.success) {
                // Synchronous completion (shouldn't happen anymore)
                showSuccessMessage(`Photos fetched: ${data.result?.fetched || 0} of ${data.result?.total || 0}`);
                loadPhotoStats();
            } else {
                // Handle specific case where fetch is already in progress
                if (response.status === 409 && data.isFetchInProgress) {
                    showErrorMessage('A photo fetch is already in progress. Please wait for it to complete.');
                } else {
                    showErrorMessage('Photo fetch failed: ' + (data.error || 'Unknown error'));
                }
            }
        } catch (error) {
            console.error('Error fetching photos:', error);
            showErrorMessage('Failed to communicate with server for fetching photos');
        } finally {
            setButtonLoading(fetchButton, false);
        }
    };
    
    // Load and display database photos in the modal
    const loadDatabasePhotos = async (page = 1, useCurrentFilter = true) => {
        try {
            setButtonLoading(showDatabaseButton, true);
            if (useCurrentFilter) {
                deletedFilter = document.getElementById('deleted-filter')?.checked || false;
            }
            
            let filterText = '';
            if (deletedFilter) filterText = ' (deleted only)';
            
            statusMessageEl.textContent = `Loading database photos${filterText} (page ${page})...`;
            
            const filterParams = [];
            if (deletedFilter) filterParams.push('deletedOnly=true');
            const filterParam = filterParams.length > 0 ? '&' + filterParams.join('&') : '';
            const url = `/api/stats?page=${page}&limit=${pageSize}${filterParam}`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.photos) {
                currentPage = data.pagination.currentPage;
                totalPages = data.pagination.totalPages;
                totalPhotos = data.pagination.totalCount;
                
                displayDatabasePhotos(data.photos);
                updatePaginationControls();
                showSuccessMessage(`Loaded page ${currentPage} of ${totalPages} (${data.photos.length} photos)`);
            } else {
                photoTableBody.innerHTML = '<tr><td colspan="7">No photos found in database</td></tr>';
                showErrorMessage('No photos found in database');
            }
        } catch (error) {
            console.error('Error loading database photos:', error);
            showErrorMessage('Failed to load database photos');
            photoTableBody.innerHTML = '<tr><td colspan="7">Error loading database photos</td></tr>';
        } finally {
            setButtonLoading(showDatabaseButton, false);
        }
    };
    
    // Update pagination controls
    const updatePaginationControls = () => {
        photoCount.textContent = `Total: ${totalPhotos} photos (page ${currentPage} of ${totalPages})`;
        
        const paginationContainer = document.getElementById('pagination-controls');
        if (!paginationContainer) return;
        
        let paginationHTML = '<div class="pagination-header">';
        
        // Previous button
        if (currentPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="loadDatabasePhotos(${currentPage - 1})">&laquo; Previous</button>`;
        } else {
            paginationHTML += '<button class="pagination-btn disabled">&laquo; Previous</button>';
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `<button class="pagination-btn" onclick="loadDatabasePhotos(${currentPage + 1})">Next &raquo;</button>`;
        } else {
            paginationHTML += '<button class="pagination-btn disabled">Next &raquo;</button>';
        }
        
        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;
    };
    
    // Display database photos in the modal table
    const displayDatabasePhotos = (dbPhotos) => {
        photoTableBody.innerHTML = '';
        
        dbPhotos.forEach(photo => {
            const row = document.createElement('tr');
            
            // Format size to MB
            const sizeMB = photo.nas_size ? (photo.nas_size / (1024 * 1024)).toFixed(2) + ' MB' : 'N/A';
            
            // Format date
            const lastModified = photo.nas_last_modified 
                ? new Date(photo.nas_last_modified).toLocaleDateString() 
                : 'N/A';
            
            // Check if photo is downloaded
            const isDownloaded = photo.downloaded_id ? true : false;
            const downloadedClass = isDownloaded ? 'downloaded-yes' : 'downloaded-no';
            const downloadedText = isDownloaded ? 'Yes' : 'No';
            const slideshowCell = `<span class="${downloadedClass}">${downloadedText}</span>`;
            
            // Create download link/icon based on availability
            let downloadCell = 'N/A';
            
            if (isDownloaded && photo.local_path) {
                // Check if file actually exists locally
                if (photo.file_exists_locally) {
                    // Local file exists - direct download
                    const localFilename = photo.local_path.split('/').pop();
                    downloadCell = `<a href="/photos/${encodeURIComponent(localFilename)}" target="_blank" class="download-link local-download" title="View local photo">
                        📥
                    </a>`;
                } else {
                    // File was downloaded but local file missing - download from NAS
                    downloadCell = `<a href="/api/admin/download-nas/${photo.nas_id}" target="_blank" class="download-link nas-download" title="Download from NAS (file missing locally)">
                        🌐
                    </a>`;
                }
            } else if (photo.nas_id) {
                // Never downloaded - option to download from NAS
                downloadCell = `<a href="/api/admin/download-nas/${photo.nas_id}" target="_blank" class="download-link nas-download" title="Download from NAS">
                    🌐
                </a>`;
            }
            
            // Create table cells
            row.innerHTML = `
                <td>${photo.nas_id || 'N/A'}</td>
                <td>
                    <div class="file-info">
                        <div class="file-name">${photo.nas_filename || 'N/A'}</div>
                        <div class="file-path">${photo.nas_path || 'N/A'}</div>
                    </div>
                </td>
                <td>${sizeMB}</td>
                <td>${lastModified}</td>
                <td class="slideshow-cell">${slideshowCell}</td>
                <td class="download-cell">${downloadCell}</td>
            `;
            
            photoTableBody.appendChild(row);
        });
    };
    
    // Make loadDatabasePhotos globally accessible for pagination
    window.loadDatabasePhotos = loadDatabasePhotos;
    
    // Open the database photos modal
    const openDatabaseModal = async () => {
        photoDatabaseModal.style.display = 'block';
        
        // Add filter toggle event listeners
        const deletedFilterToggle = document.getElementById('deleted-filter');
        
        if (deletedFilterToggle) {
            deletedFilterToggle.addEventListener('change', () => {
                currentPage = 1; // Reset to first page when filter changes
                loadDatabasePhotos(1, true);
            });
        }
        
        await loadDatabasePhotos(1); // Always start from page 1
    };
    
    // Close the database photos modal
    const closeDatabaseModal = () => {
        photoDatabaseModal.style.display = 'none';
    };
    
    // Function to load system settings
    async function loadSettings() {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            
            if (data && data.settings) {
                const settings = data.settings;
                
                // Update the input fields
                slideshowIntervalInput.value = settings.slideshowInterval || 300;
                photosPerDayInput.value = settings.photosPerDay || 10;
                sameDayPhotosInput.value = settings.sameDayPhotos || 1;
            } else {
                // Set default values if no settings were returned
                slideshowIntervalInput.value = 300;
                photosPerDayInput.value = 10;
                sameDayPhotosInput.value = 1;
            }
            
            // Store NAS config for display
            if (data && data.nasConfig) {
                currentNasConfig = data.nasConfig;
            }
        } catch (error) {
            console.error('Error loading settings:', error);
            showErrorMessage('Failed to load system settings');
        }
    }
    
    // Function to save system settings
    async function saveSettings() {
        try {
            setButtonLoading(saveSettingsButton, true);
            statusMessageEl.textContent = 'Saving settings...';
            
            const slideshowInterval = parseInt(slideshowIntervalInput.value);
            const photosPerDay = parseInt(photosPerDayInput.value);
            const sameDayPhotos = parseInt(sameDayPhotosInput.value);
            
            // Basic validation
            if (isNaN(slideshowInterval) || slideshowInterval < 5) {
                showErrorMessage('Slideshow interval must be at least 5 seconds');
                return;
            }
            
            if (isNaN(photosPerDay) || photosPerDay < 1 || photosPerDay > 100) {
                showErrorMessage('Photos per day must be between 1 and 100');
                return;
            }
            
            if (isNaN(sameDayPhotos) || sameDayPhotos < 0 || sameDayPhotos > 10) {
                showErrorMessage('Same day photos must be between 0 and 10');
                return;
            }
            
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ slideshowInterval, photosPerDay, sameDayPhotos })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSuccessMessage('Settings saved successfully');
                
                // Update local storage for slideshow interval (used by app.js)
                localStorage.setItem('slideshow-interval', slideshowInterval * 1000);
            } else {
                showErrorMessage('Failed to save settings: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showErrorMessage('Failed to save settings');
        } finally {
            setButtonLoading(saveSettingsButton, false);
        }
    }
    
    // Event listeners
    scanButton.addEventListener('click', scanNAS);
    fetchButton.addEventListener('click', fetchPhotos);
    saveSettingsButton.addEventListener('click', saveSettings);
    showDatabaseButton.addEventListener('click', openDatabaseModal);
    closeModal.addEventListener('click', closeDatabaseModal);
    showNasConfigButton.addEventListener('click', showNasConfigModal);
    nasConfigModalClose.addEventListener('click', closeNasConfigModal);
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === photoDatabaseModal) {
            closeDatabaseModal();
        }
        if (event.target === nasConfigModal) {
            closeNasConfigModal();
        }
    });
    
    // Cleanup polling when page is unloaded
    window.addEventListener('beforeunload', () => {
        stopJobPolling();
    });
    
    // NAS Config Modal Functions
    function showNasConfigModal() {
        if (currentNasConfig) {
            displayNasConfig(currentNasConfig);
        } else {
            nasConfigContent.innerHTML = '<p>No NAS configuration found.</p>';
        }
        nasConfigModal.style.display = 'block';
    }
    
    function closeNasConfigModal() {
        nasConfigModal.style.display = 'none';
    }
    
    function displayNasConfig(config) {
        let html = '<div class="nas-config-display">';
        
        // Subfolders
        html += '<h3>Tracked Folders:</h3>';
        if (config.subfolders && config.subfolders.length > 0) {
            html += '<ul>';
            config.subfolders.forEach(folder => {
                if (typeof folder === 'string') {
                    html += `<li><strong>${folder}</strong></li>`;
                } else {
                    html += `<li><strong>${folder.path}</strong> ${folder.recursive ? '(recursive)' : '(non-recursive)'}</li>`;
                }
            });
            html += '</ul>';
        } else {
            html += '<p>No specific folders configured (scanning root directory)</p>';
        }
        
        // Exclusion patterns
        html += '<h3>Exclusion Patterns:</h3>';
        if (config.exclusionPatterns && config.exclusionPatterns.length > 0) {
            html += '<ul>';
            config.exclusionPatterns.forEach(pattern => {
                html += `<li><code>${pattern}</code></li>`;
            });
            html += '</ul>';
        } else {
            html += '<p>No exclusion patterns configured</p>';
        }
        
        // File extensions
        html += '<h3>Supported File Extensions:</h3>';
        if (config.imageFileExtensions && config.imageFileExtensions.length > 0) {
            html += '<div class="file-extensions">';
            config.imageFileExtensions.forEach(ext => {
                html += `<span class="file-ext-badge">${ext}</span>`;
            });
            html += '</div>';
        } else {
            html += '<p>No file extensions configured</p>';
        }
        
        html += '</div>';
        nasConfigContent.innerHTML = html;
    }
    
    // Check for active jobs after all functions are declared
    checkForActiveJobs();
});
