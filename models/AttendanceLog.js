const mongoose = require('mongoose');

const attendanceLogSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  registration: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Registration',
    required: true
  },
  participant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    enum: ['mark_attended', 'unmark_attended', 'manual_override'],
    required: true
  },
  method: {
    type: String,
    enum: ['scan', 'manual'],
    required: true
  },
  reason: {
    type: String
  },
  previousAttendanceStatus: {
    type: Boolean
  }
}, { timestamps: true });

module.exports = mongoose.model('AttendanceLog', attendanceLogSchema);
