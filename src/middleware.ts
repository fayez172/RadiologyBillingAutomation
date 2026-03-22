import { withAuth } from 'next-auth/middleware';

export default withAuth({
  callbacks: {
    authorized: ({ token }) => !!token,
  },
});

export const config = {
  matcher: [
    '/((?!login|api/auth|api/health|_next/static|_next/image|favicon.ico).*)',
  ],
};
