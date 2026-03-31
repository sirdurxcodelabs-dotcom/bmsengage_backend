const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/socialController');
const { auth } = require('../middleware/auth');

// ── OAuth initiation — requires logged-in user ────────────────────────────────
router.get('/auth/meta',      auth, ctrl.connectMeta);
router.get('/auth/twitter',   auth, ctrl.connectTwitter);
router.get('/auth/linkedin',  auth, ctrl.connectLinkedIn);
router.get('/auth/tiktok',    auth, ctrl.connectTikTok);

// ── OAuth callbacks — no auth middleware (browser redirect, no token in header)
// State param is used to tie the callback back to the authenticated user.
router.get('/callback/meta',      ctrl.metaCallback);
router.get('/callback/twitter',   ctrl.twitterCallback);
router.get('/callback/linkedin',  ctrl.linkedinCallback);
router.get('/callback/tiktok',    ctrl.tiktokCallback);

// ── Account management ────────────────────────────────────────────────────────
router.get('/accounts',                    auth, ctrl.getConnectedAccounts);
router.delete('/accounts/:id',             auth, ctrl.disconnectAccount);
router.post('/accounts/:id/refresh-token', auth, ctrl.refreshAccountToken);

module.exports = router;
