const asyncHandler = require('express-async-handler');
const Bike = require('../models/Bike');
const Enquiry = require('../models/Enquiry');

// @desc  Get all bikes (with filters)
// @route GET /api/bikes
const getBikes = asyncHandler(async (req, res) => {
  const {
    type, brand, model, minPrice, maxPrice, minYear, maxYear,
    minKm, maxKm, condition, fuelType, city, sort, page = 1, limit = 12, search, isAdmin
  } = req.query;

  const query = isAdmin === 'true' ? {} : { isApproved: true, status: 'available' };

  if (type) query.type = type;
  if (brand) query.brand = new RegExp(brand, 'i');
  if (model) query.model = new RegExp(model, 'i');
  if (condition) query.condition = condition;
  if (fuelType) query.fuelType = fuelType;
  if (city) query['location.city'] = new RegExp(city, 'i');
  if (minPrice || maxPrice) query.price = { ...(minPrice && { $gte: Number(minPrice) }), ...(maxPrice && { $lte: Number(maxPrice) }) };
  if (minYear || maxYear) query.year = { ...(minYear && { $gte: Number(minYear) }), ...(maxYear && { $lte: Number(maxYear) }) };
  if (minKm || maxKm) query.kmDriven = { ...(minKm && { $gte: Number(minKm) }), ...(maxKm && { $lte: Number(maxKm) }) };
  if (search) query.$or = [
    { title: new RegExp(search, 'i') },
    { brand: new RegExp(search, 'i') },
    { model: new RegExp(search, 'i') },
  ];

  const p = Number(page);
  const l = Number(limit);

  const sortOptions = {
    newest: { createdAt: -1, _id: -1 },
    oldest: { createdAt: 1, _id: 1 },
    price_asc: { price: 1, _id: 1 },
    price_desc: { price: -1, _id: -1 },
    popular: { views: -1, _id: -1 },
  };

  const total = await Bike.countDocuments(query);
  const bikes = await Bike.find(query)
    .populate('seller', 'name phone')
    .sort(sortOptions[sort] || { createdAt: -1, _id: -1 })
    .skip((p - 1) * l)
    .limit(l);

  res.json({
    success: true,
    total,
    page: p,
    pages: Math.ceil(total / l),
    bikes,
  });
});

// @desc  Get single bike
// @route GET /api/bikes/:id
const getBike = asyncHandler(async (req, res) => {
  const bike = await Bike.findById(req.params.id).populate('seller', 'name phone email');
  if (!bike) { res.status(404); throw new Error('Bike not found'); }

  // Increment views
  bike.views += 1;
  await bike.save();

  res.json({ success: true, bike });
});

// @desc  Create bike listing (admin)
// @route POST /api/bikes
const createBike = asyncHandler(async (req, res) => {
  const images = req.files ? req.files.map((f) => f.path) : [];
  const body = { ...req.body };
  if (typeof body.specifications === 'string') body.specifications = JSON.parse(body.specifications);
  if (typeof body.location === 'string') body.location = JSON.parse(body.location);
  if (typeof body.features === 'string') body.features = JSON.parse(body.features);
  if (typeof body.pincodePricing === 'string') body.pincodePricing = JSON.parse(body.pincodePricing);
  if (typeof body.sellerDetails === 'string') body.sellerDetails = JSON.parse(body.sellerDetails);
  const bike = await Bike.create({
    ...body,
    images,
    seller: req.user._id,
    isApproved: req.user.role === 'admin',
  });
  res.status(201).json({ success: true, bike });
});

