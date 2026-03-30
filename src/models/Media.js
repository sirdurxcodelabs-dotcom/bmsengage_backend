const mongoose = require('mongoose');

const mediaMetadataSchema = new mongoose.Schema({
  fileType: String,
  fileSize: String,
  mimeType: String,
  width: Number,
  height: Number,
  dpi: Number,
  colorModel: String,
  duration: String,
  resolution: String,
  frameRate: Number,
  codec: String,
  bitrate: String,
  audioPresence: Boolean,
  createdDate: { type: Date, default: Date.now },
  modifiedDate: { type: Date, default: Date.now },
}, { _id: false });

const mediaVariantSchema = new mongoose.Schema({
  version: { type: Number, required: true },
  title: { type: String, required: true },
  url: { type: String, required: true },
  publicId: { type: String },
  metadata: mediaMetadataSchema,
  correctionReplyTo: { type: mongoose.Schema.Types.ObjectId, default: null }, // links to a correction
  uploadedBy: { type: String },
}, { timestamps: true });

const mediaCommentReactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  emoji: { type: String, required: true },
}, { _id: false });

const mediaCommentReplySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  text: { type: String, required: true, trim: true },
}, { timestamps: true });

const mediaCommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  replies: [mediaCommentReplySchema],
  reactions: [mediaCommentReactionSchema],
}, { timestamps: true });

const mediaCorrectionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  authorName: { type: String, required: true },
  text: { type: String, required: true, trim: true },
  timestamp: { type: String, default: null }, // optional video timestamp e.g. "1:23"
  status: { type: String, enum: ['open', 'resolved'], default: 'open' },
}, { timestamps: true });

const mediaViewLogSchema = new mongoose.Schema({
  ip: { type: String },
  userAgent: { type: String },
  viewedAt: { type: Date, default: Date.now },
}, { _id: false });

const mediaEditLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: { type: String },
  email: { type: String },
  accessedAt: { type: Date, default: Date.now },
}, { _id: false });

const deleteRequestSchema = new mongoose.Schema({
  requestedAt: { type: Date, default: Date.now },
  acceptances: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { _id: false });

const mediaSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // context: 'personal' or 'agency' — determines which gallery it appears in
  context: { type: String, enum: ['personal', 'agency'], default: 'personal' },
  // agencyId: the owner's _id when context is 'agency' (used to group agency assets)
  agencyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: {
    type: String,
    enum: ['Image', 'Video', 'Flyer', 'Graphics'],
    default: 'Image',
  },
  tags: [{ type: String, trim: true }],
  status: {
    type: String,
    enum: ['Published', 'Draft', 'Archived'],
    default: 'Published',
  },
  visibility: {
    type: String,
    enum: ['Public', 'Team', 'Private'],
    default: 'Public',
  },
  url: { type: String, required: true },
  publicId: { type: String },
  metadata: mediaMetadataSchema,
  variants: [mediaVariantSchema],
  comments: [mediaCommentSchema],
  corrections: [mediaCorrectionSchema],
  uploadedBy: { type: String },
  // Approval workflow
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: { type: Date, default: null },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  // pendingShareWith: users invited to access a personal asset but haven't accepted yet
  pendingShareWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  viewLog: [mediaViewLogSchema],
  editLog: [mediaEditLogSchema],
  deleteRequest: { type: deleteRequestSchema, default: null },
}, { timestamps: true });

mediaSchema.index({ userId: 1, status: 1 });
mediaSchema.index({ userId: 1, category: 1 });
mediaSchema.index({ context: 1, agencyId: 1 });

module.exports = mongoose.model('Media', mediaSchema);
