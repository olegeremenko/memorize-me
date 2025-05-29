#!/bin/sh

# Initialize database if needed
node backend/src/init-db.js

# Start the application
exec node backend/src/index.js
