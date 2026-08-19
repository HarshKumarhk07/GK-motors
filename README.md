# 🏍️ MotoXpress — Bike Buy, Sell & Service Platform README

## Project Structure

```
bike-service/
├── client/                    # React + Vite + Tailwind Frontend
│   ├── src/
│   │   ├── api/               # authApi, bikeApi, serviceApi, storeApi
│   │   ├── components/        # Navbar, Footer, BikeCard, PartCard, Spinner
│   │   ├── context/           # AuthContext, CartContext
│   │   ├── pages/             # Home, Login, Register, BuyBikes, BikeDetail,
│   │   │                      # SellBike, Services, SpareParts, Cart, MyBookings
│   │   └── pages/admin/       # Admin Dashboard
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── .env
│
└── server/                    # Node.js + Express Backend API
    ├── src/
    │   ├── config/            # db.js, cloudinary.js, razorpay.js
    │   ├── models/            # User, Bike, ServiceBooking, SellRequest, SparePart, Order
    │   ├── controllers/       # auth, bike, service, sell, part, admin
    │   ├── routes/            # auth, bike, service, sell, part, admin
    │   ├── middleware/        # auth.js, admin.js, upload.js, errorHandler.js
    │   ├── services/          # emailService.js, paymentService.js
    │   ├── utils/             # generateToken.js, priceEstimator.js
    │   └── index.js
    └── .env
```

## 🚀 Quick Start

```bash
# Terminal 1 - Backend
cd server
npm run dev          # → http://localhost:5000

# Terminal 2 - Frontend
cd client
npm run dev          # → http://localhost:5173
```

## Environment Variables

### server/.env
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/bikeservice
JWT_SECRET=your_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
SMTP_HOST=smtp.gmail.com
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
```

### client/.env
```env
VITE_RAZORPAY_KEY_ID=your_razorpay_key_id
VITE_GOOGLE_MAPS_KEY=your_maps_key
```

## API Endpoints Summary

| Route | Description | Auth |
|-------|-------------|------|
| POST /api/auth/register | Register | Public |
| POST /api/auth/login | Login | Public |
| POST /api/auth/send-otp | Send OTP | Public |
| POST /api/auth/verify-otp | Verify OTP | Public |
| GET /api/bikes | List bikes (filters) | Public |
| GET /api/bikes/:id | Bike detail | Public |
| POST /api/bikes | Create listing | User |
| POST /api/services | Book service | User |
| GET /api/services/my | My bookings | User |
| PUT /api/services/:id/status | Update status | Mechanic/Admin |
| POST /api/sell | Submit sell request | User |
| POST /api/sell/estimate | Price estimate | Public |
| GET /api/store/parts | Browse parts | Public |
| POST /api/store/orders | Place order | User |
| GET /api/admin/stats | Dashboard | Admin |
| GET /api/admin/users | All users | Admin |

## Create Admin User

After registering: Update role in MongoDB:
```js
db.users.updateOne({ email: "admin@..." }, { $set: { role: "admin" } })
```

## Theme Colors
- Primary: `#111111` (Matte Black)
- Secondary: `#E53935` (Red)
- Success: `#2E7D32` (Green)
- Warning: `#FB8C00` (Orange)
