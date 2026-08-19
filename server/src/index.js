require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
const RentalBooking = require('./models/RentalBooking');

const connectDB = require('./config/db');
const { bootstrapCatalogue } = require('./seeds/bootstrap');
const errorHandler = require('./middleware/errorHandler');

const authRoutes = require('./routes/authRoutes');
const bikeRoutes = require('./routes/bikeRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const sellRoutes = require('./routes/sellRoutes');
const partRoutes = require('./routes/partRoutes');
const adminRoutes = require('./routes/adminRoutes');
const rentalRoutes = require('./routes/rentalRoutes');
const serviceCarRoutes = require('./routes/serviceCarRoutes');
const contactRoutes = require('./routes/contactRoutes');
const serviceCategoryRoutes = require('./routes/serviceCategoryRoutes');

// Connect to MongoDB, then make sure the service catalogue exists. The site
// has nothing to show without it, so this runs on every boot rather than
// relying on someone remembering a seed command. It is additive and respects
// anything the admin has since edited or deleted.
connectDB().then(() => bootstrapCatalogue());

const app = express();

// Security & Parsing Middleware
app.use(helmet({ crossOriginResourcePolicy: false }));
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'https://autoexpress.avanienterprises.in'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Static Folders
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'BikeService API is running', env: process.env.NODE_ENV });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bikes', bikeRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/sell', sellRoutes);
app.use('/api/store', partRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rentals', rentalRoutes);
app.use('/api/service-cars', serviceCarRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/service-categories', serviceCategoryRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Error Handler
app.use(errorHandler);

// ── SOCKET.IO SETUP ──────────────────────────────────────────
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Mobile app sends location updates
  socket.on('update_location', async (data) => {
    try {
      const { bookingId, lat, lng, heading, speed } = data;
      if (!bookingId || lat == null || lng == null) return;

      // Overwrite currentLocation in DB (no history = no bloat)
      await RentalBooking.findByIdAndUpdate(bookingId, {
        currentLocation: {
          lat,
          lng,
          heading: heading || 0,
          speed: speed || 0,
          updatedAt: new Date(),
        },
      });

      // Broadcast to admins watching this booking
      io.to(`booking_${bookingId}`).emit('location_update', {
        bookingId,
        lat,
        lng,
        heading: heading || 0,
        speed: speed || 0,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error('Location update error:', err.message);
    }
  });

  // Admin joins a room to watch a specific booking
  socket.on('admin_watch_booking', (bookingId) => {
    socket.join(`booking_${bookingId}`);
    console.log(`👁️  Admin watching booking: ${bookingId}`);
  });

  // Admin watches ALL active bookings
  socket.on('admin_watch_all', async () => {
    try {
      const activeBookings = await RentalBooking.find({ status: 'active' }).select('_id');
      activeBookings.forEach((b) => socket.join(`booking_${b._id}`));
      console.log(`👁️  Admin watching all ${activeBookings.length} active bookings`);
    } catch (err) {
      console.error('Admin watch all error:', err.message);
    }
  });

  // Mobile app signals tracking has stopped
  socket.on('stop_tracking', (bookingId) => {
    console.log(`📍 Tracking stopped for booking: ${bookingId}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes if needed
app.set('io', io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT} in ${process.env.NODE_ENV} mode`);
});

module.exports = { app, server, io };
