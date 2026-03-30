const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const emailService = require('../services/emailService');
const { createNotification } = require('./notificationController');

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

const generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

exports.signup = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Validate role — must be one of the allowed ROLES
    const { ROLES } = require('../models/User');
    const assignedRole = role && ROLES.includes(role) ? role : 'graphic_designer';

    const verificationToken = generateRandomToken();
    const user = new User({
      name,
      email,
      password,
      roles: [assignedRole],
      verificationToken,
      verificationTokenExpires: Date.now() + 180000,
    });
    await user.save();

    const token = generateToken(user._id);

    try {
      await emailService.sendVerificationEmail(email, name, verificationToken);
      console.log(`✓ Verification email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
    }

    res.status(201).json({
      message: 'User created successfully. Please check your email to verify your account.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        verified: user.verified,
        roles: user.roles,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, twoFACode } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // If 2FA is enabled, require code before issuing token
    if (user.twoFA?.enabled) {
      if (!twoFACode) {
        // Signal frontend to show 2FA challenge
        return res.status(200).json({ requires2FA: true, method: user.twoFA.method });
      }

      // Verify the code
      if (user.twoFA.method === 'app') {
        const speakeasy = require('speakeasy');
        const verified = speakeasy.totp.verify({
          secret: user.twoFA.secret,
          encoding: 'base32',
          token: twoFACode,
          window: 1,
        });
        if (!verified) return res.status(401).json({ error: 'Invalid authenticator code' });
      } else if (user.twoFA.method === 'sms') {
        if (user.twoFA.secret !== twoFACode) {
          return res.status(401).json({ error: 'Invalid SMS code' });
        }
      }
    }

    const token = generateToken(user._id);

    // Record login history
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const ua = req.headers['user-agent'] || 'unknown';
    user.loginHistory = user.loginHistory || [];
    user.loginHistory.push({ ip, userAgent: ua, device: ua.substring(0, 80), loginAt: new Date() });
    if (user.loginHistory.length > 20) user.loginHistory = user.loginHistory.slice(-20);
    await user.save();

    // Create login notification (only if accountSecurity pref is on)
    if (user.notificationPrefs?.accountSecurity === true) {
      try {
        await createNotification(
          user._id, 'login', 'New Login Detected',
          `You logged in from ${ua.substring(0, 60)}`,
          { device: ua, ip, time: new Date().toLocaleString() },
          true
        );
      } catch (notifError) {
        console.error('Failed to create login notification:', notifError);
      }
    }

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        avatar: user.avatar,
        notificationPrefs: user.notificationPrefs,
        activeContext: user.activeContext,
        twoFA: { enabled: user.twoFA?.enabled, method: user.twoFA?.method },
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      verified: req.user.verified,
      roles: req.user.roles,
      avatar: req.user.avatar,
      notificationPrefs: req.user.notificationPrefs,
      activeContext: req.user.activeContext,
    }
  });
};

exports.logout = async (req, res) => {
  try {
    // In a production app, you'd add the token to a blacklist here
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists for security
      return res.json({ message: 'If that email exists, a reset link has been sent' });
    }

    const resetToken = generateRandomToken();
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send password reset email
    try {
      await emailService.sendPasswordResetEmail(email, user.name, resetToken);
      console.log(`✓ Password reset email sent to ${email}`);
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      return res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
    }

    res.json({ 
      message: 'If that email exists, a reset link has been sent'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ 
        error: 'Invalid or expired verification token',
        expired: true 
      });
    }

    user.verified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    // Send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.name);
      console.log(`✓ Welcome email sent to ${user.email}`);
    } catch (emailError) {
      console.error('Failed to send welcome email:', emailError);
    }

    // Create welcome notification
    try {
      await createNotification(
        user._id,
        'system',
        'Welcome to BMS Engage! 🎉',
        'Your account has been verified. Start by connecting your social accounts and creating your first post!',
        {},
        false
      );
    } catch (notifError) {
      console.error('Failed to create welcome notification:', notifError);
    }

    res.json({ 
      message: 'Email verified successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        verified: user.verified,
        roles: user.roles,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/auth/2fa/send-sms — send SMS code for login 2FA challenge
exports.send2FALoginSMS = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ email });
    if (!user || !user.twoFA?.enabled || user.twoFA.method !== 'sms') {
      return res.status(400).json({ error: 'SMS 2FA not configured for this account' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFA.secret = code;
    user.markModified('twoFA');
    await user.save();

    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    await client.messages.create({
      from: process.env.TWILIO_PHONE_FROM || process.env.TWILIO_WHATSAPP_FROM?.replace('whatsapp:', ''),
      to: user.twoFA.phone,
      body: `Your BMS Engage login code: ${code}`,
    });

    res.json({ message: 'SMS sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ message: 'If that email exists, a verification link has been sent' });
    }

    if (user.verified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    const verificationToken = generateRandomToken();
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = Date.now() + 180000; // 3 minutes
    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, user.name, verificationToken);
      console.log(`✓ Verification email resent to ${email}`);
    } catch (emailError) {
      console.error('Failed to resend verification email:', emailError);
      return res.status(500).json({ error: 'Failed to send verification email. Please try again.' });
    }

    res.json({ 
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
