const CryptoJS = require('crypto-js');

const SECRET = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback_key_change_me';

/**
 * Encrypt a plaintext token for safe storage in MongoDB.
 */
const encrypt = (plaintext) => {
  if (!plaintext) return null;
  return CryptoJS.AES.encrypt(plaintext, SECRET).toString();
};

/**
 * Decrypt a stored token back to plaintext for API calls.
 */
const decrypt = (ciphertext) => {
  if (!ciphertext) return null;
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET);
    return bytes.toString(CryptoJS.enc.Utf8) || null;
  } catch {
    return null;
  }
};

module.exports = { encrypt, decrypt };
