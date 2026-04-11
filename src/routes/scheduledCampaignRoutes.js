const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/scheduledCampaignController');

const EXECUTIVE_ROLES = ['owner', 'ceo', 'coo', 'creative_director', 'head_of_production'];

const requireExecutive = (req, res, next) => {
  const agencyRole = req.user?.agencyRole;
  const personalRoles = req.user?.roles ?? [];
  const hasAccess =
    (agencyRole && EXECUTIVE_ROLES.includes(agencyRole)) ||
    personalRoles.some(r => EXECUTIVE_ROLES.includes(r));
  if (!hasAccess) {
    return res.status(403).json({ error: 'Only executive roles can manage scheduled campaigns.' });
  }
  next();
};

router.use(auth);
router.get('/', ctrl.list);
router.post('/', requireExecutive, ctrl.create);
router.patch('/:id', requireExecutive, ctrl.update);
router.delete('/:id', requireExecutive, ctrl.remove);

module.exports = router;
