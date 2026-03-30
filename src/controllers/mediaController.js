const Media = require('../models/Media');
const { cloudinary } = require('../config/cloudinary');

// ── Access helpers ────────────────────────────────────────────────────────────

/**
 * Resolve the agency owner ID for a user (cached per request to avoid repeated DB hits).
 */
const getAgencyOwnerId = async (user) => {
  const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
  return resolveAgencyOwnerId(user);
};

/**
 * Find a media document accessible by the requesting user.
 * - Personal context: owner OR in sharedWith
 * - Agency context: any member of the same agency
 */
const findAccessible = async (id, user) => {
  if (user.activeContext === 'agency') {
    const agencyId = await getAgencyOwnerId(user);
    if (!agencyId) return null;
    return Media.findOne({ _id: id, context: 'agency', agencyId });
  }
  // Personal: owner or shared recipient
  return Media.findOne({ _id: id, $or: [{ userId: user._id }, { sharedWith: user._id }] });
};

// Notify all parties involved with an asset (owner + sharedWith) — everyone including the actor
const notifyAll = async (media, _actorId, type, title, message, data = {}) => {
  try {
    const { createNotification } = require('../controllers/notificationController');
    const { sendMediaActivityEmail } = require('../services/emailService');
    const User = require('../models/User');

    // Everyone: owner + all shared users (including the actor themselves)
    const recipients = new Set([media.userId.toString(), ...media.sharedWith.map(id => id.toString())]);

    for (const uid of recipients) {
      try {
        await createNotification(uid, type, title, message, data, false);
        const u = await User.findById(uid).select('email name');
        if (u?.email) {
          await sendMediaActivityEmail(u.email, u.name || u.email, type, data).catch(() => {});
        }
      } catch (e) { console.error('notifyAll error for', uid, e.message); }
    }
  } catch (e) { console.error('notifyAll error:', e.message); }
};

// Helper: build metadata from cloudinary result + original file info
const buildMetadata = (cloudResult, file) => {
  const isVideo = cloudResult.resource_type === 'video';
  const isPdf = file.mimetype === 'application/pdf';
  const ext = (file.originalname.split('.').pop() || '').toUpperCase();
  const sizeInMB = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

  return {
    fileType: ext,
    fileSize: sizeInMB,
    mimeType: file.mimetype,
    createdDate: new Date(),
    modifiedDate: new Date(),
    ...(isVideo
      ? {
          duration: cloudResult.duration ? `${Math.round(cloudResult.duration)}s` : undefined,
          resolution: cloudResult.height ? `${cloudResult.height}p` : undefined,
          frameRate: cloudResult.frame_rate,
          codec: cloudResult.video?.codec,
          bitrate: cloudResult.bit_rate ? `${Math.round(cloudResult.bit_rate / 1000)} kbps` : undefined,
          audioPresence: !!cloudResult.audio,
        }
      : !isPdf
      ? {
          width: cloudResult.width,
          height: cloudResult.height,
          resolution: (cloudResult.width && cloudResult.height) ? `${cloudResult.width}x${cloudResult.height}` : undefined,
          colorModel: 'RGB',
          dpi: 72,
        }
      : {}),
  };
};

