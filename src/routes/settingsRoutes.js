const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/settingsController');
const { auth } = require('../middleware/auth');
const { upload, uploadAvatar, uploadAgencyLogo } = require('../config/cloudinary');

// Wrap multer middleware so errors return JSON instead of the global 500 handler
const handleUpload = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'File upload failed' });
    }
    next();
  });
};

router.use(auth);

router.get('/profile', ctrl.getProfile);
router.patch('/profile', ctrl.updateProfile);
router.post('/avatar', handleUpload(uploadAvatar.single('avatar')), ctrl.uploadAvatar);
router.patch('/password', ctrl.changePassword);
router.patch('/notifications', ctrl.updateNotificationPrefs);
router.post('/2fa/setup-app', ctrl.setup2FAApp);
router.post('/2fa/verify-app', ctrl.verify2FAApp);
router.post('/2fa/setup-sms', ctrl.setup2FASMS);
router.post('/2fa/verify-sms', ctrl.verify2FASMS);
router.delete('/2fa', ctrl.disable2FA);
router.patch('/agency', ctrl.updateAgency);
router.post('/agency/logo', handleUpload(uploadAgencyLogo.single('logo')), ctrl.uploadAgencyLogo);
router.patch('/context', ctrl.switchContext);

// Team invite routes
router.get('/team/search', ctrl.searchUserByEmail);
router.post('/team/invite', ctrl.sendTeamInvite);
router.get('/team/members', ctrl.getTeamMembers);
router.delete('/team/members/:inviteId', ctrl.removeTeamMember);
router.get('/team/invitations', ctrl.getMyInvitations);
router.patch('/team/invitations/:inviteId', ctrl.respondToInvitation);
router.get('/team/my-agency', ctrl.getMyAgency);
router.get('/team/agency-members', ctrl.getAgencyMembers);
router.patch('/team/members/:inviteId/role', ctrl.updateMemberRole);

module.exports = router;
