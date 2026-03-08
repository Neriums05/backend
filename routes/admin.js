const router = require('express').Router();
const User = require('../models/User');
const Event = require('../models/Event');
const Registration = require('../models/Registration');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const bcrypt = require('bcryptjs');
const { requireRole } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');

function buildOrganizerLoginEmail(organizerName) {
  return organizerName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '') + '@felicity.org';
}

function generatePassword(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8);
}

router.post('/organizer', ...requireRole('admin'), async (req, res) => {
  try {
    const { organizerName, category, description, contactEmail } = req.body;

    if (!organizerName || !organizerName.trim()) {
      return res.status(400).json({ message: 'Organizer name is required' });
    }
    if (!category || !category.trim()) return res.status(400).json({ message: 'Category is required' });
    if (!contactEmail || !contactEmail.trim()) return res.status(400).json({ message: 'Contact email is required' });

    const loginEmail = buildOrganizerLoginEmail(organizerName);

    const existing = await User.findOne({ email: loginEmail });
    if (existing) {
      return res.status(400).json({ message: 'An organizer with this name already exists (email conflict: ' + loginEmail + ')' });
    }

    const rawPassword = generatePassword('Pass@');
    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    const user = await User.create({
      email: loginEmail, password: hashedPassword, role: 'organizer',
      organizerName, category, description, contactEmail
    });

    res.status(201).json({ message: 'Organizer created', loginEmail, password: rawPassword, id: user._id });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'An organizer with that login email already exists' });
    }
    res.status(500).json({ message: err.message });
  }
});

router.get('/organizers', ...requireRole('admin'), async (req, res) => {
  try {
    const organizers = await User.find({ role: 'organizer' }).select('-password').lean();
    res.json(organizers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/organizer/:id', ...requireRole('admin'), async (req, res) => {
  try {
    const organizer = await User.findById(req.params.id);
    if (!organizer || organizer.role !== 'organizer') {
      return res.status(404).json({ message: 'Organizer not found' });
    }

    const events = await Event.find({ organizer: req.params.id }).lean();
    const eventIds = events.map(e => e._id);

    if (eventIds.length > 0) {
      await Registration.deleteMany({ event: { $in: eventIds } });
      await Event.deleteMany({ organizer: req.params.id });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'Organizer and all their events removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/password-reset-requests', ...requireRole('admin'), async (req, res) => {
  try {
    const requests = await PasswordResetRequest.find()
      .populate('organizer', 'organizerName email contactEmail')
      .populate('reviewedBy', 'email')
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/password-reset-requests/:id/review', ...requireRole('admin'), async (req, res) => {
  try {
    const { action, adminComment } = req.body;
    
    if (!['approve', 'reject'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const request = await PasswordResetRequest.findById(req.params.id)
      .populate('organizer', 'email organizerName contactEmail');
    
    if (!request) {
      return res.status(404).json({ message: 'Reset request not found' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'This request has already been reviewed' });
    }

    request.status = action === 'approve' ? 'approved' : 'rejected';
    request.adminComment = adminComment || '';
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    if (action === 'approve') {
      const newPassword = generatePassword('Pass@');
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await User.findByIdAndUpdate(request.organizer._id, { password: hashedPassword });

      try {
        await sendEmail(
          request.organizer.contactEmail || request.organizer.email,
          'Password Reset - Felicity',
          `Hello ${request.organizer.organizerName},\n\nYour password reset request has been approved.\n\nNew Password: ${newPassword}\n\nPlease login with your email: ${request.organizer.email}\n\nBest regards,\nFelicity Team`
        );
      } catch (emailErr) {
        console.error('Failed to send password reset email:', emailErr);
      }

      res.json({ message: 'Request approved and new password sent to organizer', newPassword });
    } else {
      res.json({ message: 'Request rejected' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
