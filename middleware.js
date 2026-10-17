// Password-protect the static dashboard. /api/webhook and /api/review stay
// open (review has its own signed link). /line_bot and
// /3_Automation_Dashboard/line_bot stay 404. The matcher is every path on
// purpose, so a new file cannot skip the check.
import { next } from '@vercel/functions';
import { authorize } from './lib/dashboard_auth.js';

export default function middleware(request) {
  const url = new URL(request.url);
  const decision = authorize({
    pathname: url.pathname,
    authorization: request.headers.get('authorization'),
    internalToken: request.headers.get('x-dashboard-internal-token'),
    env: process.env,
  });
  if (decision.allow) return next();
  return new Response(decision.body, {
    status: decision.status,
    headers: decision.headers,
  });
}

export const config = {
  runtime: 'nodejs',
  matcher: ['/(.*)'],
};
