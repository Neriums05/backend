const express = require('express');
const router = express.Router();
const ForumMessage = require('../models/ForumMessage');
const { auth } = require('../middleware/auth');

router.get('/:eventId', auth, async (req, res) => {
  try {
    const messages = await ForumMessage.find({ event: req.params.eventId }).sort('createdAt').lean();
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/:messageId/react', auth, async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji || !emoji.trim()) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await ForumMessage.findById(req.params.messageId);
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const existingReaction = message.reactions.find(
      r => r.userId.toString() === req.user.id && r.emoji === emoji
    );

    if (existingReaction) {
      message.reactions = message.reactions.filter(
        r => !(r.userId.toString() === req.user.id && r.emoji === emoji)
      );
    } else {
      message.reactions.push({
        emoji,
        userId: req.user.id,
        userName: req.user.firstName + ' ' + req.user.lastName
      });
    }

    await message.save();
    res.json(message);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
