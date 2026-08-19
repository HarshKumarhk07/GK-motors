require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const connectDB = require('../config/db');
const ServiceType = require('../models/ServiceType');

/**
 * GK Motors service catalogue.
 *
 * The 12 categories mirror SERVICE_CATEGORIES in client/src/pages/Services.jsx —
 * keep `id` and `name` in sync across both files.
 *
 * `tier` drives cart behaviour: basic / standard / comprehensive are mutually
 * exclusive within a category (adding one replaces the other), while `single`
 * packages stack freely.
 *
 * `basePrice` is the fallback price used for manually-entered cars and for any
 * catalogue car the admin has not priced individually.
 *
 * Run:  node server/src/seeds/seedServicePackages.js
 *       node server/src/seeds/seedServicePackages.js --retire-legacy
 */
const CATEGORIES = [
  {
    id: 1, name: 'Car Service', packages: [
      { value: 'car_service_basic', label: 'Basic Service', tier: 'basic', basePrice: 2999, desc: 'Engine oil & filter change, 40-point health check, fluid top-up' },
      { value: 'car_service_standard', label: 'Standard Service', tier: 'standard', basePrice: 4999, desc: 'Basic + air/cabin filter, brake inspection, coolant & AC check' },
      { value: 'car_service_comprehensive', label: 'Comprehensive Service', tier: 'comprehensive', basePrice: 7999, desc: 'Standard + spark plugs, wheel alignment, throttle clean, interior detail' },
    ],
  },
  {
    id: 2, name: 'AC Service & Repair', packages: [
      { value: 'ac_gas_refill', label: 'AC Gas Refill', tier: 'basic', basePrice: 1499, desc: 'Refrigerant top-up, leak check and cooling performance test' },
      { value: 'ac_service_standard', label: 'AC Service', tier: 'standard', basePrice: 2999, desc: 'Gas refill + cabin filter, condenser clean, blower & vent sanitisation' },
      { value: 'ac_overhaul', label: 'AC Overhaul', tier: 'comprehensive', basePrice: 5999, desc: 'Full teardown, compressor & cooling coil service, evaporator clean' },
    ],
  },
  {
    id: 3, name: 'Batteries', packages: [
      { value: 'battery_health_check', label: 'Battery Health Check', tier: 'single', basePrice: 499, desc: 'Load test, terminal clean and charging-system diagnosis' },
      { value: 'battery_replacement', label: 'Battery Replacement', tier: 'single', basePrice: 3999, desc: 'New branded battery fitted at your doorstep with warranty' },
      { value: 'battery_jumpstart', label: 'Jump Start & Terminal Clean', tier: 'single', basePrice: 299, desc: 'On-site jump start and corrosion removal' },
    ],
  },
  {
    id: 4, name: 'Tyre & Wheel Care', packages: [
      { value: 'wheel_balancing', label: 'Wheel Balancing', tier: 'basic', basePrice: 799, desc: 'Computerised balancing of all four wheels' },
      { value: 'wheel_alignment_balancing', label: 'Alignment + Balancing', tier: 'standard', basePrice: 1499, desc: '3D wheel alignment with computerised balancing' },
      { value: 'wheel_care_complete', label: 'Complete Wheel Care', tier: 'comprehensive', basePrice: 2299, desc: 'Alignment, balancing, rotation and nitrogen inflation' },
      { value: 'tyre_replacement', label: 'Tyre Replacement', tier: 'single', basePrice: 4499, desc: 'Premium tyre fitting with disposal of the old tyre' },
    ],
  },
  {
    id: 5, name: 'Denting & Painting', packages: [
      { value: 'denting_single_panel', label: 'Single Panel', tier: 'basic', basePrice: 2499, desc: 'Dent removal and factory-finish repaint for one panel' },
      { value: 'denting_three_panel', label: 'Three Panels', tier: 'standard', basePrice: 6499, desc: 'Dent removal and repaint for up to three panels' },
      { value: 'denting_full_body', label: 'Full Body Paint', tier: 'comprehensive', basePrice: 18999, desc: 'Complete body repaint with primer, clear coat and buffing' },
    ],
  },
  {
    id: 6, name: 'Detailing Service', packages: [
      { value: 'detailing_interior', label: 'Interior Detailing', tier: 'basic', basePrice: 2999, desc: 'Deep vacuum, upholstery shampoo, dashboard and vent cleaning' },
      { value: 'detailing_full', label: 'Interior + Exterior', tier: 'standard', basePrice: 5499, desc: 'Interior detailing plus paint decontamination and machine polish' },
      { value: 'detailing_ceramic', label: 'Ceramic Coating', tier: 'comprehensive', basePrice: 12999, desc: 'Full detail with paint correction and 3-year ceramic coating' },
    ],
  },
  {
    id: 7, name: 'Car Spa & Cleaning', packages: [
      { value: 'spa_express_wash', label: 'Express Wash', tier: 'basic', basePrice: 499, desc: 'Exterior foam wash, tyre dressing and quick interior vacuum' },
      { value: 'spa_foam_wax', label: 'Foam Wash + Wax', tier: 'standard', basePrice: 999, desc: 'Foam wash, wax coat, interior vacuum and glass cleaning' },
      { value: 'spa_premium', label: 'Premium Spa', tier: 'comprehensive', basePrice: 2499, desc: 'Underbody wash, wax polish, engine bay clean and full interior spa' },
    ],
  },
  {
    id: 8, name: 'Car Inspection', packages: [
      { value: 'inspection_40_point', label: '40-Point Inspection', tier: 'single', basePrice: 999, desc: 'Full health check with a digital report on WhatsApp' },
      { value: 'inspection_pre_purchase', label: 'Pre-Purchase Inspection', tier: 'single', basePrice: 2499, desc: '200-point evaluation with accident history and valuation' },
    ],
  },
  {
    id: 9, name: 'Windshield & Light', packages: [
      { value: 'windshield_chip_repair', label: 'Windshield Chip Repair', tier: 'single', basePrice: 899, desc: 'Resin filling for chips and small cracks' },
      { value: 'windshield_replacement', label: 'Windshield Replacement', tier: 'single', basePrice: 6999, desc: 'OEM glass replacement with fitting and sealing' },
      { value: 'headlight_restoration', label: 'Headlight Restoration', tier: 'single', basePrice: 1499, desc: 'Polish and UV coat for yellowed or hazy headlamps' },
    ],
  },
  {
    id: 10, name: 'Suspension & Fitments', packages: [
      { value: 'suspension_check', label: 'Suspension Check', tier: 'basic', basePrice: 799, desc: 'Full suspension and steering inspection with a written report' },
      { value: 'suspension_shocks', label: 'Shock Absorber Replacement', tier: 'standard', basePrice: 5999, desc: 'Front or rear shock absorber pair replaced and tested' },
      { value: 'suspension_overhaul', label: 'Suspension Overhaul', tier: 'comprehensive', basePrice: 12999, desc: 'Struts, bushes, links and mounts replaced with alignment' },
    ],
  },
  {
    id: 11, name: 'Clutch & Body Parts', packages: [
      { value: 'clutch_plate_replacement', label: 'Clutch Plate Replacement', tier: 'single', basePrice: 8999, desc: 'Clutch plate, pressure plate and release bearing replaced' },
      { value: 'clutch_cable_bearing', label: 'Clutch Cable / Bearing', tier: 'single', basePrice: 2499, desc: 'Cable, bearing or master cylinder repair and adjustment' },
      { value: 'body_part_replacement', label: 'Body Part Replacement', tier: 'single', basePrice: 3499, desc: 'Bumper, fender, mirror or door handle replacement' },
    ],
  },
  {
    id: 12, name: 'Insurance Claims', packages: [
      { value: 'insurance_claim_assist', label: 'Claim Assistance', tier: 'single', basePrice: 999, desc: 'Paperwork, surveyor coordination and claim filing support' },
      { value: 'insurance_cashless_endtoend', label: 'End-to-End Cashless Claim', tier: 'single', basePrice: 2999, desc: 'Complete cashless claim handling from pickup to delivery' },
    ],
  },
];

