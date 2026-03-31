const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VIDEO_MAX = 2 * 1024 * 1024 * 1024; // 2 GB

// Validate by file extension — MIME types for design files are unreliable across OSes
const ALLOWED_MEDIA_EXTS = new Set([
  // Images
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'avif', 'heic', 'heif', 'ico',
  // Design / graphics
  'psd', 'psb', 'ai', 'eps', 'indd', 'indt', 'xd', 'sketch', 'fig',
  'afdesign', 'afphoto', 'cdr', 'xcf', 'raw', 'cr2', 'nef', 'arw', 'dng',
  // Documents
  'pdf',
  // Video
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', '3gp', 'flv', 'wmv', 'ogv', 'm4v', 'ts',
]);

const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', '3gp', 'flv', 'wmv', 'ogv', 'm4v', 'ts']);

const getExt = (filename = '') => (filename.split('.').pop() || '').toLowerCase();

// ── Media upload (all types) ──────────────────────────────────────────────────
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (_req, file) => {
    const ext = getExt(file.originalname);
    const isVideo = VIDEO_EXTS.has(ext) || file.mimetype.startsWith('video/');
    const isImage = !isVideo && file.mimetype.startsWith('image/');
    return {
      folder: 'bmsengage/media',
      // Images → image, videos → video, everything else (PSD, AI, PDF, RAW…) → raw
      resource_type: isVideo ? 'video' : isImage ? 'image' : 'raw',
      transformation: isImage ? [{ quality: 'auto', fetch_format: 'auto' }] : [],
    };
  },
});

const upload = multer({
  storage,
  limits: { fileSize: VIDEO_MAX }, // 2 GB ceiling; design files are typically much smaller
  fileFilter: (_req, file, cb) => {
    const ext = getExt(file.originalname);
    if (!ALLOWED_MEDIA_EXTS.has(ext)) {
      return cb(new Error(`Unsupported file type: .${ext || 'unknown'}`));
    }
    cb(null, true);
  },
});

// ── Avatar upload (images only) ───────────────────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bmsengage/avatars',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    cb(null, true);
  },
});

// ── Agency logo upload (images only) ─────────────────────────────────────────
const agencyLogoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bmsengage/agency_logos',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});

const uploadAgencyLogo = multer({
  storage: agencyLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed for agency logo'));
    }
    cb(null, true);
  },
});

// ── Startup logo upload (images only) ────────────────────────────────────────
const startupLogoStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'bmsengage/startup_logos',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'],
    transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});

const uploadStartupLogo = multer({
  storage: startupLogoStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    cb(null, true);
  },
});

module.exports = { cloudinary, upload, uploadAvatar, uploadAgencyLogo, uploadStartupLogo };
