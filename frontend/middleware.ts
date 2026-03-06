import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow /admin/login through unconditionally — prevents redirect loop.
  if (pathname.startsWith('/admin/login')) {
    return NextResponse.next();
  }

  // Check for admin_token cookie on all other /admin/* paths.
  const token = request.cookies.get('admin_token');

  if (!token) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
