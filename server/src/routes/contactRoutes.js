const express = require('express');
const router = express.Router();
const {
  createContactMessage,
  getContactMessages,
  updateContactMessage,
} = require('../controllers/contactController');
const { protect } = require('../middleware/auth');
const { adminOnly } = require('../middleware/admin');

// Public — anyone can send a message.
router.post('/', createContactMessage);

// Admin.
router.get('/', protect, adminOnly, getContactMessages);
router.put('/:id', protect, adminOnly, updateContactMessage);

module.exports = router;
