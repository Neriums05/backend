// Anonymous feedback for events.
// We intentionally do NOT store the participant's ID - that's what makes it anonymous.

const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  event:   { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  // No participant field - anonymous by design
  rating:  { type: Number, min: 1, max: 5, required: true },
  comment: String
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
