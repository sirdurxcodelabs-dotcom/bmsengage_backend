const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/campaignEventController');

const EXECUTIVE_ROLES = ['owner', 'ceo', 'coo', 'creative_director', 'head_of_production'];

// Middleware: only executive roles (or agency owner) can mutate campaigns
const requireExecutive = (req, res, next) => {
  const role = req.user?.agencyRole;
  if (!role || !EXECUTIVE_ROLES.includes(role)) {
    return res.status(403).json({ error: 'Only executive roles can create or modify campaigns.' });
  }
  next();
};

router.use(auth);
router.get('/', ctrl.list);       // all agency members can view
router.get('/:id', ctrl.getOne);  // all agency members can view
router.post('/', requireExecutive, ctrl.create);
router.patch('/:id', requireExecutive, ctrl.update);
router.delete('/:id', requireExecutive, ctrl.remove);

module.exports = router;
