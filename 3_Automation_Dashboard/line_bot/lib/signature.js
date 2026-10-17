const crypto = require('crypto');

/** LINE signs the raw request body with HMAC-SHA256 and base64. */
function signBody(rawBody, channelSecret) {
  const buf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  return crypto.createHmac('sha256', channelSecret).update(buf).digest('base64');
}

function verifySignature(rawBody, signature, channelSecret) {
  if (!channelSecret || !signature || rawBody == null) return false;
  const expected = signBody(rawBody, channelSecret);
  const a = Buffer.from(String(signature));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

module.exports = { signBody, verifySignature };
