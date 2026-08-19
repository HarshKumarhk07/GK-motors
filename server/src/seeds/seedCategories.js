require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');

const CATEGORIES = [
  { name: 'seat_covers' },
  { name: 'car_mats' },
  { name: 'air_fresheners' },
  { name: 'body_covers' },
  { name: 'lighting' },
  { name: 'interior_accessories' },
  { name: 'cleaning_kits' },
  { name: 'electronics' }
];

const seed = async () => {
  await connectDB();
  for (const cat of CATEGORIES) {
    await Category.findOneAndUpdate({ name: cat.name }, cat, { upsert: true, new: true });
  }
  console.log('Categories seeded successfully!');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
