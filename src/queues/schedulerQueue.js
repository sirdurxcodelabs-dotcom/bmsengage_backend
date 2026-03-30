const ScheduledJob = require('../models/ScheduledJob');

const addScheduledPostJob = async (postId, scheduledTime) => {
  try {
    const job = new ScheduledJob({
      postId,
      scheduledTime: new Date(scheduledTime),
      status: 'pending'
    });

    await job.save();
    console.log(`Scheduled job created for post ${postId} at ${scheduledTime}`);
    
    return job;
  } catch (error) {
    console.error('Error creating scheduled job:', error);
    throw error;
  }
};

const getJobsToProcess = async () => {
  const now = new Date();
  
  return await ScheduledJob.find({
    status: 'pending',
    scheduledTime: { $lte: now }
  }).limit(10);
};

const markJobAsProcessing = async (jobId) => {
  return await ScheduledJob.findByIdAndUpdate(jobId, {
    status: 'processing'
  });
};

const markJobAsCompleted = async (jobId) => {
  return await ScheduledJob.findByIdAndUpdate(jobId, {
    status: 'completed',
    processedAt: new Date()
  });
};

const markJobAsFailed = async (jobId, error) => {
  const job = await ScheduledJob.findById(jobId);
  
  if (job.attempts < job.maxAttempts) {
    return await ScheduledJob.findByIdAndUpdate(jobId, {
      $inc: { attempts: 1 },
      status: 'pending',
      error: error.message
    });
  } else {
    return await ScheduledJob.findByIdAndUpdate(jobId, {
      status: 'failed',
      error: error.message,
      processedAt: new Date()
    });
  }
};

module.exports = {
  addScheduledPostJob,
  getJobsToProcess,
  markJobAsProcessing,
  markJobAsCompleted,
  markJobAsFailed
};
