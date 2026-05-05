import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      // Exclude ingest from auth redirect
      if (req.nextUrl.pathname.startsWith('/api/ingest')) return true;
      return !!token;
    },
  },
});

export const config = {
  matcher: [
    '/((?!api/ingest|api/auth|api/health|api/cron|login|_next/static|_next/image|favicon.ico).*)',
  ],
};
