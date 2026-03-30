const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], authController.signup);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], authController.login);

router.get('/profile', auth, authController.getProfile);

router.post('/logout', auth, authController.logout);

router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], authController.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 })
], authController.resetPassword);

router.post('/verify-email', [
  body('token').notEmpty()
], authController.verifyEmail);

router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail()
], authController.resendVerification);

router.post('/2fa/send-sms', authController.send2FALoginSMS);

module.exports = router;
