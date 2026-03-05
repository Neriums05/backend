// Feedback routes: submit anonymous feedback, view aggregated feedback

const router = require('express').Router();
const Feedback = require('../models/Feedback');
const Registration = require('../models/Registration');
const { auth, requireRole } = require('../middleware/auth');

// -------------------------------------------------------
// POST /api/feedback/:eventId
// Participant: submit anonymous feedback for an event
// Only allowed if they actually attended the event
// -------------------------------------------------------
router.post('/:eventId', auth, async (req, res) => {
  try {
    // Check they attended the event (status must be 'attended')
    const attendance = await Registration.findOne({
      event: req.params.eventId,
      participant: req.user.id,
      attended: true
    });

    if (!attendance) {
      return res.status(403).json({ message: 'You can only leave feedback for events you attended' });
    }

    const { rating, comment } = req.body;

    // Note: we do NOT store req.user.id here - that's what makes it anonymous
    const feedback = await Feedback.create({
      event: req.params.eventId,
      rating,
      comment
    });

    res.status(201).json({ message: 'Feedback submitted anonymously!' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// GET /api/feedback/:eventId
// Organizer: view all feedback for their event
// Returns individual comments + average rating
// -------------------------------------------------------
router.get('/:eventId', ...requireRole('organizer'), async (req, res) => {
  const feedbackList = await Feedback.find({ event: req.params.eventId }).sort({ createdAt: -1 });

  // Calculate average rating
  const average = feedbackList.length
    ? feedbackList.reduce((sum, f) => sum + f.rating, 0) / feedbackList.length
    : 0;

  res.json({
    feedbackList,
    averageRating: average.toFixed(1),
    total: feedbackList.length
  });
});

module.exports = router;
