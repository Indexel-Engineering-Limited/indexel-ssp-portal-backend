const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config/env');
const { pool } = require('../config/db');

const authenticate = async (req, res, next) => {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'A Bearer token is required',
    });
  }

  if (!JWT_SECRET) {
    return res.status(500).json({
      success: false,
      message: 'JWT_SECRET is not configured',
    });
  }

  try {
    const tokenUser = jwt.verify(token, JWT_SECRET);
    const [users] = await pool.query(
      'SELECT id, user_name, role FROM users WHERE id = ?',
      [tokenUser.id]
    );

    if (!users.length) {
      return res.status(401).json({ success: false, message: 'User account no longer exists' });
    }

    // Always use the current database role, so role changes take effect
    // immediately without waiting for an old JWT to expire.
    req.user = { ...tokenUser, ...users[0] };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.name === 'TokenExpiredError' ? 'Token has expired' : 'Invalid token',
    });
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!roles.includes(String(req.user?.role || '').toUpperCase())) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action' });
  }
  return next();
};

module.exports = { authenticate, authorizeRoles };
