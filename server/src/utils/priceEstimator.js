/**
 * Basic car price estimator based on luxury and utility factors
 */
const estimateCarPrice = ({ brand, model, year, kmDriven, fuelType, transmission, variant, ownerNumber }) => {
  const currentYear = new Date().getFullYear();
  const ageYears = Math.max(0, currentYear - year);

  // Base luxury/premium starting prices
  let basePrice = 500000; // Minimal default
  const brandCaps = brand.toLowerCase();
  if (['mercedes-benz', 'bmw', 'audi', 'porsche'].includes(brandCaps)) {
    basePrice = 3500000;
  } else if (['toyota', 'volkswagen', 'skoda'].includes(brandCaps)) {
    basePrice = 1200000;
  } else if (['honda', 'hyundai', 'kia'].includes(brandCaps)) {
    basePrice = 800000;
  }

  // Depreciation: ~12% per year for luxury cars
  const depreciationFactor = Math.pow(0.88, ageYears);

  // Km-driven deduction: Rs 3 per km for cars
  const kmDeduction = Math.min(kmDriven * 3, basePrice * 0.4);

  // Transmission multiplier
  const transFactor = transmission === 'Automatic' ? 1.15 : 1.0;

  // Fuel Type multiplier
  const fuelMultipliers = { 'Electric': 1.25, 'Hybrid': 1.2, 'Diesel': 1.1, 'Petrol': 1.0, 'CNG': 0.95 };
  const fuelFactor = fuelMultipliers[fuelType] || 1.0;

  // Owner count deduction
  const ownerFactors = { '1st': 1.0, '2nd': 0.9, '3rd': 0.8, '4th': 0.7, '4th+': 0.6 };
  const ownerFactor = ownerFactors[ownerNumber] || 0.9;

  const estimated = Math.round((basePrice * depreciationFactor - kmDeduction) * transFactor * fuelFactor * ownerFactor);
  return Math.max(estimated, 100000); // min Rs. 1 Lakh
};

module.exports = { estimateCarPrice };
