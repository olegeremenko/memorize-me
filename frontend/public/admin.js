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
    
    // Stats elements
    const statsTotalPhotos = document.getElementById('stats-total-photos');
    const statsLastScan = document.getElementById('stats-last-scan');
    const statsLocalPhotos = document.getElementById('stats-local-photos');
    const statsDeletedPhotos = document.getElementById('stats-deleted-photos');
    
    // Settings elements
    const slideshowIntervalInput = document.getElementById('slideshow-interval');
    const photosPerDayInput = document.getElementById('photos-per-day');
    const saveSettingsButton = document.getElementById('save-settings-button');
    
    // Tab Navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    
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
        try {
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
                statsLocalPhotos.textContent = stats.local_photos_count || 0;
                statsDeletedPhotos.textContent = stats.deleted_photos || 0;
            } else {
                // Set default values if no stats were returned
                statsTotalPhotos.textContent = '0';
                statsLastScan.textContent = 'Never';
                statsLocalPhotos.textContent = '0';
                statsDeletedPhotos.textContent = '0';
            }
        } catch (error) {
            console.error('Error loading photo stats:', error);
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
    
    // Scan NAS for photos
    const scanNAS = async () => {
        try {
            setButtonLoading(scanButton, true);
            statusMessageEl.textContent = 'Scanning NAS...';
            
            const response = await fetch('/api/admin/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSuccessMessage(`NAS scan completed: ${data.result.inserted} new photos found`);
                // Reload stats after scanning
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
            statusMessageEl.textContent = `Fetching ${count} photos...`;
            
            const response = await fetch('/api/admin/fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ count: count })
            });
            
            const data = await response.json();
            
            if (data.success) {
                showSuccessMessage(`Photos fetched: ${data.result.fetched} of ${data.result.total}`);
                // Reload stats after fetching
                loadPhotoStats();
            } else {
                showErrorMessage('Photo fetch failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error fetching photos:', error);
            showErrorMessage('Failed to communicate with server for fetching photos');
        } finally {
            setButtonLoading(fetchButton, false);
        }
    };
    
    // Load and display database photos in the modal
    const loadDatabasePhotos = async () => {
        try {
            setButtonLoading(showDatabaseButton, true);
            statusMessageEl.textContent = 'Loading database photos...';
            
            const response = await fetch('/api/stats');
            const data = await response.json();
            
            if (data && data.photos) {
                displayDatabasePhotos(data.photos);
                showSuccessMessage(`Loaded ${data.photos.length} database photos`);
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
    
    // Display database photos in the modal table
    const displayDatabasePhotos = (dbPhotos) => {
        photoTableBody.innerHTML = '';
        photoCount.textContent = `Total: ${dbPhotos.length} photos`;
        
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
                <td class="${downloadedClass}">${downloadedText}</td>
                <td>${photo.local_path || 'N/A'}</td>
                <td>${photo.downloads_count || '0'}</td>
            `;
            
            photoTableBody.appendChild(row);
        });
    };
    
    // Open the database photos modal
    const openDatabaseModal = async () => {
        photoDatabaseModal.style.display = 'block';
        await loadDatabasePhotos();
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
            } else {
                // Set default values if no settings were returned
                slideshowIntervalInput.value = 300;
                photosPerDayInput.value = 10;
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
            
            // Basic validation
            if (isNaN(slideshowInterval) || slideshowInterval < 5) {
                showErrorMessage('Slideshow interval must be at least 5 seconds');
                return;
            }
            
            if (isNaN(photosPerDay) || photosPerDay < 1 || photosPerDay > 100) {
                showErrorMessage('Photos per day must be between 1 and 100');
                return;
            }
            
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ slideshowInterval, photosPerDay })
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
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === photoDatabaseModal) {
            closeDatabaseModal();
        }
    });
});
