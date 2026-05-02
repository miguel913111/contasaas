/**
 * Next.js Middleware - Dual Portal Routing
 * 
 * Redireciona utilizadores para o portal correto com base no role.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = request.nextUrl;

  // Rotas publicas
  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhook') ||
    pathname.startsWith('/api/health') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // Nao autenticado → login
  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin', request.url));
  }

  const role = token.role as string;

  // Redirecionamentos de portal
  if (pathname.startsWith('/accountant')) {
    if (role !== 'ACCOUNTANT' && role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/selfservice/dashboard', request.url));
    }
  }

  if (pathname.startsWith('/selfservice')) {
    if (role === 'ACCOUNTANT' || role === 'ADMIN') {
      return NextResponse.redirect(new URL('/accountant/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
