const cron = require('node-cron');
const Post = require('../models/Post');
const SocialAccount = require('../models/SocialAccount');
const { publishToTwitter } = require('../integrations/twitter');
const { publishToLinkedIn } = require('../integrations/linkedin');
const {
  getJobsToProcess,
  markJobAsProcessing,
  markJobAsCompleted,
  markJobAsFailed
} = require('../queues/schedulerQueue');

const processScheduledPosts = async () => {
  try {
    const jobs = await getJobsToProcess();

    if (jobs.length === 0) {
      return;
    }

    console.log(`Processing ${jobs.length} scheduled posts...`);

    for (const job of jobs) {
      try {
        await markJobAsProcessing(job._id);

        const post = await Post.findById(job.postId);
        if (!post) {
          await markJobAsFailed(job._id, new Error('Post not found'));
          continue;
        }

        if (post.status === 'published') {
          await markJobAsCompleted(job._id);
          continue;
        }

        const accounts = await SocialAccount.find({
          userId: post.userId,
          platform: { $in: post.platforms },
          isActive: true
        });

        if (accounts.length === 0) {
          throw new Error('No active social accounts found');
        }

        const results = [];

        for (const account of accounts) {
          try {
            let result;
            
            if (account.platform === 'twitter') {
              result = await publishToTwitter(post, account);
            } else if (account.platform === 'linkedin') {
              result = await publishToLinkedIn(post, account);
            }

            results.push({ platform: account.platform, success: true, result });
          } catch (error) {
            results.push({ platform: account.platform, success: false, error: error.message });
          }
        }

        post.status = 'published';
        post.publishedAt = new Date();
        await post.save();

        await markJobAsCompleted(job._id);
        console.log(`Post ${post._id} published successfully`);

      } catch (error) {
        console.error(`Error processing job ${job._id}:`, error);
        await markJobAsFailed(job._id, error);

        const post = await Post.findById(job.postId);
        if (post) {
          post.status = 'failed';
          post.error = error.message;
          await post.save();
        }
      }
    }
  } catch (error) {
    console.error('Error in processScheduledPosts:', error);
  }
};

const startScheduler = () => {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    await processScheduledPosts();
  });

  console.log('Post scheduler started - checking every minute for scheduled posts');
};

module.exports = { startScheduler, processScheduledPosts };
