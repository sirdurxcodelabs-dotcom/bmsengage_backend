const Analytics = require('../models/Analytics');
const Post = require('../models/Post');

exports.getPostAnalytics = async (req, res) => {
  try {
    const { id } = req.params;

    const post = await Post.findOne({ _id: id, userId: req.userId });
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const analytics = await Analytics.find({ postId: id });

    const summary = {
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      totalImpressions: 0,
      byPlatform: {}
    };

    analytics.forEach(stat => {
      summary.totalLikes += stat.likes;
      summary.totalComments += stat.comments;
      summary.totalShares += stat.shares;
      summary.totalImpressions += stat.impressions;

      summary.byPlatform[stat.platform] = {
        likes: stat.likes,
        comments: stat.comments,
        shares: stat.shares,
        impressions: stat.impressions,
        lastSynced: stat.lastSyncedAt
      };
    });

    res.json({ post, analytics: summary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.userId, status: 'published' });
    const postIds = posts.map(p => p._id);

    const analytics = await Analytics.find({ postId: { $in: postIds } });

    const stats = {
      totalPosts: posts.length,
      totalEngagement: 0,
      platformBreakdown: {}
    };

    analytics.forEach(stat => {
      const engagement = stat.likes + stat.comments + stat.shares;
      stats.totalEngagement += engagement;

      if (!stats.platformBreakdown[stat.platform]) {
        stats.platformBreakdown[stat.platform] = {
          posts: 0,
          engagement: 0
        };
      }

      stats.platformBreakdown[stat.platform].engagement += engagement;
    });

    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
