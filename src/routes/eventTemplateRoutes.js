const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ctrl = require('../controllers/eventTemplateController');

const EXECUTIVE_ROLES = ['owner', 'ceo', 'coo', 'creative_director', 'head_of_production'];

const requireExecutive = (req, res, next) => {
  const role = req.user?.agencyRole;
  if (!role || !EXECUTIVE_ROLES.includes(role)) {
    return res.status(403).json({ error: 'Only executive roles can manage templates.' });
  }
  next();
};

router.use(auth);
router.get('/', ctrl.list);
router.post('/', requireExecutive, ctrl.create);
router.patch('/:id', requireExecutive, ctrl.update);
router.delete('/:id', requireExecutive, ctrl.remove);

module.exports = router;
