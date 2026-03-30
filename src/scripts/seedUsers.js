require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

const users = [
  // Executive
  { name: 'Amara Osei',      email: 'amara.osei@bmsengafe.com',      password: 'Password@123', verified: true, roles: ['ceo'],                  country: 'Ghana',   city: 'Accra',         timezone: 'Africa/Accra',  notificationPrefs: { accountSecurity: true,  galleryAssets: true,  postSchedule: true,  systemUpdates: true  } },
  { name: 'Kwame Mensah',    email: 'kwame.mensah@bmsengafe.com',     password: 'Password@123', verified: true, roles: ['creative_director'],    country: 'Ghana',   city: 'Kumasi',        timezone: 'Africa/Accra',  notificationPrefs: { accountSecurity: true,  galleryAssets: true,  postSchedule: true,  systemUpdates: false } },
  { name: 'Zainab Musa',     email: 'zainab.musa@bmsengafe.com',      password: 'Password@123', verified: true, roles: ['head_of_production'],   country: 'Nigeria', city: 'Abuja',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: true,  galleryAssets: true,  postSchedule: true,  systemUpdates: true  } },
  // Creative
  { name: 'Fatima Al-Hassan',email: 'fatima.alhassan@bmsengafe.com',  password: 'Password@123', verified: true, roles: ['graphic_designer'],     country: 'Nigeria', city: 'Lagos',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: true,  postSchedule: false, systemUpdates: false } },
  { name: 'Emeka Nwosu',     email: 'emeka.nwosu@bmsengafe.com',      password: 'Password@123', verified: true, roles: ['photographer'],         country: 'Nigeria', city: 'Port Harcourt', timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: true,  postSchedule: false, systemUpdates: false } },
  { name: 'Aisha Diallo',    email: 'aisha.diallo@bmsengafe.com',     password: 'Password@123', verified: true, roles: ['videographer'],         country: 'Senegal', city: 'Dakar',         timezone: 'Africa/Dakar',  notificationPrefs: { accountSecurity: false, galleryAssets: true,  postSchedule: false, systemUpdates: false } },
  { name: 'Chidi Eze',       email: 'chidi.eze@bmsengafe.com',        password: 'Password@123', verified: true, roles: ['editor'],               country: 'Nigeria', city: 'Enugu',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: true,  postSchedule: false, systemUpdates: false } },
  // Production
  { name: 'Nkechi Okafor',   email: 'nkechi.okafor@bmsengafe.com',    password: 'Password@123', verified: true, roles: ['producer'],             country: 'Nigeria', city: 'Lagos',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: true,  postSchedule: true,  systemUpdates: false } },
  { name: 'Seun Adebayo',    email: 'seun.adebayo@bmsengafe.com',     password: 'Password@123', verified: true, roles: ['director'],             country: 'Nigeria', city: 'Lagos',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: true,  postSchedule: true,  systemUpdates: false } },
  // Marketing
  { name: 'Tunde Adeyemi',   email: 'tunde.adeyemi@bmsengafe.com',    password: 'Password@123', verified: true, roles: ['social_media_manager'], country: 'Nigeria', city: 'Ibadan',        timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: false, postSchedule: true,  systemUpdates: true  } },
  { name: 'Yetunde Balogun', email: 'yetunde.balogun@bmsengafe.com',  password: 'Password@123', verified: true, roles: ['content_strategist'],  country: 'Nigeria', city: 'Lagos',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: false, galleryAssets: false, postSchedule: true,  systemUpdates: false } },
  { name: 'Kofi Asante',     email: 'kofi.asante@bmsengafe.com',      password: 'Password@123', verified: true, roles: ['brand_manager'],        country: 'Ghana',   city: 'Accra',         timezone: 'Africa/Accra',  notificationPrefs: { accountSecurity: false, galleryAssets: false, postSchedule: true,  systemUpdates: true  } },
  // Additional
  { name: 'Sadiq Idris',     email: 'ssirdeeq@gmail.com',             password: 'Password@123', verified: true, roles: ['videographer'],         country: 'Nigeria', city: 'Lagos',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: true,  galleryAssets: true,  postSchedule: true,  systemUpdates: true  } },
  { name: 'Brainstorm Media', email: 'brainstormmediaservices@gmail.com', password: 'Password@123', verified: true, roles: ['creative_director'], country: 'Nigeria', city: 'Lagos',         timezone: 'Africa/Lagos',  notificationPrefs: { accountSecurity: true,  galleryAssets: true,  postSchedule: true,  systemUpdates: true  } },
];

const seed = async () => {
  await connectDB();

  console.log('\n🗑  Deleting all existing users...');
  await User.deleteMany({});
  console.log('✓  All users deleted.\n');

  let created = 0;
  for (const u of users) {
    await User.create(u);
    console.log(`✓  Created: ${u.name} <${u.email}> — [${u.roles.join(', ')}]`);
    created++;
  }

  console.log(`\n✅  Seeded ${created} users successfully.`);
  await mongoose.disconnect();
};

seed().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
