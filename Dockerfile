FROM node:22-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install

# Bundle app source
COPY . .

# Create necessary directories
RUN mkdir -p backend/data/photos

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV LOCAL_DB_PATH=/app/backend/data/photos.db
ENV LOCAL_PHOTOS_PATH=/app/backend/data/photos

# Expose port
EXPOSE 3000

# Initialize database on start
RUN node backend/src/init-db.js

# Start the app
CMD ["node", "backend/src/index.js"]
