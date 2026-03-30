require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

const seed = async () => {
  await connectDB();

  const email = 'superadmin@bmsengafe.com';
  const existing = await User.findOne({ email });

  if (existing) {
    console.log(`⚠  Superadmin already exists: ${email}`);
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name: 'Super Admin',
    email,
    password: 'SuperAdmin@2024!',
    verified: true,
    isSuperAdmin: true,
    accountStatus: 'active',
    roles: ['ceo'],
    enabledFeatures: {
      gallery: true, socialAccounts: true, posts: true,
      scheduler: true, analytics: true, notifications: true, settings: true,
    },
  });

  console.log(`✅  Superadmin created: ${email} / SuperAdmin@2024!`);
  await mongoose.disconnect();
};

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
