const mongoose = require('mongoose');

const startupSchema = new mongoose.Schema({
  // Agency owner who created this startup
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
}, { timestamps: true });

startupSchema.index({ agencyId: 1, name: 1 });

module.exports = mongoose.model('Startup', startupSchema);
