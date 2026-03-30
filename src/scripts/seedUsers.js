require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/database');
const User = require('../models/User');

// One user per role group — covers all departments
const users = [
  // ── Executive ──────────────────────────────────────────────────────────────
  {
    name: 'Amara Osei',
    email: 'amara.osei@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['ceo'],
    bio: 'CEO of BMS Engage. Leads strategy and agency operations.',
    country: 'Ghana',
    city: 'Accra',
    timezone: 'Africa/Accra',
    notificationPrefs: { accountSecurity: true, galleryAssets: true, postSchedule: true, systemUpdates: true },
    activeContext: 'personal',
  },
  {
    name: 'Kwame Mensah',
    email: 'kwame.mensah@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['creative_director'],
    bio: 'Creative Director overseeing all visual output.',
    country: 'Ghana',
    city: 'Kumasi',
    timezone: 'Africa/Accra',
    notificationPrefs: { accountSecurity: true, galleryAssets: true, postSchedule: true, systemUpdates: false },
    activeContext: 'personal',
  },
  {
    name: 'Zainab Musa',
    email: 'zainab.musa@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['head_of_production'],
    bio: 'Head of Production managing all production pipelines.',
    country: 'Nigeria',
    city: 'Abuja',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: true, galleryAssets: true, postSchedule: true, systemUpdates: true },
    activeContext: 'personal',
  },

  // ── Creative ───────────────────────────────────────────────────────────────
  {
    name: 'Fatima Al-Hassan',
    email: 'fatima.alhassan@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['graphic_designer'],
    bio: 'Graphic designer specialising in brand identity and digital assets.',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: true, postSchedule: false, systemUpdates: false },
    activeContext: 'personal',
  },
  {
    name: 'Emeka Nwosu',
    email: 'emeka.nwosu@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['photographer'],
    bio: 'Commercial photographer with a focus on product and lifestyle.',
    country: 'Nigeria',
    city: 'Port Harcourt',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: true, postSchedule: false, systemUpdates: false },
    activeContext: 'personal',
  },
  {
    name: 'Aisha Diallo',
    email: 'aisha.diallo@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['videographer'],
    bio: 'Videographer and motion graphics artist.',
    country: 'Senegal',
    city: 'Dakar',
    timezone: 'Africa/Dakar',
    notificationPrefs: { accountSecurity: false, galleryAssets: true, postSchedule: false, systemUpdates: false },
    activeContext: 'personal',
  },
  {
    name: 'Chidi Eze',
    email: 'chidi.eze@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['editor'],
    bio: 'Video and photo editor with 5 years of post-production experience.',
    country: 'Nigeria',
    city: 'Enugu',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: true, postSchedule: false, systemUpdates: false },
    activeContext: 'personal',
  },

  // ── Production ─────────────────────────────────────────────────────────────
  {
    name: 'Nkechi Okafor',
    email: 'nkechi.okafor@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['producer'],
    bio: 'Producer coordinating campaigns from brief to delivery.',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: true, postSchedule: true, systemUpdates: false },
    activeContext: 'personal',
  },
  {
    name: 'Seun Adebayo',
    email: 'seun.adebayo@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['director'],
    bio: 'Director of commercial and branded content productions.',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: true, postSchedule: true, systemUpdates: false },
    activeContext: 'personal',
  },

  // ── Marketing ──────────────────────────────────────────────────────────────
  {
    name: 'Tunde Adeyemi',
    email: 'tunde.adeyemi@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['social_media_manager'],
    bio: 'Social media manager growing brand presence across all platforms.',
    country: 'Nigeria',
    city: 'Ibadan',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: false, postSchedule: true, systemUpdates: true },
    activeContext: 'personal',
  },
  {
    name: 'Yetunde Balogun',
    email: 'yetunde.balogun@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['content_strategist'],
    bio: 'Content strategist building editorial calendars and brand voice.',
    country: 'Nigeria',
    city: 'Lagos',
    timezone: 'Africa/Lagos',
    notificationPrefs: { accountSecurity: false, galleryAssets: false, postSchedule: true, systemUpdates: false },
    activeContext: 'personal',
  },
  {
    name: 'Kofi Asante',
    email: 'kofi.asante@bmsengafe.com',
    password: 'Password@123',
    verified: true,
    roles: ['brand_manager'],
    bio: 'Brand manager ensuring consistency across all client touchpoints.',
    country: 'Ghana',
    city: 'Accra',
    timezone: 'Africa/Accra',
    notificationPrefs: { accountSecurity: false, galleryAssets: false, postSchedule: true, systemUpdates: true },
    activeContext: 'personal',
  },
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
