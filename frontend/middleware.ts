import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only guard /admin routes — pass through all other paths unconditionally.
  // In production the matcher config (below) ensures this function is only
  // invoked for /admin/:path*, but when called directly in tests it receives
  // arbitrary paths, so we must handle them explicitly.
  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // Allow /admin/login through unconditionally — prevents redirect loop.
  if (pathname.startsWith('/admin/login')) {
    const response = NextResponse.next();
    response.headers.set('x-pathname', pathname);
    return response;
  }

  // Check for admin_token cookie on all other /admin/* paths.
  const token = request.cookies.get('admin_token');

  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated: pass through and inject x-pathname into the response
  // headers so downstream layout components can read the current path
  // without client-side JS.
  const response = NextResponse.next();
  response.headers.set('x-pathname', pathname);
  return response;
}

export const config = {
  matcher: ['/admin/:path*'],
};
