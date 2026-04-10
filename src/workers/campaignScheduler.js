const cron = require('node-cron');
const CampaignEvent = require('../models/CampaignEvent');
const CampaignNotification = require('../models/CampaignNotification');
const User = require('../models/User');

const startCampaignScheduler = () => {
  // Daily at 08:00 — remind about events 3 days away
  cron.schedule('0 8 * * *', async () => {
    try {
      const now = new Date();
      const in3 = new Date(now);
      in3.setDate(in3.getDate() + 3);
      const dayStart = new Date(in3); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(in3); dayEnd.setHours(23, 59, 59, 999);

      const events = await CampaignEvent.find({ date: { $gte: dayStart, $lte: dayEnd } });
      for (const event of events) {
        await CampaignNotification.create({
          agencyId: event.agencyId,
          title: '⏳ Upcoming Event Reminder',
          message: `Upcoming Event: "${event.title}" in 3 days. Assets & campaigns should be ready.`,
          type: 'reminder',
          roles: [],
          relatedEventId: event._id,
        });
      }
      if (events.length > 0) console.log(`[CampaignScheduler] Sent ${events.length} 3-day reminders`);
    } catch (e) { console.error('[CampaignScheduler] daily reminder error:', e.message); }
  });

  // Monthly on 1st at 07:00 — auto-create "New Month Planning" event for each agency
  cron.schedule('0 7 1 * *', async () => {
    try {
      // Find all agency owners (users who have agency.name set)
      const agencies = await User.find({ 'agency.name': { $exists: true, $ne: null } }).select('_id agency');
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      nextMonth.setDate(1);
      nextMonth.setHours(0, 0, 0, 0);
      const monthName = nextMonth.toLocaleString('default', { month: 'long', year: 'numeric' });

      for (const agency of agencies) {
        // Check if already exists
        const exists = await CampaignEvent.findOne({
          agencyId: agency._id,
          isMonthlyEvent: true,
          date: { $gte: new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1), $lt: new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 1) },
        });
        if (!exists) {
          const event = await CampaignEvent.create({
            agencyId: agency._id,
            title: `📆 New Month Planning – ${monthName}`,
            category: 'Global',
            date: nextMonth,
            isMonthlyEvent: true,
            recurrence: 'monthly',
            region: 'Global',
            tags: ['planning', 'monthly'],
            createdBy: agency._id,
          });
          await CampaignNotification.create({
            agencyId: agency._id,
            title: '📆 Monthly Planning Event Created',
            message: `A new monthly planning event for ${monthName} has been created. Start planning your campaigns!`,
            type: 'event',
            roles: [],
            relatedEventId: event._id,
          });
        }
      }
      console.log(`[CampaignScheduler] Monthly planning events created for ${agencies.length} agencies`);
    } catch (e) { console.error('[CampaignScheduler] monthly event error:', e.message); }
  });

  console.log('✓ Campaign scheduler started');
};

module.exports = { startCampaignScheduler };
