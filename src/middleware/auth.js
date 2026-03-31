const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    // Accept token from Authorization header OR ?token= query param (used for OAuth redirects)
    const headerToken = req.header('Authorization')?.replace('Bearer ', '');
    const token = headerToken || req.query.token;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * requirePermission(permission)
 *
 * In PERSONAL context: uses the user's own roles (existing behaviour).
 * In AGENCY context:
 *   - Agency owner (executive role OR is the inviter) → can do EVERYTHING
 *   - Agency member → uses their assigned agencyRole from TeamInvite
 */
const requirePermission = (permission) => async (req, res, next) => {
  const { hasPermission } = require('../models/User');
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  if (req.user.activeContext === 'agency') {
    try {
      const { resolveAgencyOwnerId, getAgencyRole } = require('../utils/agencyHelper');
      const agencyOwnerId = await resolveAgencyOwnerId(req.user);

      if (!agencyOwnerId) {
        return res.status(403).json({ error: 'Not part of any agency' });
      }

      const agencyRole = await getAgencyRole(req.user, agencyOwnerId);

      // Owner can do everything
      if (agencyRole === 'owner') return next();

      // Member: check permission using their assigned agency role
      if (hasPermission([agencyRole], permission)) return next();

      return res.status(403).json({ error: `Forbidden: your agency role '${agencyRole}' cannot '${permission}'` });
    } catch (err) {
      return next(err);
    }
  }

  // Personal context: use own roles
  if (!hasPermission(req.user.roles, permission)) {
    return res.status(403).json({ error: `Forbidden: requires '${permission}' permission` });
  }
  next();
};

module.exports = { auth, protect: auth, requirePermission };
