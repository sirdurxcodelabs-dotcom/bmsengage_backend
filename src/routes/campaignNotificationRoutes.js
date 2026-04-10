const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/campaignNotificationController');

router.use(auth);
router.get('/', ctrl.list);
router.patch('/read-all', ctrl.markAllRead);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);

module.exports = router;
