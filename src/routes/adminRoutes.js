const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const admin = require('../controllers/adminController');

router.use(auth);
router.use(admin.requireSuperAdmin);

router.get('/stats', admin.getStats);
router.get('/users', admin.listUsers);
router.get('/users/:id', admin.getUser);
router.patch('/users/:id/status', admin.updateUserStatus);
router.patch('/users/:id/features', admin.updateUserFeatures);
router.delete('/users/:id', admin.deleteUser);
router.get('/defaults', admin.getDefaults);
router.patch('/defaults', admin.setDefaults);

module.exports = router;