// POST /api/media/upload - single file
exports.uploadSingle = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { title, category, description, tags, status, visibility, startupId } = req.body;
    const cloudResult = req.file;

    const context = req.user.activeContext || 'personal';
    let agencyId = null;
    if (context === 'agency') {
      const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
      agencyId = await resolveAgencyOwnerId(req.user);
    }

    const media = await Media.create({
      userId: req.user.id,
      context,
      agencyId,
      // startupId only stored for agency context
      startupId: (context === 'agency' && startupId) ? startupId : null,
      title: title || req.file.originalname.split('.')[0],
      description: description || '',
      category: category || 'Image',
      tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      status: status || 'Published',
      visibility: visibility || 'Public',
      url: cloudResult.path,
      publicId: cloudResult.filename,
      metadata: buildMetadata(cloudResult, req.file),
      variants: [],
      uploadedBy: req.user.name || req.user.email,
    });

    // Notify the uploader + all Production/Marketing/Executive members who can review
    try {
      const { createNotification } = require('../controllers/notificationController');
      const User = require('../models/User');
      const { ROLE_GROUPS } = require('../models/User');

      // Notify uploader
      await createNotification(req.user._id, 'media_updated', 'Asset Uploaded',
        `You uploaded "${media.title}" successfully.`,
        { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email }, false
      );

      // In agency context: notify all reviewers (production, marketing, executive)
      if (context === 'agency' && agencyId) {
        const TeamInvite = require('../models/TeamInvite');
        const reviewerRoles = [...ROLE_GROUPS.production, ...ROLE_GROUPS.marketing, ...ROLE_GROUPS.executive];
        const invites = await TeamInvite.find({ invitedBy: agencyId, status: 'accepted' })
          .populate('invitedUser', 'name email notificationPrefs');
        for (const inv of invites) {
          if (!inv.invitedUser) continue;
          if (inv.invitedUser._id.toString() === req.user._id.toString()) continue;
          if (!reviewerRoles.includes(inv.agencyRole)) continue;
          if (!inv.invitedUser.notificationPrefs?.galleryAssets) continue;
          await createNotification(
            inv.invitedUser._id, 'media_updated', 'New Asset Uploaded',
            `${req.user.name || req.user.email} uploaded "${media.title}" in the agency gallery.`,
            { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email }, false
          ).catch(() => {});
        }
        // Also notify the agency owner if they're not the uploader
        if (agencyId.toString() !== req.user._id.toString()) {
          const owner = await User.findById(agencyId).select('name email notificationPrefs');
          if (owner?.notificationPrefs?.galleryAssets) {
            await createNotification(
              agencyId, 'media_updated', 'New Asset Uploaded',
              `${req.user.name || req.user.email} uploaded "${media.title}" in the agency gallery.`,
              { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email }, false
            ).catch(() => {});
          }
        }
      }
    } catch (e) { /* silent */ }

    res.status(201).json({ success: true, media: formatMedia(media) });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
};

// POST /api/media/upload-multiple - multiple files
exports.uploadMultiple = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ error: 'No files uploaded' });

    const { category, status, visibility } = req.body;
    const context = req.user.activeContext || 'personal';
    let agencyId = null;
    if (context === 'agency') {
      const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
      agencyId = await resolveAgencyOwnerId(req.user);
    }

    const created = await Promise.all(
      req.files.map(async (file) => {
        return Media.create({
          userId: req.user.id,
          context,
          agencyId,
          title: file.originalname.split('.')[0],
          description: '',
          category: category || 'Image',
          tags: [],
          status: status || 'Published',
          visibility: visibility || 'Public',
          url: file.path,
          publicId: file.filename,
          metadata: buildMetadata(file, file),
          variants: [],
          uploadedBy: req.user.name || req.user.email,
        });
      })
    );

    res.status(201).json({ success: true, media: created.map(m => formatMedia(m, req.user._id)) });
  } catch (err) {
    console.error('Multi-upload error:', err);
    res.status(500).json({ error: 'Upload failed', details: err.message });
  }
};

// POST /api/media/:id/variant - add variant to existing asset
exports.addVariant = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const { title, correctionReplyTo } = req.body;
    const cloudResult = req.file;

    if (!cloudResult.path) {
      return res.status(500).json({ error: 'File upload to Cloudinary failed' });
    }

    const variant = {
      version: media.variants.length + 2,
      title: title || `Variant v${media.variants.length + 2}`,
      url: cloudResult.path,
      publicId: cloudResult.filename,
      metadata: buildMetadata(cloudResult, req.file),
      uploadedBy: req.user.name || req.user.email,
      correctionReplyTo: correctionReplyTo || null,
    };

    media.variants.push(variant);

    // If this variant is a reply to a correction, auto-resolve it and notify requester
    if (correctionReplyTo) {
      let correction = null;
      try {
        correction = media.corrections.id(correctionReplyTo);
      } catch (castErr) {
        // Invalid ObjectId — just skip the correction link
        console.warn('Invalid correctionReplyTo id:', correctionReplyTo);
      }

      if (correction) {
        correction.status = 'resolved';
        try {
          const { createNotification } = require('../controllers/notificationController');
          await createNotification(
            correction.userId, 'media_variant',
            'Revision Addressed',
            `${req.user.name || req.user.email} uploaded a new version addressing your revision on "${media.title}".`,
            { mediaId: media._id, title: media.title, variantUploader: req.user.name || req.user.email },
            false
          );
        } catch (e) { console.error('Notification error:', e); }
      }
    }

    // Notify asset owner if uploader is a shared user
    const isOwner = media.userId.toString() === req.user._id.toString();
    if (!isOwner) {
      try {
        const { createNotification } = require('../controllers/notificationController');
        await createNotification(
          media.userId, 'media_variant',
          'New Version Uploaded',
          `${req.user.name || req.user.email} uploaded a new version of "${media.title}".`,
          { mediaId: media._id, title: media.title },
          false
        );
      } catch (e) { console.error('Notification error:', e); }
    }

    await media.save();
    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    console.error('Variant upload error:', err);
    res.status(500).json({ error: 'Variant upload failed', details: err.message });
  }
};

