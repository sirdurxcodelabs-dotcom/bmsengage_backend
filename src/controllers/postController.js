const Post = require('../models/Post');
const { addScheduledPostJob } = require('../queues/schedulerQueue');

exports.createPost = async (req, res) => {
  try {
    const { content, platforms, scheduledTime, mediaUrls } = req.body;

    const post = new Post({
      userId: req.userId,
      content,
      platforms,
      mediaUrls: mediaUrls || [],
      status: scheduledTime ? 'scheduled' : 'draft',
      scheduledTime: scheduledTime ? new Date(scheduledTime) : null
    });

    await post.save();

    if (scheduledTime) {
      await addScheduledPostJob(post._id, new Date(scheduledTime));
    }

    res.status(201).json({ message: 'Post created', post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPosts = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { userId: req.userId };
    
    if (status) query.status = status;

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Post.countDocuments(query);

    res.json({
      posts,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPost = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({ message: 'Post deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.publishNow = async (req, res) => {
  try {
    const post = await Post.findOne({ _id: req.params.id, userId: req.userId });
    
    if (!post) {
      return res.status(404).json({ error: 'Post not found' });
    }

    await addScheduledPostJob(post._id, new Date());

    res.json({ message: 'Post queued for publishing' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
