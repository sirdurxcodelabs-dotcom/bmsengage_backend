const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/startupController');

router.use(auth);
router.get('/', ctrl.listStartups);
router.post('/', ctrl.createStartup);
router.patch('/:id', ctrl.updateStartup);
router.delete('/:id', ctrl.deleteStartup);

module.exports = router;
