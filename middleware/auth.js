// This file contains middleware functions for authentication and authorization.
// Middleware runs BEFORE the actual route handler - it checks if the user is allowed in.

const jwt = require('jsonwebtoken');

// --- auth middleware ---
// Checks if the request has a valid JWT token.
// If valid, it attaches the user info (id, role, email) to req.user
// so route handlers can use it.
function auth(req, res, next) {
  // The token comes in the Authorization header as: "Bearer <token>"
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }

  try {
    // Verify the token using our secret key
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next(); // token is valid, continue to the route handler
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// --- requireRole middleware factory ---
// Creates a middleware that only allows users with specific roles.
// Usage: router.get('/admin-only', ...requireRole('admin'), handler)
// The spread (...) is needed because this returns an array of two middleware functions.
function requireRole(...roles) {
  return [
    auth, // first check if logged in
    (req, res, next) => {
      if (!roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Access denied' });
      }
      next();
    }
  ];
}

module.exports = { auth, requireRole };
