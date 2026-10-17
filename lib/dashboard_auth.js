const crypto = require('crypto');

// Every request runs through middleware.js. These paths stay open:
// LINE must reach the webhook with no browser login, and /api/review
// already checks its own signed token. Vercel platform paths are not ours.
const OPEN_PREFIXES = ['/api/webhook', '/api/review', '/_vercel', '/_next'];

const HIDDEN = [
  /^\/line_bot(?:\/|$)/i,
  /^\/3_Automation_Dashboard\/line_bot(?:\/|$)/i,
];

const INTERNAL_HEADER = 'x-dashboard-internal-token';
const DEFAULT_USER = 'somsaijai';
const NOT_CONFIGURED = 'Dashboard password not configured';
const AUTH_REQUIRED = 'Authentication required';

// Kept in middleware.js config.matcher as a literal. Matching every path is
// deliberate: a negative-lookahead matcher can forget a new static file.
const MATCHER = '/(.*)';

function normalizePath(pathname) {
  let value = String(pathname || '/');
  try {
    value = decodeURIComponent(value);
  } catch (err) {
    // Keep the raw pathname when percent-encoding is invalid.
  }
  const parts = [];
  for (const part of value.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return `/${parts.join('/')}`;
}

function isHidden(pathname) {
  return HIDDEN.some(pattern => pattern.test(pathname));
}

function isOpen(pathname) {
  return OPEN_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function matcherRuns(pathname) {
  return new RegExp(`^${MATCHER}$`).test(pathname);
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a), 'utf8');
  const right = Buffer.from(String(b), 'utf8');
  const length = Math.max(left.length, right.length, 1);
  const aBuf = Buffer.alloc(length);
  const bBuf = Buffer.alloc(length);
  left.copy(aBuf);
  right.copy(bBuf);
  return crypto.timingSafeEqual(aBuf, bBuf) && left.length === right.length;
}

function basicPayload(authorization) {
  const header = String(authorization || '').trim();
  const match = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(header);
  if (!match) return null;
  return Buffer.from(match[1], 'base64').toString('utf8');
}

function textHeaders(status) {
  const headers = {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-store',
    'x-robots-tag': 'noindex',
  };
  if (status === 401) {
    headers['www-authenticate'] = 'Basic realm="SomSaiJai", charset="UTF-8"';
  }
  return headers;
}

function deny(status, body) {
  return { allow: false, status, body, headers: textHeaders(status) };
}

/**
 * Decide whether a request may continue.
 * Production with no DASHBOARD_PASSWORD fails closed (503).
 * Preview and local stay closed too, unless DASHBOARD_AUTH_DISABLED is exactly
 * "1". That flag is ignored on production.
 */
function authorize({ pathname, authorization, internalToken, env }) {
  const path = normalizePath(pathname);
  const source = env || {};
  if (isHidden(path)) {
    return deny(404, 'Not Found');
  }
  if (isOpen(path)) {
    return { allow: true, pathname: path };
  }
  const password = source.DASHBOARD_PASSWORD || '';
  const production = source.VERCEL_ENV === 'production';
  if (production && !password) {
    return deny(503, NOT_CONFIGURED);
  }
  if (!production && source.DASHBOARD_AUTH_DISABLED === '1') {
    return { allow: true, pathname: path };
  }
  const expectedToken = source.DASHBOARD_INTERNAL_TOKEN || '';
  if (expectedToken && safeEqual(internalToken || '', expectedToken)) {
    return { allow: true, pathname: path };
  }
  if (!password) {
    return deny(401, AUTH_REQUIRED);
  }
  const user = source.DASHBOARD_USER || DEFAULT_USER;
  const provided = basicPayload(authorization);
  const matches = safeEqual(provided == null ? '' : provided, `${user}:${password}`);
  if (provided == null || !matches) {
    return deny(401, AUTH_REQUIRED);
  }
  return { allow: true, pathname: path };
}

function pick(source, camel, upper) {
  if (!source) return '';
  if (source[camel]) return String(source[camel]);
  if (source[upper]) return String(source[upper]);
  return '';
}

/**
 * Headers for a server-side fetch of the live site.
 * The internal token is preferred so the human password is not on that request.
 * Falls back to Basic auth when only DASHBOARD_PASSWORD is set.
 */
function dashboardFetchHeaders(source) {
  const token = pick(source, 'dashboardInternalToken', 'DASHBOARD_INTERNAL_TOKEN');
  if (token) return { [INTERNAL_HEADER]: token };
  const password = pick(source, 'dashboardPassword', 'DASHBOARD_PASSWORD');
  if (!password) return {};
  const user = pick(source, 'dashboardUser', 'DASHBOARD_USER') || DEFAULT_USER;
  return {
    Authorization: `Basic ${Buffer.from(`${user}:${password}`, 'utf8').toString('base64')}`,
  };
}

module.exports = {
  INTERNAL_HEADER,
  DEFAULT_USER,
  NOT_CONFIGURED,
  AUTH_REQUIRED,
  MATCHER,
  normalizePath,
  isHidden,
  isOpen,
  matcherRuns,
  safeEqual,
  authorize,
  dashboardFetchHeaders,
};
