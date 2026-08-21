/**
 * The GK Motors service catalogue, as data only.
 *
 * Imported by the startup bootstrap and by the CLI seeders, so there is one
 * definition rather than three copies drifting apart. This file has no side
 * effects — requiring it will not touch the database.
 *
 * `id` is the join key: it becomes ServiceCategory.categoryId and
 * ServiceType.categoryId, and is what bookings resolve through. Never
 * renumber an existing entry.
 *
 * `tier` drives cart behaviour. basic / standard / comprehensive replace one
 * another within a category; `single` packages stack alongside anything.
 *
 * Everything after `desc` is presentation detail read by ServicePackageCard:
 * `features` is the tick list, `durationHours` / `warranty` /
 * `recommendedInterval*` / `pickupDrop` fill the small meta row, and
 * `isRecommended` shows the green flag. None of it participates in pricing.
 * An admin may edit any of it later, which is why seeds/bootstrap.js only ever
 * fills fields that are still empty.
 */

// Slugs select the shipped illustration in client/public/service-icons/.
const CATEGORY_SLUGS = {
  1: 'car-service',        2: 'ac-service',          3: 'batteries',
  4: 'tyres-wheel-care',   5: 'denting-painting',    6: 'detailing-service',
  7: 'car-spa-cleaning',   8: 'car-inspections',     9: 'windshields-lights',
  10: 'suspension-fitments', 11: 'clutch-body-parts', 12: 'insurance-claims',
};

const CATEGORY_BLURBS = {
  1: 'Periodic maintenance & oil change',   2: 'AC gas refill, cooling check',
  3: 'Battery replacement & testing',       4: 'Tyre rotation, alignment, balancing',
  5: 'Dent removal & premium painting',     6: 'Interior & exterior deep cleaning',
  7: 'Washing, waxing & polishing',         8: 'Comprehensive vehicle checkup',
  9: 'Glass repair & headlight restoration', 10: 'Suspension repair & accessories',
  11: 'Clutch replacement & body repair',   12: 'Insurance claim assistance',
};

