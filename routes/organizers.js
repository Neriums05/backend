const router = require('express').Router();
const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const { requireRole } = require('../middleware/auth');

// Must be before /:id
router.put('/profile', ...requireRole('organizer'), async (req, res) => {
  try {
    const { organizerName, category, description, contactEmail, discordWebhook, contactNumber } = req.body;

    if (contactNumber && contactNumber.length !== 10) {
      return res.status(400).json({ message: 'Contact Number must be exactly 10 digits' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { organizerName, category, description, contactEmail, discordWebhook, contactNumber },
      { new: true }
    ).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const organizers = await User.find({ role: 'organizer' })
      .select('organizerName category description contactEmail');
    res.json(organizers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id)
      .select('organizerName category description contactEmail');
    if (!organizer) return res.status(404).json({ message: 'Organizer not found' });
    res.json(organizer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/password-reset-request', ...requireRole('organizer'), async (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason || !reason.trim()) {
      return res.status(400).json({ message: 'Reason is required' });
    }

    const existingPending = await PasswordResetRequest.findOne({
      organizer: req.user.id,
      status: 'pending'
    });

    if (existingPending) {
      return res.status(400).json({ message: 'You already have a pending password reset request' });
    }

    const request = await PasswordResetRequest.create({
      organizer: req.user.id,
      reason: reason.trim()
    });

    res.status(201).json({ message: 'Password reset request submitted', request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/password-reset-requests/mine', ...requireRole('organizer'), async (req, res) => {
  try {
    const requests = await PasswordResetRequest.find({ organizer: req.user.id })
      .populate('reviewedBy', 'email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
