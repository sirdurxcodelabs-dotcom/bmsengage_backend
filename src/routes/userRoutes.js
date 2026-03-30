const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');

router.use(auth);

// GET /api/users — list all users except self (for share picker)
router.get('/', async (req, res) => {
  try {
    const users = await User.find({ _id: { $ne: req.user._id } })
      .select('name email roles')
      .sort({ name: 1 });
    res.json({ users: users.map(u => ({ id: u._id, name: u.name, email: u.email, roles: u.roles })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