// GET /api/media/public/:id — no auth, for shared view links
exports.getPublicMedia = async (req, res) => {
  try {
    const media = await Media.findById(req.params.id);
    if (!media || media.visibility === 'Private') {
      return res.status(404).json({ error: 'Asset not found or not publicly accessible' });
    }
    // Log the view
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    media.viewLog.push({ ip, userAgent, viewedAt: new Date() });
    await media.save();

    // Notify the asset owner that someone viewed via the share link
    try {
      const { createNotification } = require('../controllers/notificationController');
      const { sendMediaActivityEmail } = require('../services/emailService');
      const User = require('../models/User');
      await createNotification(
        media.userId, 'media_updated',
        'Asset Viewed',
        `Someone viewed "${media.title}" via the share link (IP: ${ip}).`,
        { mediaId: media._id, title: media.title, assetTitle: media.title, ip, authorName: 'Anonymous' },
        false
      );
      const owner = await User.findById(media.userId).select('email name');
      if (owner?.email) {
        await sendMediaActivityEmail(owner.email, owner.name || owner.email, 'media_updated', {
          assetTitle: media.title, authorName: `Anonymous (${ip})`, text: 'Viewed via share link',
        }).catch(() => {});
      }
    } catch (e) { /* silent — don't fail the response */ }

    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
};

// GET /api/media - list all media for user (context-aware)
exports.getMedia = async (req, res) => {
  try {
    const { category, status, visibility, search } = req.query;
    const context = req.user.activeContext || 'personal';

    let base = {};

    if (context === 'personal') {
      base = {
        $or: [
          { userId: req.user._id, context: 'personal' },
          { sharedWith: req.user._id, context: 'personal' },
        ],
      };
    } else {
      const { resolveAgencyOwnerId } = require('../utils/agencyHelper');
      const agencyId = await resolveAgencyOwnerId(req.user);

      if (!agencyId) return res.json({ success: true, media: [] });

      // All agency assets — visible to every member automatically
      base = { context: 'agency', agencyId };
    }

    if (category && category !== 'All') base.category = category;
    if (status && status !== 'All') base.status = status;
    if (visibility && visibility !== 'All') base.visibility = visibility;
    if (search) {
      base.$and = [{
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } },
        ],
      }];
    }

    const media = await Media.find(base).sort({ createdAt: -1 });
    res.json({ success: true, media: media.map(m => formatMedia(m, req.user._id)) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
};

// GET /api/media/:id
exports.getMediaById = async (req, res) => {
  try {
    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    // Log edit-link access for non-owners (shared users accessing via edit link)
    const isOwner = media.userId.toString() === req.user._id.toString();
    if (!isOwner && req.query.via === 'editlink') {
      const alreadyLogged = media.editLog.some(e => e.userId?.toString() === req.user._id.toString());
      if (!alreadyLogged) {
        media.editLog.push({ userId: req.user._id, name: req.user.name, email: req.user.email, accessedAt: new Date() });
        await media.save();
        try {
          const { createNotification } = require('../controllers/notificationController');
          const { sendMediaActivityEmail } = require('../services/emailService');
          const User = require('../models/User');
          await createNotification(
            media.userId, 'media_updated', 'Edit Link Accessed',
            `${req.user.name || req.user.email} accessed "${media.title}" via the edit link.`,
            { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email }, false
          );
          const owner = await User.findById(media.userId).select('email name');
          if (owner?.email) {
            await sendMediaActivityEmail(owner.email, owner.name || owner.email, 'media_updated', {
              assetTitle: media.title, authorName: req.user.name || req.user.email, text: 'Accessed via edit link',
            }).catch(() => {});
          }
        } catch (e) { /* silent */ }
      }
    }

    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch media' });
  }
};

// PATCH /api/media/:id
exports.updateMedia = async (req, res) => {
  try {
    const { title, description, category, tags, status, visibility } = req.body;

    // Only the uploader (userId) can edit — in both personal and agency context
    const media = await Media.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(category && { category }),
        ...(tags !== undefined && { tags: tags.split(',').map(t => t.trim()).filter(Boolean) }),
        ...(status && { status }),
        ...(visibility && { visibility }),
        'metadata.modifiedDate': new Date(),
      },
      { new: true }
    );
    if (!media) return res.status(403).json({ error: 'Only the uploader can edit this asset' });

    await notifyAll(media, req.user._id, 'media_updated',
      'Asset Updated',
      `${req.user.name || req.user.email} updated "${media.title}".`,
      { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email }
    );

    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update media' });
  }
};

