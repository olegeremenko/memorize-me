#!/bin/bash

echo "Deploying latest changes to memorize-me..."

# Pull latest changes from git
echo "Pulling latest changes from git..."
git pull

# Restart the container to apply changes
echo "Restarting container..."
docker-compose restart memorize-me

echo "Deployment completed! Your changes should now be live."
echo "If you made changes to package.json or Dockerfile, you'll need to rebuild with: docker-compose up --build -d"