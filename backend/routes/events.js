// Event routes: browse, view, create, update, attendance tracking

const router = require('express').Router();
const Event = require('../models/Event');
const { auth, requireRole } = require('../middleware/auth');

// -------------------------------------------------------
// GET /api/events
// Browse all published events with optional search/filters
// -------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { search, type, dateFrom, dateTo } = req.query;

    // Start with only visible events
    let query = { status: { $in: ['published', 'ongoing', 'completed'] } };

    // Search by name or tags (case-insensitive)
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    if (type) query.eventType = type;

    // Date range filter
    if (dateFrom || dateTo) {
      query.startDate = {};
      if (dateFrom) query.startDate.$gte = new Date(dateFrom);
      if (dateTo)   query.startDate.$lte = new Date(dateTo);
    }

    const events = await Event.find(query)
      .populate('organizer', 'organizerName category') // include organizer name
      .sort({ createdAt: -1 });

    res.json(events);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// GET /api/events/trending
// Top 5 events by views in the last 24 hours
// -------------------------------------------------------
router.get('/trending', async (req, res) => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const events = await Event.find({
    status: 'published',
    viewsDate: { $gte: yesterday }
  })
    .sort({ viewsToday: -1 })
    .limit(5)
    .populate('organizer', 'organizerName');

  res.json(events);
});

// -------------------------------------------------------
// GET /api/events/mine/all
// Organizer: get all their own events (all statuses)
// -------------------------------------------------------
router.get('/mine/all', ...requireRole('organizer'), async (req, res) => {
  const events = await Event.find({ organizer: req.user.id }).sort({ createdAt: -1 });
  res.json(events);
});

// -------------------------------------------------------
// GET /api/events/by-organizer/:organizerId
// Public: get all published events by a specific organizer
// -------------------------------------------------------
router.get('/by-organizer/:organizerId', async (req, res) => {
  const events = await Event.find({
    organizer: req.params.organizerId,
    status: { $in: ['published', 'ongoing', 'completed'] }
  });
  res.json(events);
});

// -------------------------------------------------------
// GET /api/events/:id
// Get a single event and increment its view count
// -------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate('organizer', 'organizerName category contactEmail description');

    if (!event) return res.status(404).json({ message: 'Event not found' });

    // Update view counts
    // If today is a new day, reset viewsToday to 1
    // Otherwise, just add 1 to viewsToday
    const todayStr = new Date().toDateString();
    const isNewDay = !event.viewsDate || event.viewsDate.toDateString() !== todayStr;

    await Event.findByIdAndUpdate(req.params.id, {
      $inc: { viewCount: 1 },
      ...(isNewDay
        ? { $set: { viewsToday: 1, viewsDate: new Date() } }
        : { $inc: { viewsToday: 1 } })
    });

    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// POST /api/events
// Organizer: create a new event (starts as draft)
// -------------------------------------------------------
router.post('/', ...requireRole('organizer'), async (req, res) => {
  try {
    const event = await Event.create({
      ...req.body,
      organizer: req.user.id, // always set to the logged-in organizer
      status: req.body.status || 'draft'
    });
    res.status(201).json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// PUT /api/events/:id
// Organizer: update event (rules depend on current status)
// -------------------------------------------------------
router.put('/:id', ...requireRole('organizer'), async (req, res) => {
  try {
    // Make sure this organizer owns the event
    const event = await Event.findOne({ _id: req.params.id, organizer: req.user.id });
    if (!event) return res.status(404).json({ message: 'Event not found' });

    if (event.status === 'draft') {
      // Draft: can change anything
      Object.assign(event, req.body);

    } else if (event.status === 'published') {
      // Published: only limited fields can be changed
      const { description, registrationDeadline, registrationLimit, status } = req.body;
      if (description) event.description = description;
      if (registrationDeadline) event.registrationDeadline = registrationDeadline;
      // Can only increase the limit, not decrease
      if (registrationLimit && registrationLimit > event.registrationLimit) {
        event.registrationLimit = registrationLimit;
      }
      if (status === 'ongoing' || status === 'closed') event.status = status;

    } else {
      // Ongoing/Completed: can only change status
      if (req.body.status) event.status = req.body.status;
    }

    await event.save();
    res.json(event);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// POST /api/events/:id/attend
// Organizer: mark a ticket as attended (QR scan feature)
// -------------------------------------------------------
router.post('/:id/attend', ...requireRole('organizer'), async (req, res) => {
  try {
    const Registration = require('../models/Registration');
    const { ticketId } = req.body;

    const reg = await Registration.findOne({ ticketId })
      .populate('participant', 'firstName lastName email');

    if (!reg) return res.status(404).json({ message: 'Ticket not found' });
    if (reg.attended) {
      return res.status(400).json({ message: 'This ticket was already scanned', participant: reg.participant });
    }

    reg.attended = true;
    reg.attendedAt = new Date();
    reg.status = 'attended';
    await reg.save();

    res.json({ message: 'Attendance marked!', participant: reg.participant });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// -------------------------------------------------------
// GET /api/events/:id/attendance
// Organizer: get full attendance list for an event
// -------------------------------------------------------
router.get('/:id/attendance', ...requireRole('organizer'), async (req, res) => {
  const Registration = require('../models/Registration');
  const regs = await Registration.find({ event: req.params.id })
    .populate('participant', 'firstName lastName email');
  res.json(regs);
});

module.exports = router;
