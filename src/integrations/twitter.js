const axios = require('axios');
const { withRetry } = require('../utils/apiRetry');

const BASE = 'https://api.twitter.com';

/**
 * Build the OAuth 2.0 PKCE authorization URL.
 */
const getAuthUrl = (state, codeChallenge) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID,
    redirect_uri: process.env.TWITTER_CALLBACK_URL,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'plain',
  });
  return `${BASE}/i/oauth2/authorize?${params.toString()}`;
};

/**
 * Exchange authorization code for tokens (OAuth 2.0 PKCE).
 */
const exchangeCodeForToken = async (code, codeVerifier) => {
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64');

  const res = await withRetry(() => axios.post(
    `${BASE}/2/oauth2/token`,
    new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TWITTER_CALLBACK_URL,
      code_verifier: codeVerifier,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    }
  ));
  return res.data; // { access_token, refresh_token, expires_in, scope }
};

/**
 * Refresh an expired access token.
 */
const refreshAccessToken = async (refreshToken) => {
  const credentials = Buffer.from(
    `${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`
  ).toString('base64');

  const res = await withRetry(() => axios.post(
    `${BASE}/2/oauth2/token`,
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${credentials}`,
      },
    }
  ));
  return res.data;
};

/**
 * Fetch the authenticated user's profile.
 */
const getUserProfile = async (accessToken) => {
  const res = await withRetry(() => axios.get(`${BASE}/2/users/me`, {
    params: { 'user.fields': 'id,name,username,profile_image_url' },
    headers: { Authorization: `Bearer ${accessToken}` },
  }));
  return res.data.data;
};

/**
 * Post a tweet. Optionally attach uploaded media IDs.
 */
const publishTweet = async (accessToken, text, mediaIds = []) => {
  const body = { text };
  if (mediaIds.length > 0) body.media = { media_ids: mediaIds };

  const res = await withRetry(() => axios.post(`${BASE}/2/tweets`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  }));
  return res.data.data; // { id, text }
};

/**
 * Upload media to Twitter and return the media_id.
 */
const uploadMedia = async (accessToken, mediaBuffer, mimeType) => {
  const res = await withRetry(() => axios.post(
    'https://upload.twitter.com/1.1/media/upload.json',
    new URLSearchParams({ media_data: mediaBuffer.toString('base64') }).toString(),
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  ));
  return res.data.media_id_string;
};

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getUserProfile,
  publishTweet,
  uploadMedia,
};
