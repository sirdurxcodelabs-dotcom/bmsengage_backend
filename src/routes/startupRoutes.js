const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/startupController');
const { uploadStartupLogo } = require('../config/cloudinary');

router.use(auth);
router.get('/', ctrl.listStartups);
router.post('/', ctrl.createStartup);
router.patch('/:id', ctrl.updateStartup);
router.delete('/:id', ctrl.deleteStartup);
router.post('/:id/logo', uploadStartupLogo.single('logo'), ctrl.uploadLogo);

module.exports = router;
