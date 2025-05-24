# Memorize Me - Photo Slideshow App

A web application that helps users recall memories by displaying photos from a home NAS in a slideshow format.

## Features

- Connects to a WD MyCloud EX2 Ultra NAS to fetch photos
- Displays photos in full-screen slideshow format
- Shows photo details (name, date, size)
- Automatically changes photos on a configurable interval
- Runs efficiently on a Raspberry Pi 3 in a Docker container
- Supports pattern-based configuration for specific photo directories

## Project Structure

```
memorize-me/
├── backend/
│   ├── data/          # Storage for local DB and downloaded photos
│   │   ├── photos/    # Directory for downloaded photos
│   │   └── mnt/       # Mount point for NAS resource
│   └── src/           # Backend Node.js code
├── frontend/
│   └── public/        # Frontend static files
├── .env               # Environment configuration
├── config.json        # Photo subfolder configuration
├── package.json       # Project dependencies
├── Dockerfile         # Docker configuration
└── compose.yml        # Docker Compose configuration
```

## Prerequisites

- Raspberry Pi 3 with Docker and Docker Compose installed
- WD MyCloud EX2 Ultra NAS accessible on your network
- Node.js (if running outside Docker)

## Configuration

### Environment Configuration

Edit the `.env` file to configure your application settings:

```
# Server configuration
PORT=3000
HOST=0.0.0.0

# NAS Configuration
NAS_HOST=192.168.1.100  # Change to your NAS IP address
NAS_USERNAME=admin      # Change to your NAS username
NAS_PASSWORD=password   # Change to your NAS password

# Mounted Folder Configuration
MOUNTED_PHOTOS_PATH=/app/mnt  # Path to mounted NAS folder inside the container

# Local paths
LOCAL_DB_PATH=./backend/data/photos.db
LOCAL_PHOTOS_PATH=./backend/data/photos
```

### Photo Directory Configuration

The application supports configuration of specific subdirectories to scan for photos. Edit the `config.json` file:

```json
{
  "photoScanConfig": {
    "subfolders": [
      {
        "path": "2025",
        "recursive": true
      },
      {
        "path": "family",
        "recursive": false
      },
      "vacations"
    ],
    "exclusionPatterns": [
      "*private*",
      "*confidential*"
    ],
    "imageFileExtensions": [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif"
    ]
  }
}
```

This configuration allows you to:
- Specify exact directories to scan with recursive control:
  - Object format: `{"path": "folder_name", "recursive": true/false}` - Explicitly control recursive scanning
  - String format: `"folder_name"` - Short syntax, automatically uses recursive scanning
- Control recursion with the `recursive` flag:
  - `true` (default): Scan the specified folder and all its subfolders
  - `false`: Scan only the specified folder, ignoring subfolders
- Use exclusion patterns to skip certain files or directories that match the specified patterns

#### Exclusion Pattern Syntax

The application uses simple wildcard patterns for exclusions:
- `*` - matches any number of characters
- `?` - matches a single character

Examples:
- `*private*` - Excludes any file or folder with "private" in the name
- `*confidential*` - Excludes any file or folder with "confidential" in the name

#### Image File Extensions

You can specify which file extensions should be treated as images:

```json
"imageFileExtensions": [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif"
]
```

Only files with these extensions will be included in the photo collection. If not specified, the default extensions (.jpg, .jpeg, .png, .gif) will be used.

### Testing Your Configuration

Run the configuration test:

```bash
npm run test-config
```

This will show:
1. Your current mounted photos path
2. The subdirectory patterns being used
3. Results of scanning with your configuration

## Running with Docker (recommended for Raspberry Pi)

1. Clone the repository onto your Raspberry Pi
2. Edit the `.env` file with your NAS configuration
3. Create the necessary directory structure:

```bash
mkdir -p backend/data/mnt
mkdir -p backend/data/photos
```

4. Build and start the Docker container:

```bash
docker compose up -d
```

5. Access the application at `http://raspberry-pi-ip:3000`

The application will automatically create and use a directory at `/app/mnt` inside the container for mounting the NAS resource. This directory is mapped to `./backend/data/mnt` on your host system for persistence.

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
