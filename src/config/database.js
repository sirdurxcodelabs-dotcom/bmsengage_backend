const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('\n⚠️  MongoDB Connection Failed!');
    console.log('Please check:');
    console.log('1. Your IP is whitelisted in MongoDB Atlas (add 0.0.0.0/0 for all IPs)');
    console.log('2. Your connection string is correct');
    console.log('3. Your network allows MongoDB connections\n');
    process.exit(1);
  }
};

module.exports = connectDB;