// @desc  Update bike
// @route PUT /api/bikes/:id
const updateBike = asyncHandler(async (req, res) => {
  const existingBike = await Bike.findById(req.params.id);
  if (!existingBike) { res.status(404); throw new Error('Bike not found'); }

  const body = { ...req.body };
  if (typeof body.specifications === 'string') body.specifications = JSON.parse(body.specifications);
  if (typeof body.location === 'string') body.location = JSON.parse(body.location);
  if (typeof body.features === 'string') body.features = JSON.parse(body.features);
  if (typeof body.pincodePricing === 'string') body.pincodePricing = JSON.parse(body.pincodePricing);
  if (typeof body.sellerDetails === 'string') body.sellerDetails = JSON.parse(body.sellerDetails);

  // Merge with existing valid data if body field is empty or not provided
  for (const key of Object.keys(existingBike.toObject())) {
    if (key === 'price' || key === 'discountedPrice') {
      if (body[key] === '' || body[key] === undefined || body[key] === 'undefined' || body[key] === 'null' || Number(body[key]) === 0) {
        body[key] = existingBike[key];
      }
    } else if (key === 'pincodePricing') {
      if (!body.pincodePricing || !Array.isArray(body.pincodePricing) || body.pincodePricing.length === 0) {
        body.pincodePricing = existingBike.pincodePricing;
      } else if (Array.isArray(existingBike.pincodePricing)) {
        body.pincodePricing = body.pincodePricing.map(newP => {
          const existingP = existingBike.pincodePricing.find(p => p.pincode === newP.pincode && p.size === newP.size);
          if (existingP) {
            return {
              ...existingP.toObject(),
              ...newP,
              price: newP.price || existingP.price,
              originalPrice: newP.originalPrice || existingP.originalPrice,
              discount: newP.discount || existingP.discount,
              inventory: newP.inventory !== undefined && newP.inventory !== null ? newP.inventory : existingP.inventory
            };
          }
          return newP;
        });
      }
    } else {
      if (body[key] === '' || body[key] === undefined || body[key] === 'undefined' || body[key] === 'null') {
        body[key] = existingBike[key];
      }
    }
  }

  // Same for nested objects
  if (body.location && existingBike.location) {
    for (const k of Object.keys(existingBike.location.toObject() || {})) {
      if (body.location[k] === '' || body.location[k] === undefined) {
        body.location[k] = existingBike.location[k];
      }
    }
  }
  if (body.specifications && existingBike.specifications) {
    for (const k of Object.keys(existingBike.specifications.toObject() || {})) {
      if (body.specifications[k] === '' || body.specifications[k] === undefined) {
        body.specifications[k] = existingBike.specifications[k];
      }
    }
  }
  if (body.sellerDetails && existingBike.sellerDetails) {
    for (const k of Object.keys(existingBike.sellerDetails.toObject() || {})) {
      if (body.sellerDetails[k] === '' || body.sellerDetails[k] === undefined) {
        body.sellerDetails[k] = existingBike.sellerDetails[k];
      }
    }
  }

  // Merge existing images (URLs kept from client) + newly uploaded files
  const existing = body.existingImages ? (Array.isArray(body.existingImages) ? body.existingImages : [body.existingImages]) : [];
  const newUploads = (req.files || []).map(f => f.path);
  if (existing.length > 0 || newUploads.length > 0) body.images = [...existing, ...newUploads];
  delete body.existingImages;

  const updated = await Bike.findByIdAndUpdate(req.params.id, body, { new: true });
  res.json({ success: true, bike: updated });
});

// @desc  Delete bike
// @route DELETE /api/bikes/:id
const deleteBike = asyncHandler(async (req, res) => {
  const bike = await Bike.findByIdAndDelete(req.params.id);
  if (!bike) { res.status(404); throw new Error('Bike not found'); }
  res.json({ success: true, message: 'Bike deleted' });
});

// @desc  Get featured bikes
// @route GET /api/bikes/featured
const getFeaturedBikes = asyncHandler(async (req, res) => {
  const bikes = await Bike.find({ isFeatured: true, isApproved: true, status: 'available' }).limit(8);
  res.json({ success: true, bikes });
});

// @desc  Get bestseller bikes
// @route GET /api/bikes/bestseller
const getBestsellerBikes = asyncHandler(async (req, res) => {
  const bikes = await Bike.find({ bestSeller: true, isApproved: true, status: 'available' }).limit(8);
  res.json({ success: true, bikes });
});

// @desc  Enquire about a bike
// @route POST /api/bikes/:id/enquire
const enquireBike = asyncHandler(async (req, res) => {
  const { message, phone } = req.body;
  const bike = await Bike.findById(req.params.id);
  if (!bike) { res.status(404); throw new Error('Bike not found'); }
  
  // Register or update the enquiry record
  await Enquiry.findOneAndUpdate(
    { user: req.user._id, bike: req.params.id },
    { message, phone, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  // Still keep user in bike enquiries array for backwards compatibility
  if (!bike.enquiries.includes(req.user._id)) {
    bike.enquiries.push(req.user._id);
    await bike.save();
  }
  res.json({ success: true, message: 'Enquiry registered' });
});

// @desc  Get distinct brands from active bikes
// @route GET /api/bikes/brands
const getBrands = asyncHandler(async (req, res) => {
  const brands = await Bike.distinct('brand', { status: 'available' });
  res.json({ success: true, brands: brands.sort() });
});

// @desc  Get user's bike enquiries
// @route GET /api/bikes/my-enquiries
const getMyEnquiries = asyncHandler(async (req, res) => {
  const enquiries = await Enquiry.find({ user: req.user._id })
    .populate({
      path: 'bike',
      populate: { path: 'seller', select: 'name phone' }
    })
    .sort({ createdAt: -1 });

  res.json({ success: true, enquiries });
});

module.exports = { getBikes, getBike, getBrands, createBike, updateBike, deleteBike, getFeaturedBikes, getBestsellerBikes, enquireBike, getMyEnquiries };
