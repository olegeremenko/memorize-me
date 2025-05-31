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
    const statsActivePhotos = document.getElementById('stats-active-photos');
    const statsDeletedPhotos = document.getElementById('stats-deleted-photos');
    
    // Load the statistics when the page loads
    loadPhotoStats();
    
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
                statsActivePhotos.textContent = stats.active_photos || 0;
                statsDeletedPhotos.textContent = stats.deleted_photos || 0;
            } else {
                // Set default values if no stats were returned
                statsTotalPhotos.textContent = '0';
                statsLastScan.textContent = 'Never';
                statsActivePhotos.textContent = '0';
                statsDeletedPhotos.textContent = '0';
            }
        } catch (error) {
            console.error('Error loading photo stats:', error);
            // Set error state
            statsTotalPhotos.textContent = 'Error';
            statsLastScan.textContent = 'Error';
            statsActivePhotos.textContent = 'Error';
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
    
    // Scan NAS for photos
    const scanNAS = async () => {
        try {
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
                showErrorMessage('NAS scan failed: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error scanning NAS:', error);
            showErrorMessage('Failed to communicate with server for NAS scan');
        }
    };
    
    // Fetch photos from NAS
    const fetchPhotos = async () => {
        try {
            const defaultCount = 10; // Default number of photos to fetch
            statusMessageEl.textContent = `Fetching ${defaultCount} photos...`;
            
            const response = await fetch('/api/admin/fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ count: defaultCount })
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
        }
    };
    
    // Load and display database photos in the modal
    const loadDatabasePhotos = async () => {
        try {
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
    
    // Event listeners
    scanButton.addEventListener('click', scanNAS);
    fetchButton.addEventListener('click', fetchPhotos);
    showDatabaseButton.addEventListener('click', openDatabaseModal);
    closeModal.addEventListener('click', closeDatabaseModal);
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === photoDatabaseModal) {
            closeDatabaseModal();
        }
    });
});
