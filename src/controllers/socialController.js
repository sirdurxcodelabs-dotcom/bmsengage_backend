const crypto = require('crypto');
const SocialAccount = require('../models/SocialAccount');
const { encrypt, decrypt } = require('../utils/tokenCrypto');
const meta = require('../integrations/meta');
const twitter = require('../integrations/twitter');
const linkedin = require('../integrations/linkedin');
const tiktok = require('../integrations/tiktok');

// ── helpers ──────────────────────────────────────────────────────────────────

/** Generate a random state token for OAuth CSRF protection */
const randomState = () => crypto.randomBytes(16).toString('hex');

/** Store OAuth state + PKCE verifier in a short-lived in-memory map (per process).
 *  In production with multiple instances, use Redis instead. */
const oauthStateStore = new Map();
const storeState = (state, data) => {
  oauthStateStore.set(state, { ...data, createdAt: Date.now() });
  // Auto-expire after 10 minutes
  setTimeout(() => oauthStateStore.delete(state), 10 * 60 * 1000);
};
const consumeState = (state) => {
  const data = oauthStateStore.get(state);
  oauthStateStore.delete(state);
  return data;
};

/** Compute token expiry Date from seconds-until-expiry */
const expiryDate = (expiresIn) =>
  expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;

/** Upsert a SocialAccount record with encrypted tokens */
const upsertAccount = async (userId, platform, fields) => {
  return SocialAccount.findOneAndUpdate(
    { userId, platform, accountId: fields.accountId },
    {
      $set: {
        ...fields,
        userId,
        platform,
        isActive: true,
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );
};

/** Format account for API response — strip encrypted tokens */
const formatAccount = (doc) => ({
  id: doc._id.toString(),
  platform: doc.platform,
  accountId: doc.accountId,
  username: doc.username,
  displayName: doc.displayName,
  avatar: doc.avatar,
  tokenExpiry: doc.tokenExpiry,
  isActive: doc.isActive,
  meta: doc.meta?.pageId ? { pageId: doc.meta.pageId, pageName: doc.meta.pageName } : undefined,
  tiktok: doc.tiktok?.openId ? { openId: doc.tiktok.openId } : undefined,
  createdAt: doc.createdAt,
});

// ── Meta / Facebook ───────────────────────────────────────────────────────────

exports.connectMeta = (req, res) => {
  const state = randomState();
  storeState(state, { userId: req.user._id.toString() });

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    state,
    scope: 'pages_manage_posts,pages_read_engagement,pages_show_list,public_profile',
    response_type: 'code',
  });
  res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
};

exports.metaCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=meta_denied`);

    const stored = consumeState(state);
    if (!stored) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=invalid_state`);

    // Exchange code → short-lived token → long-lived token
    const shortData = await meta.exchangeCodeForToken(code);
    const longData = await meta.getLongLivedToken(shortData.access_token);
    const accessToken = longData.access_token;

    // Fetch user profile
    const profile = await meta.getUserProfile(accessToken);

    // Fetch pages
    const pages = await meta.getUserPages(accessToken);
    const primaryPage = pages[0] || null;

    await upsertAccount(stored.userId, 'meta', {
      accountId: profile.id,
      username: profile.name,
      displayName: profile.name,
      avatar: profile.picture?.data?.url || '',
      accessToken: encrypt(accessToken),
      refreshToken: null,
      tokenExpiry: expiryDate(longData.expires_in),
      meta: primaryPage
        ? {
            pageId: primaryPage.id,
            pageName: primaryPage.name,
            pageAccessToken: encrypt(primaryPage.access_token),
          }
        : {},
    });

    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?connected=meta`);
  } catch (err) {
    console.error('[Meta callback]', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=meta_failed`);
  }
};

// ── Twitter / X ───────────────────────────────────────────────────────────────

exports.connectTwitter = (req, res) => {
  const state = randomState();
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  storeState(state, { userId: req.user._id.toString(), codeVerifier });
  res.redirect(twitter.getAuthUrl(state, codeVerifier));
};

exports.twitterCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=twitter_denied`);

    const stored = consumeState(state);
    if (!stored) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=invalid_state`);

    const tokenData = await twitter.exchangeCodeForToken(code, stored.codeVerifier);
    const profile = await twitter.getUserProfile(tokenData.access_token);

    await upsertAccount(stored.userId, 'twitter', {
      accountId: profile.id,
      username: profile.username,
      displayName: profile.name,
      avatar: profile.profile_image_url || '',
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      tokenExpiry: expiryDate(tokenData.expires_in),
    });

    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?connected=twitter`);
  } catch (err) {
    console.error('[Twitter callback]', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=twitter_failed`);
  }
};

