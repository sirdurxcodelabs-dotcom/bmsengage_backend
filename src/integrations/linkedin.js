const axios = require('axios');

const publishToLinkedIn = async (post, account) => {
  const url = 'https://api.linkedin.com/v2/ugcPosts';

  const postData = {
    author: `urn:li:person:${account.accountId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: post.content
        },
        shareMediaCategory: post.mediaUrls?.length > 0 ? 'IMAGE' : 'NONE'
      }
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC'
    }
  };

  // Add media if present
  if (post.mediaUrls && post.mediaUrls.length > 0) {
    postData.specificContent['com.linkedin.ugc.ShareContent'].media = post.mediaUrls.map(url => ({
      status: 'READY',
      description: {
        text: 'Image'
      },
      media: url,
      title: {
        text: 'Post Image'
      }
    }));
  }

  try {
    const response = await axios.post(url, postData, {
      headers: {
        'Authorization': `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    return {
      platformPostId: response.headers['x-restli-id'],
      url: `https://www.linkedin.com/feed/update/${response.headers['x-restli-id']}`
    };
  } catch (error) {
    throw new Error(`LinkedIn API error: ${error.response?.data?.message || error.message}`);
  }
};

const refreshLinkedInToken = async (account) => {
  const url = 'https://www.linkedin.com/oauth/v2/accessToken';
  
  try {
    const response = await axios.post(url, null, {
      params: {
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
        client_id: process.env.LINKEDIN_CLIENT_ID,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET
      }
    });

    return response.data.access_token;
  } catch (error) {
    throw new Error('Failed to refresh LinkedIn token');
  }
};

module.exports = { publishToLinkedIn, refreshLinkedInToken };
