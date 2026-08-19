const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Admin access only' });
};

const mechanicOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'mechanic')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Mechanic or Admin access only' });
};

module.exports = { adminOnly, mechanicOrAdmin };