// ── LinkedIn ──────────────────────────────────────────────────────────────────

exports.connectLinkedIn = (req, res) => {
  const state = randomState();
  storeState(state, { userId: req.user._id.toString() });
  res.redirect(linkedin.getAuthUrl(state));
};

exports.linkedinCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=linkedin_denied`);

    const stored = consumeState(state);
    if (!stored) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=invalid_state`);

    const tokenData = await linkedin.exchangeCodeForToken(code);
    const profile = await linkedin.getUserProfile(tokenData.access_token);

    await upsertAccount(stored.userId, 'linkedin', {
      accountId: profile.sub,
      username: profile.email || profile.sub,
      displayName: profile.name,
      avatar: profile.picture || '',
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      tokenExpiry: expiryDate(tokenData.expires_in),
    });

    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?connected=linkedin`);
  } catch (err) {
    console.error('[LinkedIn callback]', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=linkedin_failed`);
  }
};

// ── TikTok ────────────────────────────────────────────────────────────────────

exports.connectTikTok = (req, res) => {
  const state = randomState();
  const codeVerifier = crypto.randomBytes(32).toString('hex');
  storeState(state, { userId: req.user._id.toString(), codeVerifier });
  res.redirect(tiktok.getAuthUrl(state, codeVerifier));
};

exports.tiktokCallback = async (req, res) => {
  try {
    const { code, state, error } = req.query;
    if (error) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=tiktok_denied`);

    const stored = consumeState(state);
    if (!stored) return res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=invalid_state`);

    const tokenData = await tiktok.exchangeCodeForToken(code, stored.codeVerifier);
    const userInfo = await tiktok.getUserInfo(tokenData.access_token);

    await upsertAccount(stored.userId, 'tiktok', {
      accountId: tokenData.open_id,
      username: userInfo?.display_name || tokenData.open_id,
      displayName: userInfo?.display_name || '',
      avatar: userInfo?.avatar_url || '',
      accessToken: encrypt(tokenData.access_token),
      refreshToken: tokenData.refresh_token ? encrypt(tokenData.refresh_token) : null,
      tokenExpiry: expiryDate(tokenData.expires_in),
      tiktok: { openId: tokenData.open_id, scope: tokenData.scope },
    });

    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?connected=tiktok`);
  } catch (err) {
    console.error('[TikTok callback]', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/social-accounts?error=tiktok_failed`);
  }
};

// ── Shared account management ─────────────────────────────────────────────────

exports.getConnectedAccounts = async (req, res) => {
  try {
    const accounts = await SocialAccount.find({ userId: req.user._id, isActive: true })
      .select('-accessToken -refreshToken -meta.pageAccessToken');
    res.json({ accounts: accounts.map(formatAccount) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.disconnectAccount = async (req, res) => {
  try {
    const account = await SocialAccount.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isActive: false },
      { new: true }
    );
    if (!account) return res.status(404).json({ error: 'Account not found' });
    res.json({ message: 'Account disconnected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Manually trigger a token refresh for a connected account.
 * Called automatically by the post publisher when a 401 is encountered.
 */
exports.refreshAccountToken = async (req, res) => {
  try {
    const account = await SocialAccount.findOne({ _id: req.params.id, userId: req.user._id, isActive: true });
    if (!account) return res.status(404).json({ error: 'Account not found' });

    const decryptedRefresh = decrypt(account.refreshToken);
    if (!decryptedRefresh) return res.status(400).json({ error: 'No refresh token available' });

    let newTokenData;
    switch (account.platform) {
      case 'meta':
        newTokenData = await meta.refreshToken(decrypt(account.accessToken));
        break;
      case 'twitter':
        newTokenData = await twitter.refreshAccessToken(decryptedRefresh);
        break;
      case 'linkedin':
        newTokenData = await linkedin.refreshAccessToken(decryptedRefresh);
        break;
      case 'tiktok':
        newTokenData = await tiktok.refreshAccessToken(decryptedRefresh);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported platform' });
    }

    account.accessToken = encrypt(newTokenData.access_token);
    if (newTokenData.refresh_token) account.refreshToken = encrypt(newTokenData.refresh_token);
    account.tokenExpiry = expiryDate(newTokenData.expires_in);
    await account.save();

    res.json({ message: 'Token refreshed', tokenExpiry: account.tokenExpiry });
  } catch (err) {
    console.error('[refreshAccountToken]', err.message);
    res.status(500).json({ error: err.message });
  }
};
