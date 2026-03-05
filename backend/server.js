// This is the starting point of the backend.
// It sets up Express, connects to MongoDB, and registers all routes.

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // loads variables from .env file

const app = express();

// Allow requests from the frontend
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));

// Parse incoming JSON request bodies
app.use(express.json());

// Serve uploaded files (payment proofs) as static files
app.use('/uploads', express.static('uploads'));

// Register all route files
// Each file handles a specific part of the API
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/events',        require('./routes/events'));
app.use('/api/registrations', require('./routes/registrations'));
app.use('/api/organizers',    require('./routes/organizers'));
app.use('/api/admin',         require('./routes/admin'));
app.use('/api/feedback',      require('./routes/feedback'));

// Connect to MongoDB, then start the server
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    // Create the admin account if it doesn't exist yet
    await require('./utils/seedAdmin')();

    // Start listening for requests
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log('Server running on port ' + PORT));
  })
  .catch(err => console.error('MongoDB connection error:', err));
