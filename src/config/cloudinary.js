const cloudinary = require('cloudinary').v2;
const multer = require('multer');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const VIDEO_MAX = 2 * 1024 * 1024 * 1024; // 2 GB

const ALLOWED_MEDIA_EXTS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif', 'avif', 'heic', 'heif', 'ico',
  'psd', 'psb', 'ai', 'eps', 'indd', 'indt', 'xd', 'sketch', 'fig',
  'afdesign', 'afphoto', 'cdr', 'xcf', 'raw', 'cr2', 'nef', 'arw', 'dng',
  'pdf',
  'mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', '3gp', 'flv', 'wmv', 'ogv', 'm4v', 'ts',
]);

const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv', 'webm', 'mpeg', 'mpg', '3gp', 'flv', 'wmv', 'ogv', 'm4v', 'ts']);

const getExt = (filename = '') => (filename.split('.').pop() || '').toLowerCase();

// ── Memory storage — stream directly to Cloudinary (no disk buffering) ────────
// This avoids Render's memory/timeout issues with large files.
const memStorage = multer.memoryStorage();

const upload = multer({
  storage: memStorage,
  limits: { fileSize: VIDEO_MAX },
  fileFilter: (_req, file, cb) => {
    const ext = getExt(file.originalname);
    if (!ALLOWED_MEDIA_EXTS.has(ext)) return cb(new Error(`Unsupported file type: .${ext || 'unknown'}`));
    cb(null, true);
  },
});

/**
 * Upload a buffer to Cloudinary via upload_stream.
 * Returns the Cloudinary result object.
 */
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => {
      if (err) return reject(err);
      resolve(result);
    });
    stream.end(buffer);
  });
};

/**
 * Process an uploaded file (from multer memoryStorage) and push to Cloudinary.
 * Attaches result to req.file.cloudinaryResult so controllers can use it.
 */
const processUpload = async (req, _res, next) => {
  if (!req.file) return next();
  try {
    const ext = getExt(req.file.originalname);
    const isVideo = VIDEO_EXTS.has(ext) || req.file.mimetype.startsWith('video/');
    const isImage = !isVideo && req.file.mimetype.startsWith('image/');
    const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw';

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'bmsengage/media',
      resource_type: resourceType,
      ...(isImage ? { transformation: [{ quality: 'auto', fetch_format: 'auto' }] } : {}),
    });

    // Mimic multer-storage-cloudinary's interface so controllers don't need changes
    req.file.path = result.secure_url;
    req.file.filename = result.public_id;
    req.file.cloudinaryResult = result;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Same for multiple files.
 */
const processMultiUpload = async (req, _res, next) => {
  if (!req.files || !req.files.length) return next();
  try {
    await Promise.all(req.files.map(async (file) => {
      const ext = getExt(file.originalname);
      const isVideo = VIDEO_EXTS.has(ext) || file.mimetype.startsWith('video/');
      const isImage = !isVideo && file.mimetype.startsWith('image/');
      const resourceType = isVideo ? 'video' : isImage ? 'image' : 'raw';

      const result = await uploadToCloudinary(file.buffer, {
        folder: 'bmsengage/media',
        resource_type: resourceType,
        ...(isImage ? { transformation: [{ quality: 'auto', fetch_format: 'auto' }] } : {}),
      });

      file.path = result.secure_url;
      file.filename = result.public_id;
      file.cloudinaryResult = result;
    }));
    next();
  } catch (err) {
    next(err);
  }
};

// ── Avatar upload ─────────────────────────────────────────────────────────────
const uploadAvatar = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed'));
    cb(null, true);
  },
});

const processAvatarUpload = async (req, _res, next) => {
  if (!req.file) return next();
  try {
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'bmsengage/avatars',
      resource_type: 'image',
      transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto', fetch_format: 'auto' }],
    });
    req.file.path = result.secure_url;
    req.file.filename = result.public_id;
    next();
  } catch (err) { next(err); }
};

// ── Agency logo upload ────────────────────────────────────────────────────────
const uploadAgencyLogo = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed for agency logo'));
    cb(null, true);
  },
});

const processAgencyLogoUpload = async (req, _res, next) => {
  if (!req.file) return next();
  try {
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'bmsengage/agency_logos',
      resource_type: 'image',
      transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    });
    req.file.path = result.secure_url;
    req.file.filename = result.public_id;
    next();
  } catch (err) { next(err); }
};

// ── Startup logo upload ───────────────────────────────────────────────────────
const uploadStartupLogo = multer({
  storage: memStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files allowed'));
    cb(null, true);
  },
});

const processStartupLogoUpload = async (req, _res, next) => {
  if (!req.file) return next();
  try {
    const result = await uploadToCloudinary(req.file.buffer, {
      folder: 'bmsengage/startup_logos',
      resource_type: 'image',
      transformation: [{ width: 400, height: 400, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
    });
    req.file.path = result.secure_url;
    req.file.filename = result.public_id;
    next();
  } catch (err) { next(err); }
};

module.exports = {
  cloudinary,
  upload, processUpload, processMultiUpload,
  uploadAvatar, processAvatarUpload,
  uploadAgencyLogo, processAgencyLogoUpload,
  uploadStartupLogo, processStartupLogoUpload,
  uploadToCloudinary,
};
