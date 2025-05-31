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
                    originalFileName: photo.originalFileName || photo.name,
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
                const displayCount = photo.displayCount !== undefined ? photo.displayCount : 0;
                photoDetailsEl.textContent = `Views: ${displayCount}`;
                
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
        photoDateEl.textContent = ''; // No longer showing date timestamp
        photoDetailsEl.textContent = 'Please use the admin panel to scan your NAS and fetch photos';
        
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
                    
                    photoDetailsEl.textContent = `Views: ${photo.displayCount}`;
                }
            }
        } catch (error) {
            console.error('Error updating photo display count:', error);
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
        } else {
            // Exit fullscreen
            if (document.exitFullscreen) {
                document.exitFullscreen();
                fullscreenButton.textContent = "Fullscreen";
            } else if (document.webkitExitFullscreen) { // Safari
                document.webkitExitFullscreen();
                fullscreenButton.textContent = "Fullscreen";
            } else if (document.msExitFullscreen) { // IE11
                document.msExitFullscreen();
                fullscreenButton.textContent = "Fullscreen";
            }
        }
    };
    
    // Event listeners
    prevButton.addEventListener('click', prevPhoto);
    nextButton.addEventListener('click', nextPhoto);
    fullscreenButton.addEventListener('click', toggleFullScreen);
    
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') prevPhoto();
        if (event.key === 'ArrowRight') nextPhoto();
        if (event.key === 'f' || event.key === 'F') toggleFullScreen();
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
