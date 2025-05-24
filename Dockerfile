FROM node:22-slim

# Install required packages for NAS mounting
RUN apt-get update && apt-get install -y \
    cifs-utils \
    keyutils \
    dbus \
    libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create necessary directories
RUN mkdir -p backend/data/photos
# Create directory for mounting NAS
RUN mkdir -p /app/mnt

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LOCAL_DB_PATH=/app/backend/data/photos.db
ENV LOCAL_PHOTOS_PATH=/app/backend/data/photos
ENV MOUNTED_PHOTOS_PATH=/app/mnt

# Expose port
EXPOSE 3000

# Initialize database on start
RUN node backend/src/init-db.js

# Start the app
CMD ["node", "backend/src/index.js"]
