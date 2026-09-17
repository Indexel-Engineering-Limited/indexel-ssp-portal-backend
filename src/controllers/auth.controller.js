const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db');
const { JWT_SECRET, JWT_EXPIRES_IN } = require('../config/env');
const { recordUserLog } = require('../utils/userLogger');
const { getUserPermissions } = require('../middlewares/permission.middleware');
const crypto = require("crypto");
const { sendPasswordResetEmail } = require("../utils/mailer");
const toPublicUser = (user) => ({
  id: user.id,
  user_name: user.user_name,
  name: user.name,
  email_id: user.email_id,
  role: user.role,
  created_at: user.created_at,
  updated_at: user.updated_at,
});

const createToken = (user) => {
  if (!JWT_SECRET) {
    const error = new Error('JWT_SECRET is not configured');
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(
    { id: user.id, user_name: user.user_name, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
};

const register = async (req, res, next) => {
  try {
    const { user_name, name, email_id, password } = req.body;

    if (![user_name, name, email_id, password].every((value) => typeof value === 'string' && value.trim())) {
      return res.status(400).json({
        success: false,
        message: 'user_name, name, email_id, and password are required',
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }

    const normalizedUserName = user_name.trim();
    const normalizedName = name.trim();
    const normalizedEmail = email_id.trim().toLowerCase();
    // Role changes are deliberately limited to the administrator-only endpoint.
    const normalizedRole = 'USER';
    const [existingUsers] = await pool.query(
      'SELECT id FROM users WHERE user_name = ? OR email_id = ?',
      [normalizedUserName, normalizedEmail]
    );

    if (existingUsers.length) {
      return res.status(409).json({ success: false, message: 'Username or email is already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      'INSERT INTO users (user_name, name, email_id, password, role) VALUES (?, ?, ?, ?, ?)',
      [normalizedUserName, normalizedName, normalizedEmail, passwordHash, normalizedRole]
    );
    const [users] = await pool.query(
      'SELECT id, user_name, name, email_id, role, created_at, updated_at FROM users WHERE id = ?',
      [result.insertId]
    );
    const user = users[0];

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token: createToken(user),
      data: toPublicUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { user_name, password } = req.body;

    if (
      typeof user_name !== "string" ||
      !user_name.trim() ||
      typeof password !== "string" ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "user_name and password are required"
      });
    }

    const [users] = await pool.query(
      "SELECT * FROM users WHERE user_name = ?",
      [user_name.trim()]
    );

    const user = users[0];

    const passwordMatches =
      user && await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid username or password"
      });
    }


    // ─────────────────────────────────────────────
    // GET USER PERMISSIONS
    // ─────────────────────────────────────────────

    let permissions = [];

    if (user.role === "ADMIN") {

      // Admin gets ALL modules
      const [allPerms] = await pool.query(
        `SELECT
          id,
          section_name,
          module_key,
          module_name,
          icon,
          description
        FROM permissions
        ORDER BY section_name ASC, id ASC`
      );

      permissions = allPerms.map((p) => ({
        id: p.id,
        section_name: p.section_name,
        module_key: p.module_key,
        module_name: p.module_name,
        icon: p.icon,
        description: p.description,
        can_read: true,
        can_write: true
      }));

    } else {

      // Normal user gets assigned permissions
      permissions = await getUserPermissions(user.id);
    }


    // ─────────────────────────────────────────────
    // LOGIN LOG
    // ─────────────────────────────────────────────

    await recordUserLog({
      user,
      action: "LOGIN_SUCCESS",
      method: "POST",
      endpoint: "/api/auth/login",
      statusCode: 200,
    });


    // ─────────────────────────────────────────────
    // RESPONSE
    // ─────────────────────────────────────────────

    return res.status(200).json({
      success: true,
      message: "Login successful",

      token: createToken(user),

      data: {
        ...toPublicUser(user),
        permissions
      }
    });

  } catch (error) {
    return next(error);
  }
};

const verify = async (req, res) => {
  try {
    const user = req.user;

    // Get user permissions
    let permissions = [];
    if (user.role === 'ADMIN') {
      const [allPerms] = await pool.query(
        'SELECT id, module_key, module_name, icon FROM permissions ORDER BY id ASC'
      );
      permissions = allPerms.map(p => ({
        ...p,
        can_read: true,
        can_write: true
      }));
    } else {
      permissions = await getUserPermissions(user.id);
    }

    return res.status(200).json({
      success: true,
      message: 'Token is valid',
      data: {
        ...user,
        permissions
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error fetching user permissions'
    });
  }
};

const getUsers = async (req, res, next) => {
  try {
    const [users] = await pool.query(
      'SELECT id, user_name, name, email_id, role, created_at, updated_at FROM users ORDER BY created_at DESC'
    );
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return next(error);
  }
};

const updateUserRole = async (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const role = typeof req.body.role === 'string' ? req.body.role.trim().toUpperCase() : '';
    const allowedRoles = ['ADMIN', 'USER', 'VIEWER'];

    if (!Number.isInteger(userId) || userId <= 0) {
      return res.status(400).json({ success: false, message: 'A valid user ID is required' });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be ADMIN, USER, or VIEWER' });
    }
    if (userId === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot change your own role' });
    }

    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [users] = await pool.query(
      'SELECT id, user_name, name, email_id, role, created_at, updated_at FROM users WHERE id = ?',
      [userId]
    );
    return res.status(200).json({ success: true, message: 'User role updated successfully', data: users[0] });
  } catch (error) {
    return next(error);
  }
};

const getUserLogs = async (req, res, next) => {
  try {
    const [logs] = await pool.query(
      `SELECT id, user_id, user_name, action, method, endpoint, status_code, details, created_at
       FROM user_logs
       ORDER BY created_at DESC
       LIMIT 1000`
    );
    return res.status(200).json({ success: true, data: logs });
  } catch (error) {
    return next(error);
  }
};
const changePassword = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    const { newPassword, confirmPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (
      typeof newPassword !== 'string' ||
      !newPassword ||
      typeof confirmPassword !== 'string' ||
      !confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters'
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match'
      });
    }

    // Check user exists
    const [users] = await pool.query(
      'SELECT id, user_name, name, role FROM users WHERE id = ?',
      [userId]
    );

    if (!users.length) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await pool.query(
      'UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [passwordHash, userId]
    );

    // Log password change
    await recordUserLog({
      user,
      action: 'PASSWORD_CHANGED',
      method: 'PATCH',
      endpoint: '/api/auth/change-password',
      statusCode: 200
    });

    return res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    return next(error);
  }
};
const forgotPassword = async (req, res, next) => {
  try {
    const { email_id } = req.body;

    if (
      typeof email_id !== "string" ||
      !email_id.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const email = email_id.trim().toLowerCase();

    const [users] = await pool.query(
      `
      SELECT id, user_name, name, email_id
      FROM users
      WHERE email_id = ?
      `,
      [email]
    );

    /*
     * Always return the same response whether
     * the email exists or not.
     */
    if (!users.length) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, a password reset link has been sent.",
      });
    }

    const user = users[0];

    // Remove previous unused reset tokens
    await pool.query(
      `
      DELETE FROM password_reset_tokens
      WHERE user_id = ?
      AND used_at IS NULL
      `,
      [user.id]
    );

    // Generate secure random token
    const rawToken = crypto.randomBytes(32).toString("hex");

    // Store only hash in database
    const tokenHash = crypto
      .createHash("sha256")
      .update(rawToken)
      .digest("hex");

    // 15 minutes expiry
    const expiresAt = new Date(
      Date.now() + 15 * 60 * 1000
    );

    await pool.query(
      `
      INSERT INTO password_reset_tokens
      (user_id, token_hash, expires_at)
      VALUES (?, ?, ?)
      `,
      [
        user.id,
        tokenHash,
        expiresAt,
      ]
    );

    const resetUrl =
      `${process.env.FRONTEND_URL}/reset-password/${rawToken}`;

    await sendPasswordResetEmail({
      email: user.email_id,
      name: user.name,
      resetUrl,
    });

    return res.status(200).json({
      success: true,
      message:
        "If an account exists with this email, a password reset link has been sent.",
    });

  } catch (error) {
    return next(error);
  }
};
const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Reset token is required",
      });
    }

    if (!newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password and confirm password are required",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message:
          "New password and confirm password do not match",
      });
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const [tokens] = await pool.query(
      `
      SELECT id, user_id
      FROM password_reset_tokens
      WHERE token_hash = ?
      AND used_at IS NULL
      AND expires_at > NOW()
      LIMIT 1
      `,
      [tokenHash]
    );

    if (!tokens.length) {
      return res.status(400).json({
        success: false,
        message:
          "This password reset link is invalid or has expired.",
      });
    }

    const resetToken = tokens[0];

    const passwordHash = await bcrypt.hash(
      newPassword,
      12
    );

    await pool.query(
      `
      UPDATE users
      SET password = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [
        passwordHash,
        resetToken.user_id,
      ]
    );

    // Mark token as used
    await pool.query(
      `
      UPDATE password_reset_tokens
      SET used_at = CURRENT_TIMESTAMP
      WHERE id = ?
      `,
      [resetToken.id]
    );

    return res.status(200).json({
      success: true,
      message:
        "Password reset successfully. You can now login.",
    });

  } catch (error) {
    return next(error);
  }
};

module.exports = { register, login, verify, getUsers, updateUserRole, getUserLogs,changePassword,forgotPassword,
  resetPassword };
