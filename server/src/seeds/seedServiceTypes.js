require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const ServiceType = require('../models/ServiceType');

const SERVICE_TYPES = [
  { value: 'car_wash', label: 'Car Wash', price: 'From ₹499', desc: 'Premium foam wash, interior cleaning & wax polish', order: 1 },
  { value: 'ac_service', label: 'AC Service', price: 'From ₹1,499', desc: 'Gas recharge, filter clean & cooling check', order: 2 },
  { value: 'denting_painting', label: 'Denting & Painting', price: 'From ₹2,499', desc: 'Precision body work & factory-finish paint', order: 3 },
  { value: 'oil_change', label: 'Oil Change', price: 'From ₹1,999', desc: 'Synthetic oil, filter replacement & fluid check', order: 4 },
  { value: 'wheel_alignment', label: 'Wheel Alignment', price: 'From ₹999', desc: '3D alignment, balancing & tyre inspection', order: 5 },
  { value: 'battery_replacement', label: 'Battery Replacement', price: 'From ₹3,999', desc: 'Multi-brand battery check & installation', order: 6 },
  { value: 'tyre_replacement', label: 'Tyre Replacement', price: 'From ₹4,499', desc: 'Premium tyre fitting & nitro inflation', order: 7 },
  { value: 'engine_repair', label: 'Engine Repair', price: 'From ₹4,999', desc: 'Advanced diagnostics & precision tuning', order: 8 },
  { value: 'pickup_drop', label: 'Pickup & Drop', price: 'Free', desc: 'Safe & secure valet service for maintenance', order: 9 },
];

const seed = async () => {
  await connectDB();
  for (const st of SERVICE_TYPES) {
    await ServiceType.findOneAndUpdate({ value: st.value }, st, { upsert: true, new: true });
  }
  console.log('Service types seeded successfully!');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
