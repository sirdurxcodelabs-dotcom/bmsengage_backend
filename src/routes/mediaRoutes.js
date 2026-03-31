const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const { auth, requirePermission } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');

// Wrap async middleware so unhandled promise rejections go to next(err)
const asyncMw = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Wrap multer so file upload errors return proper JSON (413 for size, 400 for others)
const handleUpload = (multerMw) => (req, res, next) => {
  multerMw(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Videos must be under 2 GB, images/graphics under 100 MB.' });
    }
    return res.status(400).json({ error: err.message || 'File upload failed' });
  });
};

// Public route — no auth needed
router.get('/public/:id', mediaController.getPublicMedia);

// All routes below require auth
router.use(auth);

// Upload single file
router.post('/upload',
  asyncMw(requirePermission('upload_asset')),
  handleUpload(upload.single('file')),
  mediaController.uploadSingle
);

// Upload multiple files
router.post('/upload-multiple',
  asyncMw(requirePermission('upload_asset')),
  handleUpload(upload.array('files', 10)),
  mediaController.uploadMultiple
);

// Add variant
router.post('/:id/variant',
  asyncMw(requirePermission('upload_version')),
  handleUpload(upload.single('file')),
  mediaController.addVariant
);

// Delete a specific variant
router.delete('/:id/variant/:variantId', mediaController.deleteVariant);

// Comments
router.post('/:id/comments', asyncMw(requirePermission('comment')), mediaController.addComment);
router.delete('/:id/comments/:commentId', asyncMw(requirePermission('comment')), mediaController.deleteComment);
router.post('/:id/comments/:commentId/reply', asyncMw(requirePermission('comment')), mediaController.replyToComment);
router.post('/:id/comments/:commentId/react', asyncMw(requirePermission('comment')), mediaController.reactToComment);

// Corrections
router.post('/:id/corrections', asyncMw(requirePermission('request_correction')), mediaController.addCorrection);
router.patch('/:id/corrections/:correctionId/resolve', mediaController.resolveCorrection);
router.delete('/:id/corrections/:correctionId', mediaController.deleteCorrection);

// Delete request flow
router.post('/:id/delete-request', mediaController.requestDelete);
router.post('/:id/delete-request/accept', mediaController.acceptDeleteRequest);

// CRUD
router.get('/', mediaController.getMedia);
router.get('/:id', mediaController.getMediaById);
router.patch('/:id', asyncMw(requirePermission('upload_asset')), mediaController.updateMedia);
router.delete('/:id', mediaController.deleteMedia);
router.post('/:id/share', mediaController.shareMedia);
router.post('/:id/share-with', mediaController.shareWithUsers);
router.delete('/:id/share-with/:userId', mediaController.revokeShare);
router.post('/:id/accept-share', mediaController.acceptShare);
router.post('/:id/decline-share', mediaController.declineShare);

// Approval workflow
router.patch('/:id/approve', asyncMw(requirePermission('approve_asset')), mediaController.approveAsset);

// View log
router.delete('/:id/view-log', mediaController.clearViewLog);

module.exports = router;
