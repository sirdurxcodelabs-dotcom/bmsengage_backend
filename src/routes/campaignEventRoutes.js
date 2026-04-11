const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/campaignEventController');

const EXECUTIVE_ROLES = ['owner', 'ceo', 'coo', 'creative_director', 'head_of_production'];

// Middleware: only executive roles (or agency owner) can mutate campaigns
// Checks agencyRole first (agency context), then falls back to user's own roles (personal context)
const requireExecutive = (req, res, next) => {
  const agencyRole = req.user?.agencyRole;
  const personalRoles = req.user?.roles ?? [];

  const hasAccess =
    (agencyRole && EXECUTIVE_ROLES.includes(agencyRole)) ||
    personalRoles.some(r => EXECUTIVE_ROLES.includes(r));

  if (!hasAccess) {
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
