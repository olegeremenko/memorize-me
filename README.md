# Memorize Me - Photo Slideshow App

A web application that helps users recall memories by displaying photos from a home NAS in a slideshow format.

## Features

- Connects to a WD MyCloud EX2 Ultra NAS to fetch photos
- Displays photos in full-screen slideshow format
- Shows photo details (name, date, size)
- Automatically changes photos on a configurable interval
- Runs efficiently on a Raspberry Pi 3 in a Docker container

## Project Structure

```
memorize-me/
├── backend/
│   ├── data/          # Storage for local DB and downloaded photos
│   └── src/           # Backend Node.js code
├── frontend/
│   └── public/        # Frontend static files
├── .env               # Environment configuration
├── package.json       # Project dependencies
├── Dockerfile         # Docker configuration
└── docker-compose.yml # Docker Compose configuration
```

## Prerequisites

- Raspberry Pi 3 with Docker and Docker Compose installed
- WD MyCloud EX2 Ultra NAS accessible on your network
- Node.js (if running outside Docker)

## Configuration

Edit the `.env` file to configure your application settings:

```
# Server configuration
PORT=3000
HOST=0.0.0.0

# NAS Configuration
NAS_HOST=192.168.1.100  # Change to your NAS IP address
NAS_USERNAME=admin      # Change to your NAS username
NAS_PASSWORD=password   # Change to your NAS password
NAS_PHOTOS_PATH=/shares/photos  # Change to your photos path on NAS

# Local paths
LOCAL_DB_PATH=./backend/data/photos.db
LOCAL_PHOTOS_PATH=./backend/data/photos
PHOTOS_PER_DAY=10  # Number of photos to fetch each day

# Slideshow settings
SLIDESHOW_INTERVAL=300000  # 5 minutes in milliseconds
```

## Running with Docker (recommended for Raspberry Pi)

1. Clone the repository onto your Raspberry Pi
2. Edit the `.env` file with your NAS configuration
3. Build and start the Docker container:

```bash
docker-compose up -d
```

4. Access the application at `http://raspberry-pi-ip:3000`

## Running without Docker (development)

1. Install Node.js (v16+)
2. Install dependencies:

```bash
npm install
```

3. Initialize the database:

```bash
npm run init-db
```

4. Start the application:

```bash
npm start
```

5. Access the application at `http://localhost:3000`

## Using the Application

1. **Initial Setup**:
   - When you first access the application, click "Scan NAS" in the admin panel to scan for available photos
   - Then click "Fetch Photos" to download photos from your NAS

2. **Viewing Photos**:
   - Photos will automatically change every 5 minutes (configurable)
   - Use the Previous/Next buttons or left/right arrow keys to navigate manually
   - Hover over a photo to see its details

3. **Admin Panel**:
   - Hover in the top-right corner to access the admin panel
   - "Scan NAS" - Rescans your NAS for new photos
   - "Fetch Photos" - Downloads selected number of random photos

## License

This project is licensed under the ISC License.

---

*Note: This is a personal project for running on a home network. The NAS client implementation is a mock - you'll need to replace it with actual implementation for your specific NAS model.*