// DELETE /api/media/:id
exports.deleteMedia = async (req, res) => {
  try {
    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const isUploader = media.userId.toString() === req.user._id.toString();

    if (media.context === 'agency') {
      // Agency context: only the agency owner can delete
      const agencyId = await getAgencyOwnerId(req.user);
      const isAgencyOwner = agencyId && agencyId.toString() === req.user._id.toString();
      if (!isAgencyOwner) {
        return res.status(403).json({ error: 'Only the agency owner can delete agency assets' });
      }
    } else {
      // Personal context: only the uploader can delete
      if (!isUploader) {
        return res.status(403).json({ error: 'Only the uploader can delete this asset' });
      }
      // If shared, require all shared users to have accepted the delete request
      if (media.sharedWith.length > 0) {
        if (!media.deleteRequest) {
          return res.status(403).json({ error: 'Asset is shared. Send a delete request first.', requiresRequest: true });
        }
        const acceptedIds = (media.deleteRequest.acceptances || []).map(a => a.toString());
        const pending = media.sharedWith.filter(uid => !acceptedIds.includes(uid.toString()));
        if (pending.length > 0) {
          return res.status(403).json({ error: `Waiting for ${pending.length} shared user(s) to accept.`, pendingCount: pending.length });
        }
      }
    }

    // Delete from Cloudinary
    if (media.publicId) {
      const resourceType = media.metadata?.mimeType?.startsWith('video/') ? 'video' : 'image';
      await cloudinary.uploader.destroy(media.publicId, { resource_type: resourceType }).catch(() => {});
    }
    for (const variant of media.variants) {
      if (variant.publicId) {
        const rt = variant.metadata?.mimeType?.startsWith('video/') ? 'video' : 'image';
        await cloudinary.uploader.destroy(variant.publicId, { resource_type: rt }).catch(() => {});
      }
    }

    await media.deleteOne();

    // Notify shared users
    try {
      const { createNotification } = require('../controllers/notificationController');
      for (const uid of media.sharedWith) {
        await createNotification(uid, 'media_updated', 'Asset Deleted',
          `${req.user.name || req.user.email} deleted "${media.title}".`,
          { title: media.title, authorName: req.user.name || req.user.email }, false
        ).catch(() => {});
      }
    } catch (e) { /* silent */ }

    res.json({ success: true, message: 'Media deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete media' });
  }
};

// POST /api/media/:id/delete-request — owner requests delete, notifies shared users
exports.requestDelete = async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, userId: req.user.id });
    if (!media) return res.status(404).json({ error: 'Media not found or not your asset' });
    if (media.sharedWith.length === 0) return res.status(400).json({ error: 'Asset is not shared with anyone' });

    media.deleteRequest = { requestedAt: new Date(), acceptances: [] };
    await media.save();

    // Notify all shared users
    const { createNotification } = require('../controllers/notificationController');
    for (const uid of media.sharedWith) {
      try {
        await createNotification(uid, 'media_updated',
          'Delete Request',
          `${req.user.name || req.user.email} wants to delete "${media.title}". Please accept or ignore.`,
          { mediaId: media._id, title: media.title, requestedBy: req.user.name || req.user.email },
          false
        );
      } catch (e) { console.error('Notification error:', e); }
    }

    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to send delete request' });
  }
};

