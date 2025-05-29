FROM node:20-bullseye

# Install required packages for NAS mounting
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    cifs-utils keyutils dbus libgssapi-krb5-2 \
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
ENV LOCAL_DB_PATH=/app/backend/data/photos.db
ENV LOCAL_PHOTOS_PATH=/app/backend/data/photos

# Expose port
EXPOSE 3000

# Copy and set the entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Use entrypoint script for startup
CMD ["/app/entrypoint.sh"]
