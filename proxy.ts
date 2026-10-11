import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Salawat-Client, X-Salawat-Player',
  'Access-Control-Max-Age': '86400',
};

export function proxy(request: NextRequest) {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: CORS });
  }
  const response = NextResponse.next();
  for (const [key, value] of Object.entries(CORS)) response.headers.set(key, value);
  return response;
}

export const config = {
  matcher: '/api/:path*',
};