// The nine service types seeded for the old single-service screen. The
// packages above supersede them; pass --retire-legacy to deactivate them so
// they stop appearing in the new booking flow. Nothing is deleted, so an
// admin can re-enable any of them from the dashboard.
const LEGACY_VALUES = [
  'car_wash', 'ac_service', 'denting_painting', 'oil_change', 'wheel_alignment',
  'battery_replacement', 'tyre_replacement', 'engine_repair', 'pickup_drop',
];

const inr = (n) => `From ₹${n.toLocaleString('en-IN')}`;

const seed = async () => {
  await connectDB();

  const retireLegacy = process.argv.includes('--retire-legacy');
  let created = 0;
  let updated = 0;
  let order = 0;

  for (const category of CATEGORIES) {
    for (const pkg of category.packages) {
      order += 1;
      const doc = {
        value: pkg.value,
        label: pkg.label,
        price: inr(pkg.basePrice),
        desc: pkg.desc,
        basePrice: pkg.basePrice,
        categoryId: category.id,
        categoryName: category.name,
        categoryType: 'service',
        tier: pkg.tier,
        isActive: true,
        order,
      };
      const existing = await ServiceType.findOne({ value: pkg.value });
      if (existing) {
        // Preserve any price the admin has edited; refresh the taxonomy fields.
        existing.label = doc.label;
        existing.desc = doc.desc;
        existing.categoryId = doc.categoryId;
        existing.categoryName = doc.categoryName;
        existing.categoryType = doc.categoryType;
        existing.tier = doc.tier;
        existing.order = doc.order;
        if (!existing.basePrice) {
          existing.basePrice = doc.basePrice;
          existing.price = doc.price;
        }
        await existing.save();
        updated += 1;
      } else {
        await ServiceType.create(doc);
        created += 1;
      }
    }
  }

  let retired = 0;
  if (retireLegacy) {
    const result = await ServiceType.updateMany(
      { value: { $in: LEGACY_VALUES } },
      { $set: { isActive: false } }
    );
    retired = result.modifiedCount ?? result.nModified ?? 0;
  }

  const uncategorised = await ServiceType.countDocuments({ isActive: true, categoryId: null });

  console.log(`✅ Service packages seeded — ${created} created, ${updated} updated across ${CATEGORIES.length} categories.`);
  if (retireLegacy) {
    console.log(`   Retired ${retired} legacy service type(s): ${LEGACY_VALUES.join(', ')}`);
  } else if (uncategorised > 0) {
    console.log(`   ⚠️  ${uncategorised} active service type(s) have no categoryId and will not appear in the booking flow.`);
    console.log('      Re-run with --retire-legacy to deactivate the old single-service types.');
  }
  process.exit(0);
};

seed().catch((err) => { console.error(err); process.exit(1); });

module.exports = { CATEGORIES, LEGACY_VALUES };
