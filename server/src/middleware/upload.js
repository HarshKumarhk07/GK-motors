const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');

// Check if Cloudinary is configured
const isCloudinaryConfigured = process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_KEY !== 'your_api_key';

// Local storage fallback setup
const getLocalStorage = (folder) => {
  const uploadPath = path.join(__dirname, '../../uploads', folder);
  if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
  
  return multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadPath),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
};

// Bike image/video storage
const bikeStorage = isCloudinaryConfigured 
  ? new CloudinaryStorage({
      cloudinary,
      params: async (req, file) => {
        const isVideo = file.mimetype.startsWith('video/');
        return {
          folder: 'bikeservice/bikes',
          resource_type: isVideo ? 'video' : 'image',
          allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov'],
        };
      },
    })
  : getLocalStorage('bikes');

// Avatar storage
const avatarStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'bikeservice/avatars',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      },
    })
  : getLocalStorage('avatars');

// Parts storage — auto resource_type handles both images and video
const partsStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: async (_req, file) => ({
        folder: 'bikeservice/parts',
        resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'mp4', 'mov', 'webm'],
      }),
    })
  : getLocalStorage('parts');

const fileFilter = (req, file, cb) => {
  const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm'];
  cb(null, allowedMime.includes(file.mimetype));
};

const partMulter = multer({ storage: partsStorage, fileFilter, limits: { fileSize: 100 * 1024 * 1024 } });

exports.uploadBikeMedia = multer({ storage: bikeStorage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
exports.uploadAvatar = multer({ storage: avatarStorage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
// All media (images + videos) uploaded together in order via 'images' field
exports.uploadPartMedia = partMulter.array('images', 10);

// Added for category/brand images
exports.uploadCategoryMedia = multer({
  storage: isCloudinaryConfigured
    ? new CloudinaryStorage({ cloudinary, params: { folder: 'bikeservice/categories', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] } })
    : getLocalStorage('categories'),
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Service-car images for the GK Motors service booking flow
const serviceCarStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: { folder: 'bikeservice/service-cars', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] },
    })
  : getLocalStorage('service-cars');

exports.uploadServiceCarImage = multer({
  storage: serviceCarStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 5 * 1024 * 1024 },
});

// KYC documents (Aadhar, PAN, License) for rental bookings
const kycStorage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary,
      params: {
        folder: 'bikeservice/rental-kyc',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
      },
    })
  : getLocalStorage('rental-kyc');

exports.uploadRentalKyc = multer({
  storage: kycStorage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    cb(null, allowed.includes(file.mimetype));
  },
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'aadharImage', maxCount: 1 },
  { name: 'panImage', maxCount: 1 },
  { name: 'licenseImage', maxCount: 1 },
]);

