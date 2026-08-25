const mongoose = require('mongoose');

/**
 * Central error handler.
 *
 * Two jobs: give the client a message it can act on, and leave enough in the
 * log to diagnose the failure. Stack traces go to the log, never to the
 * client outside development.
 */
const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  let statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  let message = err.message || 'Internal Server Error';

  /* Validation helpers throw rather than calling res.status(), because they
     have no response object. They carry the status on the error instead; a
     plain `throw new Error()` is unaffected and still falls through to the
     res.statusCode logic above. */
  if (err.status && Number.isInteger(err.status) && err.status >= 400 && err.status < 600) {
    statusCode = err.status;
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 404;
    message = 'Resource not found';
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue || {})[0] || 'value';
    message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // Multer
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 413;
    message = 'That file is too large';
  }

  // A JSON body that failed to parse reaches here as a SyntaxError
  if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    message = 'Malformed request body';
  }

  // One structured line per failure: enough to find it, without dumping
  // request bodies that may hold passwords or identity documents.
  const entry = {
    level: statusCode >= 500 ? 'error' : 'warn',
    at: new Date().toISOString(),
    status: statusCode,
    method: req.method,
    path: req.originalUrl,
    message,
    user: req.user?._id ? String(req.user._id) : undefined,
    ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress,
  };
  if (statusCode >= 500) {
    console.error(JSON.stringify(entry), '\n', err.stack);
  } else {
    console.warn(JSON.stringify(entry));
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

/**
 * Health endpoint with enough detail to drive an uptime check.
 * 200 only when the database is actually usable; 503 otherwise, so a load
 * balancer takes the instance out rather than sending it traffic it cannot serve.
 */
const healthCheck = async (req, res) => {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = mongoose.connection.readyState;
  let dbOk = state === 1;

  // readyState only says the socket is up — ping to confirm it answers.
  if (dbOk) {
    try {
      await mongoose.connection.db.admin().ping();
    } catch (err) {
      dbOk = false;
      console.error('Health check: database ping failed ->', err.message);
    }
  }

  const body = {
    success: dbOk,
    status: dbOk ? 'ok' : 'degraded',
    uptimeSeconds: Math.floor(process.uptime()),
    env: process.env.NODE_ENV || 'development',
    database: {
      state: states[state] || 'unknown',
      name: mongoose.connection.name || null,
      reachable: dbOk,
    },
    services: {
      payments: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      email: Boolean(process.env.BREVO_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER)),
      uploads: Boolean(process.env.CLOUDINARY_API_KEY) ? 'cloudinary' : 'local-disk',
      kycEncryption: Boolean(process.env.FIELD_ENCRYPTION_KEY),
    },
    timestamp: new Date().toISOString(),
  };

  res.status(dbOk ? 200 : 503).json(body);
};

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.healthCheck = healthCheck;
