const axios = require('axios');
const { withRetry } = require('../utils/apiRetry');

const BASE = 'https://api.linkedin.com/v2';

/**
 * Build the OAuth 2.0 authorization URL.
 */
const getAuthUrl = (state) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINKEDIN_CLIENT_ID,
    redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
    state,
    scope: 'openid profile email w_member_social',
  });
  return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
};

/**
 * Exchange authorization code for access token.
 */
const exchangeCodeForToken = async (code) => {
  const res = await withRetry(() => axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.LINKEDIN_CALLBACK_URL,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ));
  return res.data; // { access_token, expires_in, refresh_token (optional) }
};

/**
 * Refresh an expired access token (if refresh_token is available).
 */
const refreshAccessToken = async (refreshToken) => {
  const res = await withRetry(() => axios.post(
    'https://www.linkedin.com/oauth/v2/accessToken',
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.LINKEDIN_CLIENT_ID,
      client_secret: process.env.LINKEDIN_CLIENT_SECRET,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  ));
  return res.data;
};

/**
 * Fetch the authenticated user's profile.
 */
const getUserProfile = async (accessToken) => {
  const res = await withRetry(() => axios.get(`${BASE}/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));
  return res.data; // { sub, name, email, picture }
};

/**
 * Publish a text/image post to LinkedIn.
 */
const publishPost = async (accessToken, personUrn, text, mediaUrn = null) => {
  const body = {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: mediaUrn ? 'IMAGE' : 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };

  if (mediaUrn) {
    body.specificContent['com.linkedin.ugc.ShareContent'].media = [
      { status: 'READY', media: mediaUrn },
    ];
  }

  const res = await withRetry(() => axios.post(`${BASE}/ugcPosts`, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
  }));
  return res.data; // { id }
};

/**
 * Upload an image to LinkedIn and return the media URN.
 */
const uploadImage = async (accessToken, personUrn, imageBuffer) => {
  // 1. Register upload
  const registerRes = await withRetry(() => axios.post(
    `${BASE}/assets?action=registerUpload`,
    {
      registerUploadRequest: {
        recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
        owner: personUrn,
        serviceRelationships: [
          {
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent',
          },
        ],
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  ));

  const uploadUrl = registerRes.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = registerRes.data.value.asset;

  // 2. Upload binary
  await withRetry(() => axios.put(uploadUrl, imageBuffer, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }));

  return asset;
};

module.exports = {
  getAuthUrl,
  exchangeCodeForToken,
  refreshAccessToken,
  getUserProfile,
  publishPost,
  uploadImage,
};
