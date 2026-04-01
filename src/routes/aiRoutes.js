const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { generateCaption } = require('../controllers/aiController');

router.post('/caption', auth, generateCaption);

module.exports = router;
