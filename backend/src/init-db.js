const { initDatabase } = require('./db');

// Initialize the database
(async () => {
  try {
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database initialization completed');
    process.exit(0);
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
})();