const CATEGORIES = [
  {
    id: 1, name: 'Car Service', packages: [
      {
        value: 'car_service_basic', label: 'Basic Service', tier: 'basic', basePrice: 2999,
        desc: 'Engine oil & filter change, 40-point health check, fluid top-up',
        features: [
          'Engine oil replaced with grade-matched oil',
          'New oil filter fitted',
          '40-point digital health check',
          'Coolant, brake and washer fluid top-up',
          'Battery and terminal check',
          'Tyre pressure set to spec',
          'Interior vacuum and exterior wash',
        ],
        durationHours: 4,
        warranty: { months: 1, distanceKm: 1000 },
        recommendedIntervalKm: 5000, recommendedIntervalMonths: 6,
        pickupDrop: 'free',
      },
      {
        value: 'car_service_standard', label: 'Standard Service', tier: 'standard', basePrice: 4999,
        desc: 'Basic + air/cabin filter, brake inspection, coolant & AC check',
        features: [
          'Everything in Basic Service',
          'Air filter and cabin filter replaced',
          'Brake pad and disc inspection',
          'Coolant strength check and top-up',
          'AC cooling performance check',
          'Wiper blade and washer jet check',
          'Underbody and suspension inspection',
          'Battery load test',
        ],
        durationHours: 6,
        warranty: { months: 3, distanceKm: 2000 },
        recommendedIntervalKm: 10000, recommendedIntervalMonths: 6,
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'car_service_comprehensive', label: 'Comprehensive Service', tier: 'comprehensive', basePrice: 7999,
        desc: 'Standard + spark plugs, wheel alignment, throttle clean, interior detail',
        features: [
          'Everything in Standard Service',
          'Spark plugs replaced',
          'Throttle body and injector cleaning',
          'Brake fluid replaced',
          '3D wheel alignment and balancing',
          'Interior detailing and cabin sanitisation',
          'Rubbing, polishing and wax finish',
          'Engine scan for stored fault codes',
        ],
        durationHours: 8,
        warranty: { months: 6, distanceKm: 5000 },
        recommendedIntervalKm: 15000, recommendedIntervalMonths: 12,
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 2, name: 'AC Service & Repair', packages: [
      {
        value: 'ac_gas_refill', label: 'AC Gas Refill', tier: 'basic', basePrice: 1499,
        desc: 'Refrigerant top-up, leak check and cooling performance test',
        features: [
          'Refrigerant topped up to manufacturer spec',
          'Leak test across lines and joints',
          'Compressor oil level check',
          'Vent temperature reading shared with you',
          'Cooling performance road test',
        ],
        durationHours: 2,
        warranty: { months: 1 },
        recommendedIntervalMonths: 12,
        pickupDrop: 'free',
      },
      {
        value: 'ac_service_standard', label: 'AC Service', tier: 'standard', basePrice: 2999,
        desc: 'Gas refill + cabin filter, condenser clean, blower & vent sanitisation',
        features: [
          'Everything in AC Gas Refill',
          'Cabin filter replaced',
          'Condenser coil cleaned',
          'Blower motor cleaned and tested',
          'Anti-bacterial vent sanitisation',
          'Drain pipe cleared',
        ],
        durationHours: 3,
        warranty: { months: 3 },
        recommendedIntervalMonths: 12,
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'ac_overhaul', label: 'AC Overhaul', tier: 'comprehensive', basePrice: 5999,
        desc: 'Full teardown, compressor & cooling coil service, evaporator clean',
        features: [
          'Compressor removed, inspected and serviced',
          'Evaporator coil removed and deep cleaned',
          'Expansion valve and receiver drier checked',
          'Full system vacuum before regas',
          'Condenser and pipeline flush',
          'Complete cooling performance report',
        ],
        durationHours: 8,
        warranty: { months: 6 },
        recommendedIntervalMonths: 36,
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 3, name: 'Batteries', packages: [
      {
        value: 'battery_health_check', label: 'Battery Health Check', tier: 'single', basePrice: 499,
        desc: 'Load test, terminal clean and charging-system diagnosis',
        features: [
          'Load and cranking test',
          'Open-circuit voltage reading',
          'Terminal corrosion cleaned',
          'Alternator charging output tested',
          'Written health report with remaining life',
        ],
        durationHours: 1,
      },
      {
        value: 'battery_replacement', label: 'Battery Replacement', tier: 'single', basePrice: 3999,
        desc: 'New branded battery fitted at your doorstep with warranty',
        features: [
          'New branded battery (Exide / Amaron / Livguard)',
          'Fitted at your home or office',
          'Old battery collected and disposed responsibly',
          'Terminals cleaned and anti-corrosion coated',
          'Charging system verified after fitting',
        ],
        durationHours: 1,
        warranty: { months: 24 },
        isRecommended: true,
      },
      {
        value: 'battery_jumpstart', label: 'Jump Start & Terminal Clean', tier: 'single', basePrice: 299,
        desc: 'On-site jump start and corrosion removal',
        features: [
          'Technician reaches you with a jump pack',
          'Safe jump start',
          'Terminal corrosion removed',
          'Battery voltage checked after start',
          'Honest advice on whether it needs replacing',
        ],
        durationHours: 1,
      },
    ],
  },
  {
    id: 4, name: 'Tyre & Wheel Care', packages: [
      {
        value: 'wheel_balancing', label: 'Wheel Balancing', tier: 'basic', basePrice: 799,
        desc: 'Computerised balancing of all four wheels',
        features: [
          'Computerised balancing on all four wheels',
          'Balance weights fitted and re-verified',
          'Tyre pressure set to manufacturer spec',
          'Visual tread and sidewall check',
        ],
        durationHours: 1,
        recommendedIntervalKm: 5000,
        pickupDrop: 'free',
      },
      {
        value: 'wheel_alignment_balancing', label: 'Alignment + Balancing', tier: 'standard', basePrice: 1499,
        desc: '3D wheel alignment with computerised balancing',
        features: [
          '3D computerised wheel alignment',
          'Camber, caster and toe set to spec',
          'Balancing on all four wheels',
          'Steering wheel centring check',
          'Before and after alignment printout',
        ],
        durationHours: 2,
        recommendedIntervalKm: 10000, recommendedIntervalMonths: 6,
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'wheel_care_complete', label: 'Complete Wheel Care', tier: 'comprehensive', basePrice: 2299,
        desc: 'Alignment, balancing, rotation and nitrogen inflation',
        features: [
          'Everything in Alignment + Balancing',
          'Tyre rotation based on the wear pattern',
          'Nitrogen inflation on all four tyres',
          'Valve inspection and replacement if needed',
          'Suspension and steering quick check',
        ],
        durationHours: 3,
        recommendedIntervalKm: 10000, recommendedIntervalMonths: 6,
        pickupDrop: 'free',
      },
      {
        value: 'tyre_replacement', label: 'Tyre Replacement', tier: 'single', basePrice: 4499,
        desc: 'Premium tyre fitting with disposal of the old tyre',
        features: [
          'Premium tyre fitted (MRF / CEAT / Apollo / JK)',
          'Mounting, balancing and valve replacement',
          'Old tyre taken away and disposed',
          'Alignment checked after fitting',
          'Correct pressure set before handover',
        ],
        durationHours: 2,
        warranty: { months: 12 },
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 5, name: 'Denting & Painting', packages: [
      {
        value: 'denting_single_panel', label: 'Single Panel', tier: 'basic', basePrice: 2499,
        desc: 'Dent removal and factory-finish repaint for one panel',
        features: [
          'Dent pulling and panel beating',
          'Putty, primer and wet sanding',
          'Computerised shade matching',
          'Two-coat paint with 2K clear coat',
          'Oven baking and buffing',
        ],
        durationHours: 24,
        warranty: { months: 6 },
        pickupDrop: 'free',
      },
      {
        value: 'denting_three_panel', label: 'Three Panels', tier: 'standard', basePrice: 6499,
        desc: 'Dent removal and repaint for up to three panels',
        features: [
          'Dent removal on up to three panels',
          'Putty, primer and wet sanding',
          'Computerised shade matching',
          'Panel-to-panel blending so the join is invisible',
          'Oven baking, buffing and polish',
        ],
        durationHours: 48,
        warranty: { months: 6 },
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'denting_full_body', label: 'Full Body Paint', tier: 'comprehensive', basePrice: 18999,
        desc: 'Complete body repaint with primer, clear coat and buffing',
        features: [
          'Full body preparation and sanding',
          'Rust treatment wherever needed',
          'Primer, base coat and 2K clear coat',
          'Oven baked for a factory finish',
          'Cut, polish and wax',
          'Glass, trim and interior fully masked',
        ],
        durationHours: 96,
        warranty: { months: 12 },
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 6, name: 'Detailing Service', packages: [
      {
        value: 'detailing_interior', label: 'Interior Detailing', tier: 'basic', basePrice: 2999,
        desc: 'Deep vacuum, upholstery shampoo, dashboard and vent cleaning',
        features: [
          'Deep vacuum of cabin, boot and under the seats',
          'Fabric and upholstery shampoo',
          'Dashboard, console and door-trim detailing',
          'AC vent cleaning',
          'Leather conditioning where applicable',
          'Odour treatment',
        ],
        durationHours: 5,
        pickupDrop: 'free',
      },
      {
        value: 'detailing_full', label: 'Interior + Exterior', tier: 'standard', basePrice: 5499,
        desc: 'Interior detailing plus paint decontamination and machine polish',
        features: [
          'Everything in Interior Detailing',
          'Clay bar paint decontamination',
          'Machine polish to remove swirl marks',
          'Glass and plastic trim restoration',
          'Alloy and tyre dressing',
        ],
        durationHours: 8,
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'detailing_ceramic', label: 'Ceramic Coating', tier: 'comprehensive', basePrice: 12999,
        desc: 'Full detail with paint correction and 3-year ceramic coating',
        features: [
          'Multi-stage paint correction',
          'Full decontamination and IPA wipe-down',
          '9H ceramic coating applied and cured',
          'Glass and alloy coating included',
          'Hydrophobic water-beading finish',
          'Aftercare kit and washing guidance',
        ],
        durationHours: 48,
        warranty: { months: 36 },
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 7, name: 'Car Spa & Cleaning', packages: [
      {
        value: 'spa_express_wash', label: 'Express Wash', tier: 'basic', basePrice: 499,
        desc: 'Exterior foam wash, tyre dressing and quick interior vacuum',
        features: [
          'High-pressure exterior foam wash',
          'Wheel and wheel-arch cleaning',
          'Quick interior vacuum',
          'Glass cleaned inside and out',
          'Hand dried with microfibre',
        ],
        durationHours: 1,
        recommendedIntervalMonths: 1,
      },
      {
        value: 'spa_foam_wax', label: 'Foam Wash + Wax', tier: 'standard', basePrice: 999,
        desc: 'Foam wash, wax coat, interior vacuum and glass cleaning',
        features: [
          'Snow-foam pre-soak and two-bucket wash',
          'Wax coat for shine and protection',
          'Interior vacuum and dashboard polish',
          'Glass and mirror cleaning',
          'Tyre dressing and boot clean',
        ],
        durationHours: 2,
        recommendedIntervalMonths: 1,
        isRecommended: true,
      },
      {
        value: 'spa_premium', label: 'Premium Spa', tier: 'comprehensive', basePrice: 2499,
        desc: 'Underbody wash, wax polish, engine bay clean and full interior spa',
        features: [
          'Everything in Foam Wash + Wax',
          'Underbody wash with anti-rust spray',
          'Engine bay cleaning and dressing',
          'Full interior spa with seat shampoo',
          'Alloy polish and premium tyre dressing',
        ],
        durationHours: 4,
        recommendedIntervalMonths: 3,
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 8, name: 'Car Inspection', packages: [
      {
        value: 'inspection_40_point', label: '40-Point Inspection', tier: 'single', basePrice: 999,
        desc: 'Full health check with a digital report on WhatsApp',
        features: [
          'Engine, transmission and clutch check',
          'Brakes, suspension and steering check',
          'Battery, alternator and electricals',
          'Tyre tread depth and pressure report',
          'AC cooling performance check',
          'Digital report sent on WhatsApp',
        ],
        durationHours: 2,
        pickupDrop: 'free',
      },
      {
        value: 'inspection_pre_purchase', label: 'Pre-Purchase Inspection', tier: 'single', basePrice: 2499,
        desc: '200-point evaluation with accident history and valuation',
        features: [
          '200-point mechanical and electrical evaluation',
          'Paint thickness reading and accident-history check',
          'Chassis and underbody inspection',
          'Engine scan for stored fault codes',
          'RC, insurance and challan verification',
          'Fair-market valuation with buy / skip advice',
        ],
        durationHours: 4,
        isRecommended: true,
      },
    ],
  },
  {
    id: 9, name: 'Windshield & Light', packages: [
      {
        value: 'windshield_chip_repair', label: 'Windshield Chip Repair', tier: 'single', basePrice: 899,
        desc: 'Resin filling for chips and small cracks',
        features: [
          'Resin injection for chips and star cracks',
          'UV curing and surface levelling',
          'Optical clarity restored',
          'Stops the crack spreading further',
          'Repaired at your doorstep the same day',
        ],
        durationHours: 1,
        warranty: { months: 6 },
      },
      {
        value: 'windshield_replacement', label: 'Windshield Replacement', tier: 'single', basePrice: 6999,
        desc: 'OEM glass replacement with fitting and sealing',
        features: [
          'OEM-grade laminated glass',
          'Old glass and sealant fully removed',
          'Urethane bonding and sealing',
          'Rain sensor and camera bracket transferred',
          'Safe drive-away time advised',
        ],
        durationHours: 4,
        warranty: { months: 12 },
        pickupDrop: 'free',
      },
      {
        value: 'headlight_restoration', label: 'Headlight Restoration', tier: 'single', basePrice: 1499,
        desc: 'Polish and UV coat for yellowed or hazy headlamps',
        features: [
          'Wet sanding of the oxidised lens',
          'Multi-stage machine polishing',
          'UV-protective clear coat applied',
          'Noticeably clearer night-time beam',
          'Both headlamps treated',
        ],
        durationHours: 2,
        warranty: { months: 6 },
      },
    ],
  },
  {
    id: 10, name: 'Suspension & Fitments', packages: [
      {
        value: 'suspension_check', label: 'Suspension Check', tier: 'basic', basePrice: 799,
        desc: 'Full suspension and steering inspection with a written report',
        features: [
          'Shock absorber and strut inspection',
          'Bush, link rod and mount check',
          'Steering play and rack inspection',
          'Road test for noise and body roll',
          'Written report of what actually needs doing',
        ],
        durationHours: 1,
        pickupDrop: 'free',
      },
      {
        value: 'suspension_shocks', label: 'Shock Absorber Replacement', tier: 'standard', basePrice: 5999,
        desc: 'Front or rear shock absorber pair replaced and tested',
        features: [
          'Front or rear pair replaced together',
          'OEM-grade shock absorbers',
          'Mounts and bump stops inspected',
          'Alignment checked after fitting',
          'Post-fitment road test',
        ],
        durationHours: 4,
        warranty: { months: 12 },
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'suspension_overhaul', label: 'Suspension Overhaul', tier: 'comprehensive', basePrice: 12999,
        desc: 'Struts, bushes, links and mounts replaced with alignment',
        features: [
          'Struts and shock absorbers replaced',
          'Control-arm bushes and link rods replaced',
          'Ball joints and strut mounts renewed',
          'Coil springs inspected for sag',
          '3D wheel alignment included',
          'Full road test before handover',
        ],
        durationHours: 8,
        warranty: { months: 12 },
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 11, name: 'Clutch & Body Parts', packages: [
      {
        value: 'clutch_plate_replacement', label: 'Clutch Plate Replacement', tier: 'single', basePrice: 8999,
        desc: 'Clutch plate, pressure plate and release bearing replaced',
        features: [
          'Clutch plate, pressure plate and release bearing',
          'Gearbox removal and refitting',
          'Flywheel inspected, resurfacing advised if needed',
          'Clutch pedal free-play set',
          'Road test before handover',
        ],
        durationHours: 8,
        warranty: { months: 12 },
        pickupDrop: 'free', isRecommended: true,
      },
      {
        value: 'clutch_cable_bearing', label: 'Clutch Cable / Bearing', tier: 'single', basePrice: 2499,
        desc: 'Cable, bearing or master cylinder repair and adjustment',
        features: [
          'Clutch cable or hydraulic line repair',
          'Release bearing replacement',
          'Master and slave cylinder checked',
          'Pedal travel adjusted',
          'Fluid topped up and bled',
        ],
        durationHours: 3,
        warranty: { months: 6 },
        pickupDrop: 'free',
      },
      {
        value: 'body_part_replacement', label: 'Body Part Replacement', tier: 'single', basePrice: 3499,
        desc: 'Bumper, fender, mirror or door handle replacement',
        features: [
          'Bumper, fender, mirror or door handle',
          'Genuine or OEM-grade part',
          'Fitting with panel gap alignment',
          'Shade-matched paint where required',
          'Old part disposed of for you',
        ],
        durationHours: 6,
        warranty: { months: 6 },
        pickupDrop: 'free',
      },
    ],
  },
  {
    id: 12, name: 'Insurance Claims', packages: [
      {
        value: 'insurance_claim_assist', label: 'Claim Assistance', tier: 'single', basePrice: 999,
        desc: 'Paperwork, surveyor coordination and claim filing support',
        features: [
          'Claim intimated to your insurer',
          'Documents prepared and submitted',
          'Surveyor visit coordinated',
          'Repair estimate shared with the insurer',
          'Status updates until settlement',
        ],
        durationHours: 2,
      },
      {
        value: 'insurance_cashless_endtoend', label: 'End-to-End Cashless Claim', tier: 'single', basePrice: 2999,
        desc: 'Complete cashless claim handling from pickup to delivery',
        features: [
          'Doorstep pickup and delivery',
          'Complete cashless claim handling',
          'Surveyor and insurer coordination throughout',
          'Repairs carried out at an authorised workshop',
          'You pay only your policy deductible',
          'Car delivered washed and ready',
        ],
        durationHours: 4,
        pickupDrop: 'free', isRecommended: true,
      },
    ],
  },
];

/**
 * Realistic service photo path, derived rather than repeated on every entry.
 * The files live in client/public/service-packages/ and are named after `value`.
 */
for (const category of CATEGORIES) {
  for (const pkg of category.packages) {
    if (!pkg.image) pkg.image = `/service-packages/${pkg.value}.jpg`;
  }
}

/**
 * The nine original single-service types the packages above replaced.
 *
 * Two of them — battery_replacement and tyre_replacement — are also live
 * package values, so retiring the list wholesale would deactivate the very
 * packages the bootstrap had just created. Anything still in CATEGORIES is
 * filtered out here rather than at the call site.
 */
const ALL_PACKAGE_VALUES = new Set(
  CATEGORIES.flatMap((c) => c.packages.map((p) => p.value))
);

const LEGACY_VALUES = [
  'car_wash', 'ac_service', 'denting_painting', 'oil_change', 'wheel_alignment',
  'battery_replacement', 'tyre_replacement', 'engine_repair', 'pickup_drop',
].filter((value) => !ALL_PACKAGE_VALUES.has(value));

const inr = (n) => `From ₹${n.toLocaleString('en-IN')}`;

module.exports = { CATEGORIES, LEGACY_VALUES, CATEGORY_SLUGS, CATEGORY_BLURBS, inr };
