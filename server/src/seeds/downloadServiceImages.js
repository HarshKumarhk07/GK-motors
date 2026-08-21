const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, '../../../client/public/service-packages');

// Curated high quality, realistic automotive photography for each service package
const SERVICE_IMAGES = {
  // Category 1: Car Service
  'car_service_basic': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80', // Engine oil change / mechanics under hood
  'car_service_standard': 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&w=800&q=80', // Filter & general maintenance
  'car_service_comprehensive': 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80', // Full workshop diagnostic overhaul

  // Category 2: AC Service & Repair
  'ac_gas_refill': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80', // AC cooling / dashboard / vents
  'ac_service_standard': 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80', // AC filter & cleaning
  'ac_overhaul': 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80', // Compressor / engine cooling teardown

  // Category 3: Batteries
  'battery_health_check': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80', // Multimeter / battery diagnostics
  'battery_replacement': 'https://images.unsplash.com/photo-1580274455191-1c62238fa333?auto=format&fit=crop&w=800&q=80', // New car battery installation
  'battery_jumpstart': 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=800&q=80', // Jump start cables

  // Category 4: Tyre & Wheel Care
  'wheel_balancing': 'https://images.unsplash.com/photo-1578844251758-2f71da64c96f?auto=format&fit=crop&w=800&q=80', // Wheel balance machine
  'wheel_alignment_balancing': 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80', // 3D laser alignment
  'wheel_care_complete': 'https://images.unsplash.com/photo-1541348263662-e0c8de4259ba?auto=format&fit=crop&w=800&q=80', // Complete tyre care & rotation
  'tyre_replacement': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80', // New tyre replacement

  // Category 5: Denting & Painting
  'denting_single_panel': 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80', // Dent pulling & repair
  'denting_three_panel': 'https://images.unsplash.com/photo-1613214149922-f1809c99b414?auto=format&fit=crop&w=800&q=80', // Body prep & sanding
  'denting_full_body': 'https://images.unsplash.com/photo-1588258524675-c6352932bfd5?auto=format&fit=crop&w=800&q=80', // Full spray paint booth

  // Category 6: Detailing Service
  'detailing_interior': 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80', // Interior deep vacuum & leather care
  'detailing_full': 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80', // Machine rotary buffer polish
  'detailing_ceramic': 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=800&q=80', // 9H ceramic coating gloss

  // Category 7: Car Spa & Cleaning
  'spa_express_wash': 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=800&q=80', // High pressure wash
  'spa_foam_wax': 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=800&q=80', // Snow foam shampoo
  'spa_premium': 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=800&q=80', // Engine bay & underbody spa

  // Category 8: Car Inspection
  'inspection_40_point': 'https://images.unsplash.com/photo-1530046339160-ce3e530c7d2f?auto=format&fit=crop&w=800&q=80', // Inspection on hydraulic lift
  'inspection_pre_purchase': 'https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=800&q=80', // Comprehensive pre-purchase evaluation

  // Category 9: Windshield & Light
  'windshield_chip_repair': 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=800&q=80', // Windshield repair
  'windshield_replacement': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=800&q=80', // Windshield replacement
  'headlight_restoration': 'https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=800&q=80', // Headlight clarity restoration

  // Category 10: Suspension & Fitments
  'suspension_check': 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?auto=format&fit=crop&w=800&q=80', // Strut & spring inspection
  'suspension_shocks': 'https://images.unsplash.com/photo-1580273916550-e323be2ae537?auto=format&fit=crop&w=800&q=80', // Shock absorber replacement
  'suspension_overhaul': 'https://images.unsplash.com/photo-1517524008697-84bbe3c3fd98?auto=format&fit=crop&w=800&q=80', // Complete suspension overhaul

  // Category 11: Clutch & Body Parts
  'clutch_plate_replacement': 'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80', // Gearbox & clutch assembly
  'clutch_cable_bearing': 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=800&q=80', // Clutch release bearing
  'body_part_replacement': 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=800&q=80', // Bumper & fender fitting

  // Category 12: Insurance Claims
  'insurance_claim_assist': 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=800&q=80', // Surveyor inspection & paperwork
  'insurance_cashless_endtoend': 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=800&q=80', // Cashless settlement handover
};

function downloadUrl(url, destPath) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    const req = proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadUrl(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: status ${res.statusCode}`));
      }
      const out = fs.createWriteStream(destPath);
      res.pipe(out);
      out.on('finish', () => {
        out.close(() => resolve());
      });
      out.on('error', reject);
    });
    req.on('error', reject);
  });
}

async function run() {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log(`Downloading real-life service images for ${Object.keys(SERVICE_IMAGES).length} packages...`);

  for (const [key, url] of Object.entries(SERVICE_IMAGES)) {
    const destPath = path.join(targetDir, `${key}.jpg`);
    try {
      await downloadUrl(url, destPath);
      console.log(`✓ Downloaded ${key}.jpg`);
    } catch (err) {
      console.error(`✗ Error downloading ${key}:`, err.message);
    }
  }

  console.log('All real-life service package images downloaded successfully.');
}

if (require.main === module) {
  run();
}

module.exports = { SERVICE_IMAGES, run };
