require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const SparePart = require('../models/SparePart');

/**
 * Seed the spare-parts storefront with a starter catalogue.
 *
 *   node server/src/seeds/seedSpareParts.js
 *
 * Idempotent: keyed on `sku`. A part that already exists is left completely
 * alone (so your price and stock edits survive a re-run); a part you
 * soft-deleted is reactivated rather than duplicated.
 *
 * Images point at /part-images/*.svg in client/public — drawn illustrations,
 * not photos of the real product. Replace them with supplier photography from
 * Admin -> Parts when you have it; nothing else needs to change.
 */

const img = (name) => [`/part-images/${name}.svg`];

const PARTS = [
  {
    sku: 'GK-LGT-OSR-H7',
    name: 'Osram Night Breaker Laser H7 Headlight Bulb (Twin Pack)',
    category: 'lighting',
    brand: 'Osram',
    description:
      'Up to 150% more brightness and a beam roughly 150 m long, with a whiter 3500K light than a standard halogen. '
      + 'Supplied as a matched pair — always replace both sides together so the beam stays even.',
    price: 4200,
    discountedPrice: 3500,
    stock: 40,
    images: img('headlight-bulb'),
    isFeatured: true,
    bestSeller: true,
    ratings: 4.8,
    numReviews: 124,
    specifications: {
      'Base': 'H7 (PX26d)',
      'Voltage': '12V',
      'Wattage': '55W',
      'Colour temperature': '3500K',
      'Pack': '2 bulbs',
      'Warranty': '6 months',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Hyundai Creta', 'Honda City', 'Hyundai i20', 'Tata Nexon'],
  },
  {
    sku: 'GK-ELE-HEL-HORN',
    name: 'Hella Red Grill Twin Horn Set',
    category: 'electrical',
    brand: 'Hella',
    description:
      'Two-tone trumpet horn pair rated at 118 dB, with the weatherproof red grill housing Hella is known for. '
      + 'Includes the mounting bracket and relay harness needed for a direct fit.',
    price: 1899,
    discountedPrice: 1450,
    stock: 65,
    images: img('horn-set'),
    isFeatured: true,
    ratings: 4.7,
    numReviews: 86,
    specifications: {
      'Sound level': '118 dB',
      'Frequency': '400 Hz / 500 Hz',
      'Voltage': '12V',
      'Current draw': '5A',
      'Pack': '2 horns + relay harness',
      'Warranty': '12 months',
    },
    compatibleBikes: ['Universal — 12V vehicles'],
  },
  {
    sku: 'GK-FLD-CAS-GTX4',
    name: 'Castrol GTX 10W-30 Engine Oil — 4 Litre',
    category: 'fluids',
    brand: 'Castrol',
    description:
      'Semi-synthetic engine oil with Castrol’s double-action formula: it cleans away old sludge while protecting '
      + 'against new deposits. Suits most petrol engines running a 10W-30 recommendation.',
    price: 2350,
    discountedPrice: 1900,
    stock: 120,
    images: img('engine-oil'),
    isFeatured: true,
    bestSeller: true,
    ratings: 4.6,
    numReviews: 212,
    specifications: {
      'Grade': '10W-30',
      'Type': 'Semi-synthetic',
      'Volume': '4 L',
      'Specification': 'API SN / ILSAC GF-5',
      'Suits': 'Petrol engines',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Honda City', 'Hyundai i20', 'Toyota Glanza'],
  },
  {
    sku: 'GK-ELE-EXI-65AH',
    name: 'Exide Invaplus 65Ah Car Battery',
    category: 'electrical',
    brand: 'Exide',
    description:
      'Maintenance-free 65Ah battery with high cranking power for cold starts and long idle periods. '
      + 'Comes with a 48-month warranty (24 months free replacement, 24 months pro-rata).',
    price: 6999,
    discountedPrice: 5799,
    stock: 18,
    images: img('car-battery'),
    bestSeller: true,
    ratings: 4.5,
    numReviews: 156,
    specifications: {
      'Capacity': '65 Ah',
      'Voltage': '12V',
      'Cranking amps': '540 CCA',
      'Type': 'Maintenance free',
      'Warranty': '48 months (24 free + 24 pro-rata)',
    },
    compatibleBikes: ['Hyundai Creta', 'Honda City', 'Tata Nexon', 'Mahindra XUV300'],
  },
  {
    sku: 'GK-ENG-KN-AIRF',
    name: 'K&N High-Flow Washable Air Filter',
    category: 'engine',
    brand: 'K&N',
    description:
      'Cotton-gauze filter that flows more air than a paper element and is washable rather than disposable — '
      + 'clean it every 15,000 km and it lasts the life of the car.',
    price: 3300,
    discountedPrice: 2799,
    stock: 26,
    images: img('air-filter'),
    isFeatured: true,
    ratings: 4.7,
    numReviews: 112,
    specifications: {
      'Media': 'Oiled cotton gauze',
      'Service life': 'Washable, reusable',
      'Clean interval': 'Every 15,000 km',
      'Warranty': '12 months',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Hyundai Creta', 'Volkswagen Polo'],
  },
  {
    sku: 'GK-BRK-BOS-PADF',
    name: 'Bosch Front Brake Pad Set',
    category: 'brakes',
    brand: 'Bosch',
    description:
      'Low-dust ceramic front pads with a chamfered, slotted face for quiet braking. '
      + 'Set of four — enough for both front wheels.',
    price: 2999,
    discountedPrice: 2450,
    stock: 34,
    images: img('brake-kit'),
    ratings: 4.6,
    numReviews: 74,
    specifications: {
      'Position': 'Front axle',
      'Material': 'Ceramic',
      'Pack': '4 pads (both wheels)',
      'Wear sensor': 'Included',
      'Warranty': '12 months',
    },
    compatibleBikes: ['Honda City', 'Hyundai Creta', 'Maruti Suzuki Ciaz'],
  },
  {
    sku: 'GK-BRK-BRE-DISC',
    name: 'Brembo Ventilated Front Brake Disc (Pair)',
    category: 'brakes',
    brand: 'Brembo',
    description:
      'Internally vented cast-iron rotors that shed heat far better than solid discs, so the pedal stays firm '
      + 'through repeated hard stops. Sold as a matched pair.',
    price: 8499,
    discountedPrice: 6899,
    stock: 12,
    images: img('brake-kit'),
    ratings: 4.8,
    numReviews: 41,
    specifications: {
      'Position': 'Front axle',
      'Type': 'Ventilated',
      'Material': 'High-carbon cast iron',
      'Pack': '2 discs',
      'Warranty': '12 months',
    },
    compatibleBikes: ['Honda City', 'Hyundai Creta', 'Skoda Rapid'],
  },
  {
    sku: 'GK-EXT-BOS-WIPE',
    name: 'Bosch Aerotwin Flat Wiper Blade Set',
    category: 'exterior',
    brand: 'Bosch',
    description:
      'Frameless flat blades with an integrated spoiler that keeps them pressed to the glass at highway speed. '
      + 'Even wipe, no juddering, and no metal frame to ice up.',
    price: 1499,
    discountedPrice: 1150,
    stock: 80,
    images: img('wiper-blades'),
    bestSeller: true,
    ratings: 4.5,
    numReviews: 168,
    specifications: {
      'Type': 'Frameless / flat blade',
      'Pack': '2 blades (driver + passenger)',
      'Rubber': 'Natural rubber, graphite coated',
      'Warranty': '6 months',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Hyundai Creta', 'Honda City', 'Tata Nexon'],
  },
  {
    sku: 'GK-ENG-NGK-IRID',
    name: 'NGK Iridium IX Spark Plug — Set of 4',
    category: 'engine',
    brand: 'NGK',
    description:
      'Fine-wire iridium centre electrode gives a stronger, more consistent spark than a copper plug and lasts '
      + 'far longer. Noticeably smoother idle and easier cold starts.',
    price: 2650,
    discountedPrice: 2190,
    stock: 55,
    images: img('spark-plugs'),
    ratings: 4.7,
    numReviews: 93,
    specifications: {
      'Electrode': 'Iridium',
      'Pack': '4 plugs',
      'Gap': 'Pre-gapped',
      'Service life': 'Up to 100,000 km',
      'Warranty': '12 months',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Honda City', 'Hyundai i20'],
  },
  {
    sku: 'GK-FIL-MAN-OILF',
    name: 'Mann-Filter Spin-On Oil Filter',
    category: 'filters',
    brand: 'Mann-Filter',
    description:
      'OE-quality spin-on filter with an anti-drainback valve, so oil pressure comes up immediately on a cold '
      + 'start instead of after a few dry seconds. Replace at every oil change.',
    price: 820,
    discountedPrice: 640,
    stock: 140,
    images: img('oil-filter'),
    ratings: 4.6,
    numReviews: 205,
    specifications: {
      'Type': 'Spin-on',
      'Anti-drainback valve': 'Yes',
      'Bypass valve': 'Yes',
      'Change interval': 'Every oil change',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Hyundai Creta', 'Honda City', 'Tata Nexon'],
  },
  {
    sku: 'GK-FLD-SHE-U5W40',
    name: 'Shell Helix Ultra 5W-40 Fully Synthetic — 4 Litre',
    category: 'fluids',
    brand: 'Shell',
    description:
      'Fully synthetic oil made from natural gas rather than crude, so it starts out almost free of impurities. '
      + 'Best pick for turbocharged engines and long service intervals.',
    price: 3899,
    discountedPrice: 3250,
    stock: 60,
    images: img('engine-oil'),
    isFeatured: true,
    ratings: 4.8,
    numReviews: 147,
    specifications: {
      'Grade': '5W-40',
      'Type': 'Fully synthetic',
      'Volume': '4 L',
      'Specification': 'API SN / ACEA A3-B4',
      'Suits': 'Petrol and diesel',
    },
    compatibleBikes: ['Hyundai Creta', 'Tata Nexon', 'Mahindra XUV700', 'Volkswagen Polo'],
  },
  {
    sku: 'GK-FLD-CAS-COOL',
    name: 'Castrol Radicool Ready-Mix Coolant — 5 Litre',
    category: 'fluids',
    brand: 'Castrol',
    description:
      'Pre-mixed long-life coolant — pour it in as supplied, no dilution. Protects against boiling, freezing and '
      + 'internal corrosion for up to 250,000 km.',
    price: 1450,
    discountedPrice: 1180,
    stock: 70,
    images: img('coolant'),
    ratings: 4.5,
    numReviews: 68,
    specifications: {
      'Type': 'Ready-mix (no dilution)',
      'Volume': '5 L',
      'Technology': 'Organic acid (OAT)',
      'Service life': 'Up to 250,000 km',
    },
    compatibleBikes: ['Universal — most petrol and diesel cars'],
  },
  {
    sku: 'GK-TYR-MRF-19555',
    name: 'MRF ZVTV 195/55 R16 Tubeless Tyre',
    category: 'tyres_wheels',
    brand: 'MRF',
    description:
      'Silica-compound touring tyre tuned for wet grip and a quiet ride. Sold individually — fit in pairs on the '
      + 'same axle at minimum, all four for the most predictable handling.',
    price: 8600,
    discountedPrice: 7450,
    stock: 24,
    images: img('tyre'),
    ratings: 4.4,
    numReviews: 119,
    specifications: {
      'Size': '195/55 R16',
      'Construction': 'Tubeless radial',
      'Load index': '87',
      'Speed rating': 'V (240 km/h)',
      'Sold as': '1 tyre',
    },
    compatibleBikes: ['Honda City', 'Hyundai Verna', 'Maruti Suzuki Ciaz'],
  },
  {
    sku: 'GK-INT-GKM-7DMAT',
    name: '7D Custom-Fit Floor Mat Set',
    category: 'interior',
    brand: 'GK Motors',
    description:
      'Laser-measured per model so the mat follows the footwell exactly — no trimming, no bunching under the '
      + 'pedals. Raised lip holds spills and monsoon water instead of letting it reach the carpet.',
    price: 3999,
    discountedPrice: 2999,
    stock: 45,
    images: img('floor-mats'),
    isFeatured: true,
    ratings: 4.6,
    numReviews: 88,
    specifications: {
      'Fit': 'Model specific',
      'Material': '7D PU leather over EVA foam',
      'Pack': 'Full set (front, rear, boot)',
      'Cleaning': 'Wipe or rinse',
      'Warranty': '12 months',
    },
    compatibleBikes: ['Maruti Suzuki Swift', 'Hyundai Creta', 'Honda City'],
  },
];

const seed = async () => {
  await connectDB();

  let created = 0;
  let restored = 0;
  let skipped = 0;

  for (const spec of PARTS) {
    const existing = await SparePart.findOne({ sku: spec.sku });

    if (existing) {
      if (existing.isActive) {
        console.log(`  = ${spec.name} — already there, left alone`);
        skipped += 1;
      } else {
        existing.isActive = true;
        await existing.save();
        console.log(`  ↻ ${spec.name} — reactivated`);
        restored += 1;
      }
      continue;
    }

    await SparePart.create({ ...spec, isActive: true });
    console.log(`  + ${spec.name}`);
    created += 1;
  }

  const total = await SparePart.countDocuments({ isActive: true });
  const featured = await SparePart.countDocuments({ isActive: true, isFeatured: true });

  console.log('');
  console.log(`Added ${created}, reactivated ${restored}, unchanged ${skipped}.`);
  console.log(`${total} active part${total === 1 ? '' : 's'} in the store, ${featured} of them featured.`);
  console.log('');
  console.log('Manage them in Admin -> Parts. Tick "Featured" on a part to put it in');
  console.log('the Featured strip at the top of the Spares page.');

  process.exit(0);
};

seed().catch((err) => {
  console.error('❌ Spare parts seed failed:', err.message);
  process.exit(1);
});
