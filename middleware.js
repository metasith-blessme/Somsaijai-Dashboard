// Hide the LINE bot source from the public site. Middleware runs before the
// filesystem, so this covers both /line_bot/* and the real files under
// /3_Automation_Dashboard/line_bot/*. The webhook still bundles those files.
const HIDDEN = [
  /^\/line_bot(?:\/|$)/i,
  /^\/3_Automation_Dashboard\/line_bot(?:\/|$)/i,
];

export default function middleware(request) {
  const path = new URL(request.url).pathname;
  if (HIDDEN.some(pattern => pattern.test(path))) {
    return new Response('Not Found', {
      status: 404,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex',
      },
    });
  }
}

export const config = {
  runtime: 'nodejs',
  matcher: [
    '/line_bot',
    '/line_bot/:path*',
    '/3_Automation_Dashboard/line_bot',
    '/3_Automation_Dashboard/line_bot/:path*',
  ],
};
