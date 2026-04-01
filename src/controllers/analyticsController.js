const Analytics = require('../models/Analytics');
const Post = require('../models/Post');
const Media = require('../models/Media');
const SocialAccount = require('../models/SocialAccount');
const { resolveAgencyOwnerId } = require('../utils/agencyHelper');

exports.getPostAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const post = await Post.findOne({ _id: id, userId: req.userId });
    if (!post) return res.status(404).json({ error: 'Post not found' });
    const analytics = await Analytics.find({ postId: id });
    const summary = { totalLikes: 0, totalComments: 0, totalShares: 0, totalImpressions: 0, byPlatform: {} };
    analytics.forEach(stat => {
      summary.totalLikes += stat.likes;
      summary.totalComments += stat.comments;
      summary.totalShares += stat.shares;
      summary.totalImpressions += stat.impressions;
      summary.byPlatform[stat.platform] = { likes: stat.likes, comments: stat.comments, shares: stat.shares, impressions: stat.impressions, lastSynced: stat.lastSyncedAt };
    });
    res.json({ post, analytics: summary });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.userId, status: 'published' });
    const postIds = posts.map(p => p._id);
    const analytics = await Analytics.find({ postId: { $in: postIds } });
    const stats = { totalPosts: posts.length, totalEngagement: 0, platformBreakdown: {} };
    analytics.forEach(stat => {
      const engagement = stat.likes + stat.comments + stat.shares;
      stats.totalEngagement += engagement;
      if (!stats.platformBreakdown[stat.platform]) stats.platformBreakdown[stat.platform] = { posts: 0, engagement: 0 };
      stats.platformBreakdown[stat.platform].engagement += engagement;
    });
    res.json({ stats });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// GET /api/analytics/work — media assets grouped by status with date/startup filters
exports.getWorkAnalytics = async (req, res) => {
  try {
    const { from, to, startupId, period } = req.query;
    const context = req.user.activeContext || 'personal';

    let base = {};
    if (context === 'agency') {
      const agencyId = await resolveAgencyOwnerId(req.user);
      if (!agencyId) return res.json({ summary: {}, assets: [], byStatus: {}, byCategory: {} });
      base = { context: 'agency', agencyId };
      if (startupId && startupId !== 'all') base.startupId = startupId;
    } else {
      base = { $or: [{ userId: req.user._id, context: 'personal' }, { sharedWith: req.user._id, context: 'personal' }] };
    }

    // Date range
    const now = new Date();
    let dateFilter = {};
    if (from || to) {
      dateFilter = {};
      if (from) dateFilter.$gte = new Date(from);
      if (to) dateFilter.$lte = new Date(to + 'T23:59:59');
    } else if (period === 'week') {
      const start = new Date(now); start.setDate(now.getDate() - 7);
      dateFilter = { $gte: start };
    } else if (period === 'month') {
      const start = new Date(now); start.setDate(now.getDate() - 30);
      dateFilter = { $gte: start };
    }
    if (Object.keys(dateFilter).length > 0) base.createdAt = dateFilter;

    const assets = await Media.find(base).sort({ createdAt: -1 }).lean();

    // Group by status
    const byStatus = {};
    const byCategory = {};
    assets.forEach(a => {
      byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      byCategory[a.category] = (byCategory[a.category] || 0) + 1;
    });

    const summary = {
      total: assets.length,
      approved: byStatus['Approved'] || 0,
      inDevelopment: byStatus['In Development'] || 0,
      sentForCorrection: byStatus['Sent for Correction'] || 0,
      corrected: byStatus['Corrected'] || 0,
      archived: byStatus['Archived'] || 0,
    };

    res.json({
      summary,
      byStatus,
      byCategory,
      assets: assets.map(a => ({
        id: a._id, title: a.title, category: a.category, status: a.status,
        uploadedBy: a.uploadedBy, startupId: a.startupId?.toString() || null,
        createdAt: a.createdAt, targetDate: a.targetDate,
        variantCount: (a.variants || []).length,
        commentCount: (a.comments || []).length,
        correctionCount: (a.corrections || []).length,
      })),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};

// GET /api/analytics/social — connected accounts + post stats
exports.getSocialAnalytics = async (req, res) => {
  try {
    const context = req.user.activeContext || 'personal';
    const accounts = await SocialAccount.find({ userId: req.user._id, isActive: true }).lean();

    // Posts scheduled/published
    const posts = await Post.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();

    const byPlatform = {};
    accounts.forEach(acc => {
      byPlatform[acc.platform] = {
        platform: acc.platform,
        username: acc.username,
        displayName: acc.displayName,
        avatar: acc.avatar,
        tokenExpiry: acc.tokenExpiry,
        posts: 0, scheduled: 0, drafts: 0,
      };
    });

    posts.forEach(p => {
      (p.platforms || []).forEach(platform => {
        const key = platform.toLowerCase();
        if (!byPlatform[key]) byPlatform[key] = { platform: key, posts: 0, scheduled: 0, drafts: 0 };
        if (p.status === 'published') byPlatform[key].posts++;
        else if (p.status === 'scheduled') byPlatform[key].scheduled++;
        else byPlatform[key].drafts++;
      });
    });

    res.json({
      accounts: accounts.map(a => ({ id: a._id, platform: a.platform, username: a.username, displayName: a.displayName, avatar: a.avatar, tokenExpiry: a.tokenExpiry })),
      byPlatform: Object.values(byPlatform),
      posts: posts.map(p => ({
        id: p._id, content: p.content, platforms: p.platforms,
        status: p.status, scheduledTime: p.scheduledTime, publishedAt: p.publishedAt, createdAt: p.createdAt,
      })),
      summary: {
        totalAccounts: accounts.length,
        totalPosts: posts.filter(p => p.status === 'published').length,
        totalScheduled: posts.filter(p => p.status === 'scheduled').length,
        totalDrafts: posts.filter(p => p.status === 'draft').length,
      },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
};
