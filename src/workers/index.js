require('dotenv').config();
const connectDB = require('../config/database');
const { startScheduler } = require('./postPublisher');

const startWorker = async () => {
  try {
    // Connect to database
    await connectDB();

    // Start the scheduler
    startScheduler();

    console.log('Worker started successfully!');
  } catch (error) {
    console.error('Failed to start worker:', error);
    process.exit(1);
  }
};

startWorker();

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down worker...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down worker...');
  process.exit(0);
});
