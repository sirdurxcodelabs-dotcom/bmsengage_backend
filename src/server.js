require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const { startScheduler } = require('./workers/postPublisher');
const { startCampaignScheduler } = require('./workers/campaignScheduler');
const { testEmailConfig } = require('./services/emailService');

const authRoutes = require('./routes/authRoutes');
const postRoutes = require('./routes/postRoutes');
const socialRoutes = require('./routes/socialRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const userRoutes = require('./routes/userRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const adminRoutes = require('./routes/adminRoutes');
const startupRoutes = require('./routes/startupRoutes');
const aiRoutes = require('./routes/aiRoutes');
const campaignEventRoutes = require('./routes/campaignEventRoutes');
const eventTemplateRoutes = require('./routes/eventTemplateRoutes');
const scheduledCampaignRoutes = require('./routes/scheduledCampaignRoutes');
const campaignNotificationRoutes = require('./routes/campaignNotificationRoutes');

const app = express();

// Middleware
app.use(cors());
// Raise body-parser limits so large multipart requests aren't rejected before multer sees them.
// Multer streams the file directly and doesn't use these parsers, but Express can still
// reject the request at the connection level if no limit is set generously.
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Connect to database and start scheduler
const startServer = async () => {
  try {
    await connectDB();
    startScheduler();
    startCampaignScheduler();

    // Test email config in background — don't block server startup
    testEmailConfig().catch(() => {});

    console.log('✓ Database connected');
    console.log('✓ Scheduler started');

    // ── AI service status ──────────────────────────────────────────────────
    const hasOpenAI = process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.includes('your_') && !process.env.OPENAI_API_KEY.includes('sk-...');
    const hasHF     = process.env.HUGGINGFACE_API_KEY && !process.env.HUGGINGFACE_API_KEY.includes('your_') && !process.env.HUGGINGFACE_API_KEY.includes('hf_...');

    if (hasOpenAI && hasHF) {
      console.log('✓ AI caption: OpenAI ✅  +  HuggingFace ✅  (OpenAI used first)');
    } else if (hasOpenAI) {
      console.log('✓ AI caption: OpenAI ✅  (add HUGGINGFACE_API_KEY for fallback)');
    } else if (hasHF) {
      console.log('✓ AI caption: HuggingFace ✅  (add OPENAI_API_KEY for better quality)');
    } else {
      console.log('⚠ AI caption: no API keys set — using HuggingFace free public API (rate-limited)');
      console.log('  → Add OPENAI_API_KEY or HUGGINGFACE_API_KEY to .env for reliable AI captions');
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/users', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/startups', startupRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/campaign-events', campaignEventRoutes);
app.use('/api/event-templates', eventTemplateRoutes);
app.use('/api/scheduled-campaigns', scheduledCampaignRoutes);
app.use('/api/campaign-notifications', campaignNotificationRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Error handler — always returns JSON with the actual error message
app.use((err, req, res, next) => {
  console.error(err.stack || err.message);

  // Multer file-size limit exceeded
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Videos must be under 2 GB.' });
  }
  // Multer unexpected field / other upload errors
  if (err.code && err.code.startsWith('LIMIT_')) {
    return res.status(400).json({ error: err.message });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({ error: err.message || 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health\n`);
});