// POST /api/media/:id/delete-request/accept — shared user accepts delete
exports.acceptDeleteRequest = async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, sharedWith: req.user._id });
    if (!media) return res.status(404).json({ error: 'Media not found or not shared with you' });
    if (!media.deleteRequest) return res.status(400).json({ error: 'No delete request pending' });

    const alreadyAccepted = media.deleteRequest.acceptances.map(a => a.toString()).includes(req.user._id.toString());
    if (!alreadyAccepted) {
      media.deleteRequest.acceptances.push(req.user._id);
      await media.save();
    }

    // Notify owner
    const { createNotification } = require('../controllers/notificationController');
    try {
      await createNotification(media.userId, 'media_updated',
        'Delete Request Accepted',
        `${req.user.name || req.user.email} accepted the delete request for "${media.title}".`,
        { mediaId: media._id, title: media.title },
        false
      );
    } catch (e) { console.error('Notification error:', e); }

    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept delete request' });
  }
};

// Format media for frontend (map _id to id, format dates)
const formatMedia = (doc, requestingUserId) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  return {
    id: obj._id.toString(),
    context: obj.context || 'personal',
    agencyId: obj.agencyId?.toString() || null,
    startupId: obj.startupId?.toString() || null,
    approvalStatus: obj.approvalStatus || 'pending',
    approvedBy: obj.approvedBy?.toString() || null,
    approvedAt: obj.approvedAt || null,
    title: obj.title,
    description: obj.description,
    category: obj.category,
    tags: obj.tags,
    status: obj.status,
    visibility: obj.visibility,
    url: obj.url,
    uploadedBy: obj.uploadedBy,
    metadata: {
      ...obj.metadata,
      createdDate: obj.metadata?.createdDate || obj.createdAt,
      modifiedDate: obj.metadata?.modifiedDate || obj.updatedAt,
    },
    variants: (obj.variants || []).map(v => ({
      id: v._id?.toString(),
      parentAssetId: obj._id.toString(),
      version: v.version,
      title: v.title,
      url: v.url,
      uploadedBy: v.uploadedBy,
      correctionReplyTo: v.correctionReplyTo?.toString() || null,
      metadata: {
        ...v.metadata,
        createdDate: v.metadata?.createdDate || v.createdAt,
        modifiedDate: v.metadata?.modifiedDate || v.updatedAt,
      },
    })),
    comments: (obj.comments || []).map(c => ({
      id: c._id?.toString(),
      authorName: c.authorName,
      text: c.text,
      createdAt: c.createdAt,
      replies: (c.replies || []).map(r => ({
        id: r._id?.toString(),
        authorName: r.authorName,
        text: r.text,
        createdAt: r.createdAt,
      })),
      reactions: (c.reactions || []).map(r => ({ userId: r.userId?.toString(), authorName: r.authorName, emoji: r.emoji })),
    })),
    corrections: (obj.corrections || []).map(c => ({
      id: c._id?.toString(),
      authorName: c.authorName,
      text: c.text,
      timestamp: c.timestamp || null,
      status: c.status,
      createdAt: c.createdAt,
    })),
    sharedWith: (obj.sharedWith || []).map(id => id.toString()),
    pendingShareWith: (obj.pendingShareWith || []).map(id => id.toString()),
    ownerId: obj.userId?.toString(),
    isOwner: requestingUserId ? obj.userId?.toString() === requestingUserId.toString() : undefined,
    viewLog: (obj.viewLog || []).map(v => ({ ip: v.ip, userAgent: v.userAgent, viewedAt: v.viewedAt })),
    editLog: (obj.editLog || []).map(e => ({ userId: e.userId?.toString(), name: e.name, email: e.email, accessedAt: e.accessedAt })),
    deleteRequest: obj.deleteRequest ? {
      requestedAt: obj.deleteRequest.requestedAt,
      acceptances: (obj.deleteRequest.acceptances || []).map(id => id.toString()),
    } : null,
  };
};

