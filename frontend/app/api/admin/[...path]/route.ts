import { NextRequest, NextResponse } from 'next/server';
import { INTERNAL_API_URL } from '@/app/lib/config';

async function proxyAdmin(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const targetUrl = new URL(`${INTERNAL_API_URL}/api/admin/${path.join('/')}`);
  targetUrl.search = request.nextUrl.search;

  const forwardHeaders = new Headers();
  const contentType = request.headers.get('content-type');
  if (contentType) forwardHeaders.set('content-type', contentType);
  // Forward cookie so the backend can validate existing sessions (e.g. /me, logout)
  const cookie = request.headers.get('cookie');
  if (cookie) forwardHeaders.set('cookie', cookie);

  const body = ['GET', 'HEAD'].includes(request.method)
    ? undefined
    : await request.blob();

  const backendRes = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: forwardHeaders,
    body,
  });

  const responseHeaders = new Headers();
  // Explicitly forward Set-Cookie so the admin_token cookie lands on the
  // Vercel domain (staging.nammadaari.com) — Next.js rewrites() silently
  // drops Set-Cookie, which is why the rewrite alone didn't work.
  const setCookie = backendRes.headers.get('set-cookie');
  if (setCookie) responseHeaders.set('set-cookie', setCookie);
  const ct = backendRes.headers.get('content-type');
  if (ct) responseHeaders.set('content-type', ct);

  return new NextResponse(await backendRes.arrayBuffer(), {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(req: NextRequest, ctx: RouteContext) {
  return proxyAdmin(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: RouteContext) {
  return proxyAdmin(req, (await ctx.params).path);
}
export async function PUT(req: NextRequest, ctx: RouteContext) {
  return proxyAdmin(req, (await ctx.params).path);
}
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  return proxyAdmin(req, (await ctx.params).path);
}
export async function DELETE(req: NextRequest, ctx: RouteContext) {
  return proxyAdmin(req, (await ctx.params).path);
}
