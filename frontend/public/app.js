// Main application script
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const currentPhotoEl = document.getElementById('current-photo');
    const photoNameEl = document.getElementById('photo-name');
    const photoDateEl = document.getElementById('photo-date');
    const photoDetailsEl = document.getElementById('photo-details');
    const prevButton = document.getElementById('prev-button');
    const nextButton = document.getElementById('next-button');
    const fullscreenButton = document.getElementById('fullscreen-button');
    const statusMessageEl = document.getElementById('status-message');
    
    // Add error handler for the image element
    currentPhotoEl.onerror = () => {
        // If image fails to load, show the logo
        if (currentPhotoEl.src !== 'logo.png') {
            console.log('Error loading photo, showing logo instead');
            currentPhotoEl.src = 'logo.png';
            currentPhotoEl.alt = 'Memorize Me Logo';
            
            // Start countdown and reload photos
            startReloadCountdown(30);
        }
    };
    
    // Application state
    let photos = [];
    let currentPhotoIndex = 0;
    let slideshowInterval = null;
    let countdownInterval = null;
    let SLIDESHOW_INTERVAL = parseInt(localStorage.getItem('slideshow-interval')) || 60000; // 1 minute default
    
    // Start countdown to reload photos
    const startReloadCountdown = (seconds) => {
        // Clear any existing countdown
        if (countdownInterval) clearInterval(countdownInterval);
        
        // Stop slideshow temporarily
        if (slideshowInterval) clearInterval(slideshowInterval);
        
        let remainingSeconds = seconds;
        
        photoNameEl.textContent = 'Photo unavailable';
        photoDateEl.textContent = `Reloading photos in ${remainingSeconds} seconds...`;
        photoDetailsEl.textContent = 'Please wait';
        
        // Hide navigation buttons during countdown
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
        
        countdownInterval = setInterval(() => {
            remainingSeconds--;
            
            if (remainingSeconds <= 0) {
                // Clear interval when countdown finishes
                clearInterval(countdownInterval);
                countdownInterval = null;
                
                // Reload photos
                reloadPhotos();
            } else {
                photoDateEl.textContent = `Reloading photos in ${remainingSeconds} seconds...`;
            }
        }, 1000);
    };
    
    // Reload photos from server
    const reloadPhotos = async () => {
        photoDateEl.textContent = 'Reloading photos...';
        
        try {
            await loadPhotos();
            
            if (photos.length > 0) {
                showPhoto(0);
                startSlideshow();
            } else {
                showNoPhotosMessage();
            }
        } catch (error) {
            console.error('Failed to reload photos:', error);
            showErrorMessage('Failed to reload photos. Please try again later.');
            
            // Resume slideshow even if reload failed
            if (photos.length > 0) {
                startSlideshow();
            }
        }
    };
    
    // Load system settings from the API
    const loadSystemSettings = async () => {
        try {
            const response = await fetch('/api/settings');
            const data = await response.json();
            
            if (data && data.settings && data.settings.slideshowInterval) {
                // Convert seconds to milliseconds
                const intervalMs = data.settings.slideshowInterval * 1000;
                SLIDESHOW_INTERVAL = intervalMs;
                localStorage.setItem('slideshow-interval', intervalMs);
                console.log(`Loaded slideshow interval from settings: ${data.settings.slideshowInterval} seconds`);
            }
        } catch (error) {
            console.error('Error loading system settings:', error);
            // Use default or localStorage value on error
        }
    };
    
    // Initialize the application
    const init = async () => {
        // Hide navigation buttons initially until we know we have photos
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
        
        // Load system settings
        await loadSystemSettings();
        
        // Check if current photo is empty and show logo initially
        if (!currentPhotoEl.src || currentPhotoEl.src.endsWith('/')) {
            currentPhotoEl.src = 'logo.png';
            currentPhotoEl.alt = 'Memorize Me Logo';
        }
        
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
                    originalFileName: photo.originalFileName || photo.name,
                    path: photo.path,
                    date: photo.date,
                    relativeTime: photo.relativeTime,
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
            
            preloadImg.onerror = () => {
                console.error('Failed to load photo:', photo.path);
                // Show logo instead of the failed photo
                currentPhotoEl.src = 'logo.png';
                currentPhotoEl.alt = 'Memorize Me Logo';
                photoNameEl.textContent = 'Photo Load Error';
                currentPhotoEl.style.opacity = 1; // Make sure the logo is visible
                
                // Start countdown and reload photos if the photo is not found
                startReloadCountdown(10); // 10 seconds countdown
            };
            
            preloadImg.onload = () => {
                // Set the main photo
                currentPhotoEl.src = photo.path;
                currentPhotoEl.alt = photo.originalFileName || photo.name;
                photoNameEl.textContent = photo.originalFileName || photo.name;
                
                // Create or update the blurred background immediately
                let photoBackground = document.querySelector('.photo-background');
                if (!photoBackground) {
                    photoBackground = document.createElement('div');
                    photoBackground.className = 'photo-background';
                    document.getElementById('photo-container').prepend(photoBackground);
                }
                photoBackground.style.backgroundImage = `url(${photo.path})`;
                
                // Show file details
                const downloadsCount = photo.downloadsCount !== undefined ? photo.downloadsCount : 0;
                photoDetailsEl.textContent = `Views: ${downloadsCount}`;
                
                // Display relative time if available
                if (photo.relativeTime) {
                    photoDateEl.textContent = photo.relativeTime;
                } else if (photo.date) {
                    // Format the date if relativeTime is not available
                    const photoDate = new Date(photo.date);
                    photoDateEl.textContent = photoDate.toLocaleDateString();
                } else {
                    photoDateEl.textContent = '';
                }
                
                // Update viewed timestamp in the database if we have a photo ID
                if (photo.id) {
                    updatePhotoViewed(photo.id);
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
        photoDateEl.textContent = ''; // Clear date element
        photoDetailsEl.textContent = 'Please use the admin panel to scan your NAS and fetch photos';
        
        // Hide navigation buttons when no photos are available
        prevButton.style.display = 'none';
        nextButton.style.display = 'none';
        
        // Clear any existing intervals
        if (slideshowInterval) clearInterval(slideshowInterval);
        if (countdownInterval) clearInterval(countdownInterval);
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
    
    // Update viewed timestamp for a photo in the database
    const updatePhotoViewed = async (photoId) => {
        try {
            const response = await fetch('/api/photos/viewed', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ photoId })
            });
            
            const data = await response.json();
            
            if (!data.success) {
                console.warn('Failed to update photo viewed timestamp');
            }
        } catch (error) {
            console.error('Error updating photo viewed timestamp:', error);
        }
    };
    
    // Toggle fullscreen mode
    const toggleFullScreen = () => {
        if (!document.fullscreenElement) {
            // Enter fullscreen
            if (document.documentElement.requestFullscreen) {
                document.documentElement.requestFullscreen();
                fullscreenButton.textContent = "Exit Fullscreen";
            } else if (document.documentElement.webkitRequestFullscreen) { // Safari
                document.documentElement.webkitRequestFullscreen();
                fullscreenButton.textContent = "Exit Fullscreen";
            } else if (document.documentElement.msRequestFullscreen) { // IE11
                document.documentElement.msRequestFullscreen();
                fullscreenButton.textContent = "Exit Fullscreen";
            }
        }
    }

    // Delete modal elements
    const deleteModal = document.getElementById('delete-modal');
    const closeButton = deleteModal.querySelector('.close');
    const cancelDeleteButton = document.getElementById('cancel-delete');
    const confirmDeleteButton = document.getElementById('confirm-delete');
    
    // Show delete confirmation modal
    const showDeleteModal = () => {
        const photo = photos[currentPhotoIndex];
        if (photo && photo.id) {
            deleteModal.style.display = 'block';
        } else {
            showErrorMessage('No photo selected to delete');
        }
    };
    
    // Close delete modal
    const closeDeleteModal = () => {
        deleteModal.style.display = 'none';
    };
    
    // Delete the current photo
    const deleteCurrentPhoto = async () => {
        const photo = photos[currentPhotoIndex];
        if (photo && photo.id) {
            try {
                const response = await fetch(`/api/photos/delete/${photo.id}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showSuccessMessage('Photo deleted successfully');
                    
                    // Remove the photo from the array
                    photos = photos.filter(p => p.id !== photo.id);
                    
                    // Show the next photo if available, or the previous one if this was the last
                    if (photos.length > 0) {
                        // If we're at the end of the array, go to the previous photo
                        if (currentPhotoIndex >= photos.length) {
                            showPhoto(currentPhotoIndex - 1);
                        } else {
                            showPhoto(currentPhotoIndex);
                        }
                        // Restart the slideshow with the new photo list
                        startSlideshow();
                    } else {
                        showNoPhotosMessage();
                        // Clear slideshow interval as there are no photos
                        if (slideshowInterval) clearInterval(slideshowInterval);
                    }
                } else {
                    showErrorMessage('Failed to delete photo: ' + (data.error || 'Unknown error'));
                }
            } catch (error) {
                console.error('Error deleting photo:', error);
                showErrorMessage('Failed to communicate with server');
            } finally {
                closeDeleteModal();
            }
        } else {
            showErrorMessage('No photo selected to delete');
            closeDeleteModal();
        }
    };
    
    // Event listeners
    prevButton.addEventListener('click', prevPhoto);
    nextButton.addEventListener('click', nextPhoto);
    fullscreenButton.addEventListener('click', toggleFullScreen);
    document.getElementById('delete-button').addEventListener('click', showDeleteModal);
    
    // Delete modal event listeners
    closeButton.addEventListener('click', closeDeleteModal);
    cancelDeleteButton.addEventListener('click', closeDeleteModal);
    confirmDeleteButton.addEventListener('click', deleteCurrentPhoto);
    
    // Close modal when clicking outside of it
    window.addEventListener('click', (event) => {
        if (event.target === deleteModal) {
            closeDeleteModal();
        }
    });
    document.getElementById('delete-button').addEventListener('click', showDeleteModal);
    closeButton.addEventListener('click', closeDeleteModal);
    cancelDeleteButton.addEventListener('click', closeDeleteModal);
    confirmDeleteButton.addEventListener('click', deleteCurrentPhoto);
    
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') prevPhoto();
        if (event.key === 'ArrowRight') nextPhoto();
        if (event.key === 'f' || event.key === 'F') toggleFullScreen();
        if (event.key === 'd' || event.key === 'D' || event.key === 'Delete' || event.key === 'Backspace') showDeleteModal();
        
        // Close delete modal with Escape key
        if (event.key === 'Escape' && deleteModal.style.display === 'block') {
            closeDeleteModal();
        }
    });
    
    // Update fullscreen button text when fullscreen state changes
    document.addEventListener('fullscreenchange', () => {
        if (document.fullscreenElement) {
            fullscreenButton.textContent = "Exit Fullscreen";
        } else {
            fullscreenButton.textContent = "Fullscreen";
        }
    });
    
    // For Safari
    document.addEventListener('webkitfullscreenchange', () => {
        if (document.webkitFullscreenElement) {
            fullscreenButton.textContent = "Exit Fullscreen";
        } else {
            fullscreenButton.textContent = "Fullscreen";
        }
    });
    
    // Initialize application
    init();
});