// POST /api/media/:id/comments
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Comment text is required' });

    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    media.comments.push({ userId: req.user._id, authorName: req.user.name || req.user.email, text: text.trim() });
    await media.save();

    await notifyAll(media, req.user._id, 'media_comment',
      'New Comment',
      `${req.user.name || req.user.email} commented on "${media.title}": "${text.trim().substring(0, 60)}"`,
      { mediaId: media._id, title: media.title, assetTitle: media.title, text: text.trim(), authorName: req.user.name || req.user.email }
    );

    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add comment', details: err.message });
  }
};

// DELETE /api/media/:id/comments/:commentId
exports.deleteComment = async (req, res) => {
  try {
    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    media.comments.pull(req.params.commentId);
    await media.save();
    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

// POST /api/media/:id/comments/:commentId/reply
exports.replyToComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Reply text is required' });

    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    comment.replies.push({ userId: req.user._id, authorName: req.user.name || req.user.email, text: text.trim() });
    await media.save();

    await notifyAll(media, req.user._id, 'media_comment',
      'New Reply',
      `${req.user.name || req.user.email} replied to a comment on "${media.title}".`,
      { mediaId: media._id, title: media.title, assetTitle: media.title, text: text.trim(), authorName: req.user.name || req.user.email }
    );

    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add reply', details: err.message });
  }
};

// POST /api/media/:id/comments/:commentId/react
exports.reactToComment = async (req, res) => {
  try {
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: 'Emoji is required' });

    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const comment = media.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Toggle: remove if same emoji from same user, else add/replace
    const existing = comment.reactions.find(r => r.userId.toString() === req.user._id.toString());
    if (existing) {
      if (existing.emoji === emoji) {
        // Remove reaction
        comment.reactions = comment.reactions.filter(r => r.userId.toString() !== req.user._id.toString());
      } else {
        existing.emoji = emoji;
      }
    } else {
      comment.reactions.push({ userId: req.user._id, authorName: req.user.name || req.user.email, emoji });
    }

    await media.save();
    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to react', details: err.message });
  }
};

// POST /api/media/:id/corrections
exports.addCorrection = async (req, res) => {
  try {
    const { text, timestamp } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Correction text is required' });

    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    media.corrections.push({
      userId: req.user._id,
      authorName: req.user.name || req.user.email,
      text: text.trim(),
      ...(timestamp ? { timestamp } : {}),
    });
    await media.save();

    // Notify the original uploader (Creative) — they need to fix it
    try {
      const { createNotification } = require('../controllers/notificationController');
      const { sendMediaActivityEmail } = require('../services/emailService');
      const User = require('../models/User');

      if (media.userId.toString() !== req.user._id.toString()) {
        await createNotification(
          media.userId, 'media_correction', 'Revision Requested',
          `${req.user.name || req.user.email} requested a correction on "${media.title}": "${text.trim().substring(0, 80)}"`,
          { mediaId: media._id, title: media.title, assetTitle: media.title, text: text.trim(), authorName: req.user.name || req.user.email },
          false
        );
        const uploader = await User.findById(media.userId).select('email name notificationPrefs');
        if (uploader?.email && uploader.notificationPrefs?.galleryAssets) {
          await sendMediaActivityEmail(uploader.email, uploader.name || uploader.email, 'media_correction', {
            assetTitle: media.title, authorName: req.user.name || req.user.email, text: text.trim(),
          }).catch(() => {});
        }
      }
    } catch (e) { /* silent */ }

    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add correction', details: err.message });
  }
};

// PATCH /api/media/:id/corrections/:correctionId/resolve
exports.resolveCorrection = async (req, res) => {
  try {
    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const correction = media.corrections.id(req.params.correctionId);
    if (!correction) return res.status(404).json({ error: 'Correction not found' });

    correction.status = correction.status === 'resolved' ? 'open' : 'resolved';
    await media.save();
    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update correction' });
  }
};

