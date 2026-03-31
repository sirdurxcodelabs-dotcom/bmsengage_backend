const axios = require('axios');
const { withRetry } = require('../utils/apiRetry');

const BASE = 'https://open.tiktokapis.com/v2';

/**
 * Build the OAuth 2.0 authorization URL.
 */
const getAuthUrl = (state, codeVerifier) => {
  const params = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY,
    response_type: 'code',
    scope: 'user.info.basic,video.publish,video.upload',
    redirect_uri: process.env.TIKTOK_REDIRECT_URI,
    state,
    code_challenge: codeVerifier,
    code_challenge_method: 'plain',
  });
  return `https://www.tiktok.com/v2/auth/authorize?${params.toString()}`;
};

/**
 * Exchange authorization code for tokens.
 */
const exchangeCodeForToken = async (code, codeVerifier) => {
  const res = await withRetry(() => axios.post(
    'https://open.tiktokapis.com/v2/oauth/token/',
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      code_verifier: codeVerifier,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ));
  return res.data; // { access_token, refresh_token, open_id, expires_in, scope }
};

/**
 * Refresh an expired access token.
 */
const refreshAccessToken = async (refreshToken) => {
  const res = await withRetry(() => axios.post(
    'https://open.tiktokapis.com/v2/oauth/token/',
    new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY,
      client_secret: process.env.TIKTOK_CLIENT_SECRET,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ));
  return res.data;
};

/**
 * Fetch the authenticated user's basic info.
 */
const getUserInfo = async (accessToken) => {
  const res = await withRetry(() => axios.get(`${BASE}/user/info/`, {
    params: { fields: 'open_id,union_id,avatar_url,display_name' },
    headers: { Authorization: `Bearer ${accessToken}` },
  }));
  return res.data.data?.user;
};

/**
 * Initialize a video upload and return the publish_id.
 * TikTok requires a two-step: init → upload → publish.
 */
const initVideoUpload = async (accessToken, videoSize, title) => {
  const res = await withRetry(() => axios.post(
    `${BASE}/post/publish/video/init/`,
    {
      post_info: { title, privacy_level: 'PUBLIC_TO_EVERYONE', disable_duet: false, disable_comment: false, disable_stitch: false },
      source_info: { source: 'FILE_UPLOAD', video_size: videoSize, chunk_size: videoSize, total_chunk_count: 1 },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    }
  ));
  return res.data.data; // { publish_id, upload_url }
};

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getUserInfo,
  initVideoUpload,
};
