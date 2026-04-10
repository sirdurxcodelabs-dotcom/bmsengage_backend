const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/campaignEventController');

router.use(auth);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
router.post('/', ctrl.create);
router.patch('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
