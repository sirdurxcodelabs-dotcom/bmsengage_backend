const axios = require('axios');
const { withRetry } = require('../utils/apiRetry');

const BASE = 'https://graph.facebook.com/v19.0';

/**
 * Exchange authorization code for a long-lived user access token.
 */
const exchangeCodeForToken = async (code) => {
  const res = await withRetry(() => axios.get(`${BASE}/oauth/access_token`, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    },
  }));
  return res.data; // { access_token, token_type, expires_in }
};

/**
 * Exchange a short-lived token for a long-lived one (60 days).
 */
const getLongLivedToken = async (shortToken) => {
  const res = await withRetry(() => axios.get(`${BASE}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  }));
  return res.data; // { access_token, token_type, expires_in }
};

/**
 * Fetch the authenticated user's profile.
 */
const getUserProfile = async (accessToken) => {
  const res = await withRetry(() => axios.get(`${BASE}/me`, {
    params: { fields: 'id,name,picture', access_token: accessToken },
  }));
  return res.data;
};

/**
 * Fetch pages managed by the user.
 */
const getUserPages = async (accessToken) => {
  const res = await withRetry(() => axios.get(`${BASE}/me/accounts`, {
    params: { access_token: accessToken },
  }));
  return res.data.data || [];
};

/**
 * Publish a text/photo post to a Facebook Page.
 */
const publishToPage = async (pageId, pageAccessToken, content, mediaUrl = null) => {
  const endpoint = mediaUrl ? `${BASE}/${pageId}/photos` : `${BASE}/${pageId}/feed`;
  const params = mediaUrl
    ? { message: content, url: mediaUrl, access_token: pageAccessToken }
    : { message: content, access_token: pageAccessToken };

  const res = await withRetry(() => axios.post(endpoint, null, { params }));
  return res.data; // { id } or { post_id }
};

/**
 * Refresh a long-lived token (re-exchange before expiry).
 */
const refreshToken = async (currentToken) => {
  return getLongLivedToken(currentToken);
};

module.exports = {
  exchangeCodeForToken,
  getLongLivedToken,
  getUserProfile,
  getUserPages,
  publishToPage,
  refreshToken,
};
