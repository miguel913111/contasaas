/**
 * NextAuth.js v4 com RBAC Dual Portal
 * 
 * Portais:
 * - ACCOUNTANT: Gerencia multiplos clientes
 * - SELF_SERVICE: Um cliente (ENI)
 * - ADMIN: Acesso total
 */

import { NextAuthOptions } from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import GoogleProvider from 'next-auth/providers/google';
import { prisma } from './prisma';
import { UserRole } from '@/types';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      // Primeiro login: define role default
      if (account?.provider === 'google') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
        });

        if (!existingUser) {
          // Novo utilizador: default SELF_SERVICE
          // Pode ser alterado manualmente na DB ou via onboarding
          await prisma.user.create({
            data: {
              email: user.email!,
              name: user.name,
              image: user.image,
              role: 'SELF_SERVICE',
            },
          });
        }
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 dias
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// ============================================================
// HELPERS DE AUTORIZACAO
// ============================================================

export function isAccountant(role?: UserRole): boolean {
  return role === UserRole.ACCOUNTANT || role === UserRole.ADMIN;
}

export function isSelfService(role?: UserRole): boolean {
  return role === UserRole.SELF_SERVICE;
}

export function isAdmin(role?: UserRole): boolean {
  return role === UserRole.ADMIN;
}

export function canAccessCompany(
  userId: string,
  userRole: UserRole,
  companyOwnerId?: string,
  companyAccountantId?: string
): boolean {
  if (userRole === UserRole.ADMIN) return true;
  if (userRole === UserRole.ACCOUNTANT && companyAccountantId === userId) return true;
  if (userRole === UserRole.SELF_SERVICE && companyOwnerId === userId) return true;
  return false;
}

// ============================================================
// HELPERS DE COMPANY
// ============================================================

/**
 * Obtem o companyId do utilizador logado.
 * - ENI (SELF_SERVICE): retorna a empresa onde é owner
 * - ACCOUNTANT: retorna a PRIMEIRA empresa onde é accountant (para fluxos single-company)
 * - Retorna null se nao encontrar empresa
 */
export async function getCurrentCompanyId(
  userId: string,
  role: UserRole
): Promise<string | null> {
  if (role === UserRole.SELF_SERVICE) {
    const company = await prisma.company.findFirst({
      where: { ownerId: userId },
      select: { id: true },
    });
    return company?.id || null;
  }

  if (role === UserRole.ACCOUNTANT) {
    const company = await prisma.company.findFirst({
      where: { accountantId: userId },
      select: { id: true },
    });
    return company?.id || null;
  }

  return null;
}

/**
 * Lista todas as empresas acessiveis pelo utilizador
 */
export async function getAccessibleCompanies(
  userId: string,
  role: UserRole
) {
  if (role === UserRole.ADMIN) {
    return prisma.company.findMany({
      select: { id: true, name: true, nif: true },
      orderBy: { name: 'asc' },
    });
  }

  if (role === UserRole.ACCOUNTANT) {
    return prisma.company.findMany({
      where: { accountantId: userId },
      select: { id: true, name: true, nif: true },
      orderBy: { name: 'asc' },
    });
  }

  return prisma.company.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true, nif: true },
    orderBy: { name: 'asc' },
  });
}
