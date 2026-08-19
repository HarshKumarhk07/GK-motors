const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password -otp -otpExpiry');
      if (!req.user || !req.user.isActive) {
        return res.status(401).json({ success: false, message: 'Not authorized' });
      }
      next();
    } catch (error) {
      return res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token, authorization denied' });
  }
};

module.exports = { protect };