// DELETE /api/media/:id/corrections/:correctionId
exports.deleteCorrection = async (req, res) => {
  try {
    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    media.corrections.pull(req.params.correctionId);
    await media.save();
    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete correction' });
  }
};

// DELETE /api/media/:id/variant/:variantId
exports.deleteVariant = async (req, res) => {
  try {
    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const variant = media.variants.id(req.params.variantId);
    if (!variant) return res.status(404).json({ error: 'Variant not found' });

    // Delete from Cloudinary
    if (variant.publicId) {
      const rt = variant.metadata?.mimeType?.startsWith('video/') ? 'video' : 'image';
      await cloudinary.uploader.destroy(variant.publicId, { resource_type: rt }).catch(() => {});
    }

    media.variants.pull(req.params.variantId);
    await media.save();

    res.json({ success: true, media: formatMedia(media) });
  } catch (err) {
    console.error('Delete variant error:', err);
    res.status(500).json({ error: 'Failed to delete variant' });
  }
};

// DELETE /api/media/:id/view-log — owner clears view log
exports.clearViewLog = async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, userId: req.user.id });
    if (!media) return res.status(404).json({ error: 'Media not found' });
    media.viewLog = [];
    await media.save();
    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear view log' });
  }
};

// PATCH /api/media/:id/approve — Production/Marketing/Executive approves asset
exports.approveAsset = async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved or rejected' });
    }

    const media = await findAccessible(req.params.id, req.user);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    media.approvalStatus = status;
    media.approvedBy = req.user._id;
    media.approvedAt = new Date();
    await media.save();

    // Notify the uploader
    try {
      const { createNotification } = require('../controllers/notificationController');
      if (media.userId.toString() !== req.user._id.toString()) {
        await createNotification(
          media.userId,
          'media_updated',
          status === 'approved' ? 'Asset Approved ✅' : 'Asset Rejected',
          `${req.user.name || req.user.email} marked "${media.title}" as ${status}.`,
          { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email },
          false
        );
      }
    } catch (e) { /* silent */ }

    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve asset' });
  }
};

// POST /api/media/:id/share-with — share asset with specific users (adds to their dashboard)
exports.shareWithUsers = async (req, res) => {
  try {
    const { userIds, email } = req.body;
    const media = await Media.findOne({ _id: req.params.id, userId: req.user.id });
    if (!media) return res.status(404).json({ error: 'Media not found or not your asset' });

    const User = require('../models/User');
    const { createNotification } = require('../controllers/notificationController');
    const { sendMediaActivityEmail } = require('../services/emailService');

    // ── Agency asset: share with specific team members directly ──────────────
    if (media.context === 'agency') {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ error: 'userIds array is required for agency assets' });
      }
      const added = [];
      for (const uid of userIds) {
        if (media.sharedWith.map(id => id.toString()).includes(uid.toString())) continue;
        const target = await User.findById(uid);
        if (!target) continue;
        media.sharedWith.push(uid);
        added.push(target);
        try {
          await createNotification(uid, 'media_updated', 'Asset Shared With You',
            `${req.user.name || req.user.email} shared "${media.title}" with you.`,
            { mediaId: media._id, title: media.title, assetTitle: media.title, sharedBy: req.user.name || req.user.email, authorName: req.user.name || req.user.email },
            false
          );
          await sendMediaActivityEmail(target.email, target.name || target.email, 'media_updated', {
            assetTitle: media.title, authorName: req.user.name || req.user.email, text: `${req.user.name || req.user.email} shared this asset with you.`,
          }).catch(() => {});
        } catch (e) { console.error('Notification error:', e); }
      }
      await media.save();
      return res.json({ success: true, sharedWith: added.map(u => ({ id: u._id, name: u.name, email: u.email })), media: formatMedia(media, req.user._id) });
    }

    // ── Personal asset: invite by email — goes to pending until accepted ─────
    if (!email) return res.status(400).json({ error: 'email is required for personal asset sharing' });

    const target = await User.findOne({ email: email.toLowerCase().trim() });
    if (!target) return res.status(404).json({ error: 'No user found with that email' });
    if (target._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot share with yourself' });
    }

    const alreadyShared = media.sharedWith.map(id => id.toString()).includes(target._id.toString());
    const alreadyPending = media.pendingShareWith.map(id => id.toString()).includes(target._id.toString());

    if (alreadyShared) return res.status(400).json({ error: `${target.name} already has access` });
    if (alreadyPending) return res.status(400).json({ error: `Invite already sent to ${target.name}` });

    media.pendingShareWith.push(target._id);
    await media.save();

    await createNotification(
      target._id, 'media_updated',
      'Asset Share Invitation',
      `${req.user.name || req.user.email} wants to share "${media.title}" with you. Accept to view it in your gallery.`,
      { mediaId: media._id, title: media.title, assetTitle: media.title, sharedBy: req.user.name || req.user.email, authorName: req.user.name || req.user.email, isPendingShare: true },
      false
    );
    await sendMediaActivityEmail(target.email, target.name || target.email, 'media_updated', {
      assetTitle: media.title, authorName: req.user.name || req.user.email, text: `${req.user.name || req.user.email} invited you to access this asset. Log in to accept.`,
    }).catch(() => {});

    res.json({ success: true, message: `Invite sent to ${target.name}`, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to share asset', details: err.message });
  }
};

