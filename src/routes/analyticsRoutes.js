const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/post/:id', auth, analyticsController.getPostAnalytics);
router.get('/dashboard', auth, analyticsController.getDashboardStats);

module.exports = router;
