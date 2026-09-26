const crypto = require('crypto');

const TOKEN_BYTES = Number(process.env.LINK_TOKEN_BYTES) || 12; // 96-bit entropy -> 16 URL-safe chars

// The link never carries identityId, name, mobile number, etc. — only this
// short random token, which IS the request_uuid the server resolves against
// feedback_requests server-side. It is unguessable (96 bits), and expiry is
// enforced by the feedback_requests.expires_at column — no JWT wrapper needed,
// so WhatsApp links stay as short as possible.
function generateFeedbackToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function verifyFeedbackToken(token) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{10,32}$/.test(token)) {
    return { valid: false, reason: 'invalid' };
  }
  return { valid: true, requestUuid: token };
}

module.exports = { generateFeedbackToken, verifyFeedbackToken };