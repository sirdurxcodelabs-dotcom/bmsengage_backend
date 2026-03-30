const express = require('express');
const socialController = require('../controllers/socialController');
const { auth } = require('../middleware/auth');

const router = express.Router();

router.get('/accounts', auth, socialController.getConnectedAccounts);
router.delete('/accounts/:id', auth, socialController.disconnectAccount);

module.exports = router;
