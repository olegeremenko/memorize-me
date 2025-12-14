// Slideshow Photos page script
document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const slideshowLoader = document.getElementById('slideshow-loader');
    const slideshowContent = document.getElementById('slideshow-content');
    const statusMessage = document.getElementById('status-message');
    const photoCountDisplay = document.getElementById('photo-count-display');
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const sameDayFilter = document.getElementById('same-day-filter');
    const tableBody = document.getElementById('photos-table-body');
    
    // Application state
    let allPhotos = [];
    let filteredPhotos = [];
    
    // Show status message
    const showMessage = (message, type = 'info') => {
        statusMessage.textContent = message;
        statusMessage.className = `status-message ${type}`;
        
        setTimeout(() => {
            statusMessage.textContent = '';
            statusMessage.className = 'status-message';
        }, 5000);
    };
    
    // Load photos from the slideshow endpoint
    const loadSlideshowPhotos = async () => {
        try {
            slideshowLoader.style.display = 'block';
            slideshowContent.style.display = 'none';
            
            const response = await fetch('/api/photos');
            const data = await response.json();
            
            if (data && data.photos && data.photos.length > 0) {
                allPhotos = data.photos;
                applyFilters();
                showMessage(`Loaded ${allPhotos.length} slideshow photos`, 'success');
            } else {
                allPhotos = [];
                filteredPhotos = [];
                displayEmptyState();
                showMessage('No photos found in slideshow', 'warning');
            }
            
            slideshowLoader.style.display = 'none';
            slideshowContent.style.display = 'block';
            
        } catch (error) {
            console.error('Error loading slideshow photos:', error);
            showMessage('Failed to load slideshow photos', 'error');
            displayEmptyState();
            
            slideshowLoader.style.display = 'none';
            slideshowContent.style.display = 'block';
        }
    };
    
    // Apply search and filters
    const applyFilters = () => {
        let filtered = [...allPhotos];
        
        // Apply search filter
        const searchTerm = searchInput.value.toLowerCase().trim();
        if (searchTerm) {
            filtered = filtered.filter(photo => 
                (photo.name && photo.name.toLowerCase().includes(searchTerm)) ||
                (photo.originalFileName && photo.originalFileName.toLowerCase().includes(searchTerm)) ||
                (photo.nasPath && photo.nasPath.toLowerCase().includes(searchTerm))
            );
        }
        
        // Apply same-day filter
        if (sameDayFilter.checked) {
            filtered = filtered.filter(photo => photo.same_day === true);
        }
        
        filteredPhotos = filtered;
        updatePhotoCount();
        displayPhotos(filteredPhotos);
    };
    
    // Update photo count display
    const updatePhotoCount = () => {
        const totalPhotos = allPhotos.length;
        const displayedPhotos = filteredPhotos.length;
        const sameDayCount = allPhotos.filter(photo => photo.same_day).length;
        
        let countText = `${displayedPhotos} of ${totalPhotos} photos`;
        if (sameDayCount > 0) {
            countText += ` (${sameDayCount} same-day)`;
        }
        
        photoCountDisplay.textContent = countText;
    };
    
    // Display photos in the table
    const displayPhotos = (photos) => {
        if (photos.length === 0) {
            displayEmptyState();
            return;
        }
        
        tableBody.innerHTML = '';
        
        photos.forEach((photo, index) => {
            const row = document.createElement('tr');
            
            // Format date and time
            let dateDisplay = 'N/A';
            if (photo.relativeTime) {
                dateDisplay = photo.relativeTime;
            } else if (photo.date) {
                const photoDate = new Date(photo.date);
                dateDisplay = photoDate.toLocaleDateString() + ' ' + photoDate.toLocaleTimeString();
            }
            
            // Same day indicator
            const sameDayIcon = photo.same_day ? '📅' : '—';
            const sameDayClass = photo.same_day ? 'same-day-yes' : 'same-day-no';
            
            row.innerHTML = `
                <td class="thumbnail-cell">
                    <img src="${photo.path}" alt="${photo.originalFileName || photo.name}" 
                         class="photo-thumbnail" 
                         onclick="showPhotoModal('${photo.path}', '${(photo.originalFileName || photo.name).replace(/'/g, "\\'")}', '${dateDisplay.replace(/'/g, "\\'")}')">
                </td>
                <td class="file-info-cell">
                    <div class="file-name">${photo.originalFileName || photo.name}</div>
                    <div class="file-path">${photo.nasPath || 'Local file'}</div>
                </td>
                <td class="date-info">${dateDisplay}</td>
                <td class="same-day-indicator ${sameDayClass}">${sameDayIcon}</td>
                <td class="actions-cell">
                    <button class="action-btn jump-to-btn" onclick="jumpToPhoto(${index})" title="Jump to this photo in slideshow">
                        🎯
                    </button>
                    <button class="action-btn view-btn" onclick="window.open('${photo.path}', '_blank')" title="View full size">
                        👁️
                    </button>
                </td>
            `;
            
            tableBody.appendChild(row);
        });
    };
    
    // Display empty state
    const displayEmptyState = () => {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5">
                    <div class="empty-state">
                        <div class="empty-state-icon">📷</div>
                        <h3>No Photos Found</h3>
                        <p>No photos are currently available in the slideshow.</p>
                        <p>Go to the <a href="/admin">Admin Panel</a> to fetch photos from your NAS.</p>
                    </div>
                </td>
            </tr>
        `;
    };
    
    // Jump to specific photo in slideshow
    const jumpToPhoto = (photoIndex) => {
        const photo = filteredPhotos[photoIndex];
        const originalIndex = allPhotos.findIndex(p => p.path === photo.path);
        
        if (originalIndex !== -1) {
            // Store the target photo info for the slideshow to pick up
            const targetPhoto = {
                filename: photo.name,
                nas_filename: photo.originalFileName,
                downloaded_id: photo.id,
                index: originalIndex,
                timestamp: Date.now()
            };
            localStorage.setItem('memorize_me_target_photo', JSON.stringify(targetPhoto));
            
            // Navigate to slideshow
            window.location.href = '/';
        } else {
            showMessage('Photo not found in slideshow', 'error');
        }
    };
    
    // Show photo in modal
    const showPhotoModal = (photoPath, fileName, dateInfo) => {
        const modal = document.createElement('div');
        modal.className = 'photo-modal';
        modal.innerHTML = `
            <div class="photo-modal-content">
                <span class="photo-modal-close" onclick="closePhotoModal()">&times;</span>
                <img src="${photoPath}" alt="${fileName}">
                <div class="photo-modal-info">
                    <div class="photo-modal-filename">${fileName}</div>
                    <div class="photo-modal-details">${dateInfo}</div>
                </div>
            </div>
        `;
        
        // Close modal when clicking outside the image
        modal.onclick = (e) => {
            if (e.target === modal) {
                closePhotoModal();
            }
        };
        
        document.body.appendChild(modal);
        
        // Add escape key listener
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closePhotoModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    };
    
    // Close photo modal
    const closePhotoModal = () => {
        const modal = document.querySelector('.photo-modal');
        if (modal) {
            modal.remove();
        }
    };
    
    // Event listeners
    searchInput.addEventListener('input', applyFilters);
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        applyFilters();
    });
    sameDayFilter.addEventListener('change', applyFilters);
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'f':
                case 'F':
                    e.preventDefault();
                    searchInput.focus();
                    break;
                case 'r':
                case 'R':
                    e.preventDefault();
                    loadSlideshowPhotos();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            // Clear search if focused
            if (document.activeElement === searchInput) {
                searchInput.value = '';
                searchInput.blur();
                applyFilters();
            }
        }
    });
    
    // Make functions globally accessible
    window.jumpToPhoto = jumpToPhoto;
    window.showPhotoModal = showPhotoModal;
    window.closePhotoModal = closePhotoModal;
    
    // Initialize the page
    loadSlideshowPhotos();
});