// POST /api/media/:id/accept-share — accept a personal share invite
exports.acceptShare = async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, pendingShareWith: req.user._id });
    if (!media) return res.status(404).json({ error: 'No pending share invite found' });

    media.pendingShareWith.pull(req.user._id);
    media.sharedWith.push(req.user._id);
    await media.save();

    // Notify the owner
    const { createNotification } = require('../controllers/notificationController');
    await createNotification(
      media.userId, 'media_updated',
      'Share Accepted',
      `${req.user.name || req.user.email} accepted your share invite for "${media.title}".`,
      { mediaId: media._id, title: media.title, assetTitle: media.title, authorName: req.user.name || req.user.email },
      false
    ).catch(() => {});

    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept share', details: err.message });
  }
};

// POST /api/media/:id/decline-share — decline a personal share invite
exports.declineShare = async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, pendingShareWith: req.user._id });
    if (!media) return res.status(404).json({ error: 'No pending share invite found' });
    media.pendingShareWith.pull(req.user._id);
    await media.save();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline share' });
  }
};

// DELETE /api/media/:id/share-with/:userId — revoke access
exports.revokeShare = async (req, res) => {
  try {
    const media = await Media.findOne({ _id: req.params.id, userId: req.user.id });
    if (!media) return res.status(404).json({ error: 'Media not found or not your asset' });

    media.sharedWith.pull(req.params.userId);
    media.pendingShareWith.pull(req.params.userId);
    await media.save();
    res.json({ success: true, media: formatMedia(media, req.user._id) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to revoke share' });
  }
};

// POST /api/media/:id/share
exports.shareMedia = async (req, res) => {
  try {
    const { method, email, phone, message } = req.body;
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ error: 'Media not found' });

    const shareUrl = `${process.env.FRONTEND_URL}/gallery/share/${media._id}`;
    const senderName = req.user.name || req.user.email;

    if (method === 'email') {
      if (!email) return res.status(400).json({ error: 'Email is required' });
      const { sendMediaShareEmail } = require('../services/emailService');
      await sendMediaShareEmail(email, senderName, media.title, media.url, shareUrl, message);
      return res.json({ success: true, message: 'Share email sent successfully' });
    }

    if (method === 'whatsapp') {
      if (!phone) return res.status(400).json({ error: 'Phone number is required' });
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      const body = `${senderName} shared "${media.title}" with you on BMS Engage.\n\n${message ? `"${message}"\n\n` : ''}View it here: ${shareUrl}`;
      await client.messages.create({
        from: process.env.TWILIO_WHATSAPP_FROM,
        to: `whatsapp:${phone}`,
        body,
      });
      return res.json({ success: true, message: 'WhatsApp message sent successfully' });
    }

    if (method === 'link') {
      return res.json({ success: true, shareUrl });
    }

    return res.status(400).json({ error: 'Invalid share method. Use: email, whatsapp, or link' });
  } catch (err) {
    console.error('Share error:', err);
    res.status(500).json({ error: err.message || 'Failed to share media' });
  }
};
