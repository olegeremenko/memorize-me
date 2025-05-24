// Main application script
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const currentPhotoEl = document.getElementById('current-photo');
    const photoNameEl = document.getElementById('photo-name');
    const photoDateEl = document.getElementById('photo-date');
    const photoDetailsEl = document.getElementById('photo-details');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const scanButton = document.getElementById('scan-button');
    const fetchButton = document.getElementById('fetch-button');
    const fetchCountInput = document.getElementById('fetch-count');
    const statusMessageEl = document.getElementById('status-message');
    const showDatabaseButton = document.getElementById('show-database-button');
    const photoDatabaseModal = document.getElementById('photo-database-modal');
    const photoTableBody = document.getElementById('photos-table-body');
    const photoCount = document.getElementById('photo-count');
    const closeModal = document.querySelector('.close');
    
    // Application state
    let photos = [];
    let currentPhotoIndex = 0;
    let slideshowInterval = null;
    const SLIDESHOW_INTERVAL = parseInt(localStorage.getItem('slideshow-interval')) || 300000; // 5 minutes default
      // Initialize the application
    const init = async () => {
        // Hide navigation buttons initially until we know we have photos
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
        
        try {
            await loadPhotos();
            if (photos.length > 0) {
                showPhoto(0);
                startSlideshow();
            } else {
                showNoPhotosMessage();
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            showErrorMessage('Failed to load photos. Please try again later.');
            showNoPhotosMessage(); // Show the logo even when there's an error
        }
    };
      // Load photos from the server
    const loadPhotos = async () => {
        try {
            const response = await fetch('/api/photos');
            const data = await response.json();
            
            if (data && data.photos && data.photos.length > 0) {
                photos = data.photos.map(photo => ({
                    ...photo,
                    id: photo.id,
                    name: photo.name,
                    path: photo.path,
                    date: photo.date,
                    size: photo.size,
                    displayCount: photo.displayCount || 0
                }));
                console.log(`Loaded ${photos.length} photos`);
                return photos;
            } else {
                photos = [];
                console.log('No photos available');
                return [];
            }
        } catch (error) {
            console.error('Error loading photos:', error);
            showErrorMessage('Failed to load photos from server.');
            return [];
        }
    };    // Display a photo by index
    const showPhoto = (index) => {
        if (photos.length === 0) return;
        
        // Show navigation buttons as we have photos to display
        prevButton.style.display = 'block';
        nextButton.style.display = 'block';
        
        currentPhotoIndex = index;
        
        // Handle wraparound
        if (currentPhotoIndex < 0) currentPhotoIndex = photos.length - 1;
        if (currentPhotoIndex >= photos.length) currentPhotoIndex = 0;
        
        const photo = photos[currentPhotoIndex];
        
        // Fade out current image
        currentPhotoEl.style.opacity = 0;
        
        // After fade out completes, change source and fade in
        setTimeout(() => {
            // Preload image
            const preloadImg = new Image();
            
            preloadImg.onload = () => {
                // Set the main photo
                currentPhotoEl.src = photo.path;
                currentPhotoEl.alt = photo.name;
                photoNameEl.textContent = photo.name;
                
                // Create or update the blurred background immediately
                let photoBackground = document.querySelector('.photo-background');
                if (!photoBackground) {
                    photoBackground = document.createElement('div');
                    photoBackground.className = 'photo-background';
                    document.getElementById('photo-container').prepend(photoBackground);
                }
                photoBackground.style.backgroundImage = `url(${photo.path})`;

                const date = new Date(photo.date);
                photoDateEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                // Show file details
                const sizeMB = (photo.size / (1024 * 1024)).toFixed(2);
                const displayCount = photo.displayCount !== undefined ? photo.displayCount : 0;
                photoDetailsEl.textContent = `Size: ${sizeMB} MB | Views: ${displayCount}`;
                
                // Update display count in the database if we have a photo ID
                if (photo.id) {
                    updatePhotoDisplayCount(photo.id);
                }
                
                // Fade in new image
                currentPhotoEl.style.opacity = 1;
            };
            preloadImg.src = photo.path;
        }, 500);
    };
    
    // Start automatic slideshow
    const startSlideshow = () => {
        // Clear any existing interval
        if (slideshowInterval) clearInterval(slideshowInterval);
        
        // Set new interval
        slideshowInterval = setInterval(() => {
            showPhoto(currentPhotoIndex + 1);
        }, SLIDESHOW_INTERVAL);
        
        console.log(`Slideshow started with interval of ${SLIDESHOW_INTERVAL / 1000} seconds`);
    };
    
    // Show previous photo
    const prevPhoto = () => {
        showPhoto(currentPhotoIndex - 1);
        // Reset slideshow timer
        startSlideshow();
    };
    
    // Show next photo
    const nextPhoto = () => {
        showPhoto(currentPhotoIndex + 1);
        // Reset slideshow timer
        startSlideshow();
    };    // Show message when no photos are available
    const showNoPhotosMessage = () => {
        currentPhotoEl.src = 'logo.png';
        photoNameEl.textContent = 'No Photos Available';
        photoDateEl.textContent = 'Please use the admin panel to scan your NAS and fetch photos';
        photoDetailsEl.textContent = '';
        
        // Hide navigation buttons when no photos are available
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
    };
    
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
            const count = parseInt(fetchCountInput.value) || 10;
            statusMessageEl.textContent = `Fetching ${count} photos...`;
            
            const response = await fetch('/api/admin/fetch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ count })
            });
            
            const data = await response.json();
              if (data.success) {
                showSuccessMessage(`Photos fetched: ${data.result.fetched} of ${data.result.total}`);
                // Reload photos after fetch
                await loadPhotos();
                if (photos.length > 0 && (currentPhotoEl.src === '' || currentPhotoEl.src.endsWith('logo.png'))) {
                    showPhoto(0);
                    startSlideshow();
                }
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
                photoTableBody.innerHTML = '<tr><td colspan="8">No photos found in database</td></tr>';
                showErrorMessage('No photos found in database');
            }
        } catch (error) {
            console.error('Error loading database photos:', error);
            showErrorMessage('Failed to load database photos');
            photoTableBody.innerHTML = '<tr><td colspan="8">Error loading database photos</td></tr>';
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
                <td>${photo.display_count || '0'}</td>
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
    
    // Update the display count for a photo in the database
    const updatePhotoDisplayCount = async (photoId) => {
        try {
            const response = await fetch('/api/photos/viewed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ photoId })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Update local display count
                const photo = photos[currentPhotoIndex];
                if (photo && photo.id === photoId) {
                    photo.displayCount = (photo.displayCount || 0) + 1;
                    
                    // Update the display in UI
                    const sizeMB = (photo.size / (1024 * 1024)).toFixed(2);
                    photoDetailsEl.textContent = `Size: ${sizeMB} MB | Views: ${photo.displayCount}`;
                }
            }
        } catch (error) {
            console.error('Error updating photo display count:', error);
        }
    };
    
    // Event listeners
    prevButton.addEventListener('click', prevPhoto);
    nextButton.addEventListener('click', nextPhoto);
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
    
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') prevPhoto();
        if (event.key === 'ArrowRight') nextPhoto();
        if (event.key === 'Escape' && photoDatabaseModal.style.display === 'block') closeDatabaseModal();
    });
    
    // Refresh the database table when it becomes visible to ensure display counts are up-to-date
    document.getElementById('show-database-button').addEventListener('click', () => {
        if (photoDatabaseModal.style.display === 'none' || photoDatabaseModal.style.display === '') {
            openDatabaseModal();
        }
    });
    
    // Initialize application
    init();
});
