import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, verifySessionToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const protectedPaths = ['/', '/calendar'];
  if (protectedPaths.includes(request.nextUrl.pathname)) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (!session) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/calendar'],
};

