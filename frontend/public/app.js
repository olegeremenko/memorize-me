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
    
    // Application state
    let photos = [];
    let currentPhotoIndex = 0;
    let slideshowInterval = null;
    const SLIDESHOW_INTERVAL = parseInt(localStorage.getItem('slideshow-interval')) || 300000; // 5 minutes default
    
    // Initialize the application
    const init = async () => {
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
        }
    };
    
    // Load photos from the server
    const loadPhotos = async () => {
        try {
            const response = await fetch('/api/photos');
            const data = await response.json();
            
            if (data && data.photos && data.photos.length > 0) {
                photos = data.photos;
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
    };
    
    // Display a photo by index
    const showPhoto = (index) => {
        if (photos.length === 0) return;
        
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
                currentPhotoEl.src = photo.path;
                currentPhotoEl.alt = photo.name;
                photoNameEl.textContent = photo.name;
                
                const date = new Date(photo.date);
                photoDateEl.textContent = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
                
                // Show file details
                const sizeMB = (photo.size / (1024 * 1024)).toFixed(2);
                photoDetailsEl.textContent = `Size: ${sizeMB} MB`;
                
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
    };
    
    // Show message when no photos are available
    const showNoPhotosMessage = () => {
        currentPhotoEl.src = '';
        photoNameEl.textContent = 'No Photos Available';
        photoDateEl.textContent = 'Please use the admin panel to scan your NAS and fetch photos';
        photoDetailsEl.textContent = '';
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
                if (photos.length > 0 && currentPhotoEl.src === '') {
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
    
    // Event listeners
    prevButton.addEventListener('click', prevPhoto);
    nextButton.addEventListener('click', nextPhoto);
    scanButton.addEventListener('click', scanNAS);
    fetchButton.addEventListener('click', fetchPhotos);
    
    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowLeft') prevPhoto();
        if (event.key === 'ArrowRight') nextPhoto();
    });
    
    // Initialize application
    init();
});
