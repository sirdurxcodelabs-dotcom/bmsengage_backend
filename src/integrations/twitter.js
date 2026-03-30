const axios = require('axios');

const publishToTwitter = async (post, account) => {
  // Twitter API v2 endpoint
  const url = 'https://api.twitter.com/2/tweets';

  const tweetData = {
    text: post.content
  };

  // Add media if present
  if (post.mediaUrls && post.mediaUrls.length > 0) {
    // Note: Media must be uploaded first using Twitter's media upload endpoint
    // This is simplified - in production, you'd upload media first and get media_ids
    tweetData.media = {
      media_ids: [] // Add uploaded media IDs here
    };
  }

  try {
    const response = await axios.post(url, tweetData, {
      headers: {
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return {
      platformPostId: response.data.data.id,
      url: `https://twitter.com/i/web/status/${response.data.data.id}`
    };
  } catch (error) {
    throw new Error(`Twitter API error: ${error.response?.data?.detail || error.message}`);
  }
};

const refreshTwitterToken = async (account) => {
  // Implement OAuth2 token refresh logic
  // Twitter OAuth2 token refresh endpoint
  const url = 'https://api.twitter.com/2/oauth2/token';
  
  try {
    const response = await axios.post(url, {
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      client_id: process.env.TWITTER_CLIENT_ID
    }, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      auth: {
        username: process.env.TWITTER_CLIENT_ID,
        password: process.env.TWITTER_CLIENT_SECRET
      }
    });

    return response.data.access_token;
  } catch (error) {
    throw new Error('Failed to refresh Twitter token');
  }
};

module.exports = { publishToTwitter, refreshTwitterToken };
