const mongoose = require('mongoose');

const startupSchema = new mongoose.Schema({
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  phone: { type: String, default: '' },
  whatsapp: { type: String, default: '' },
  email: { type: String, default: '' },
  logo: { type: String, default: null },
  logoPublicId: { type: String, default: null },
}, { timestamps: true });

startupSchema.index({ agencyId: 1, name: 1 });

module.exports = mongoose.model('Startup', startupSchema);
