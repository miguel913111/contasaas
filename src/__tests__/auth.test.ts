import { describe, it, expect } from 'vitest';
import { isAccountant, isSelfService, isAdmin, canAccessCompany } from '@/lib/auth';
import { UserRole } from '@/types';

describe('Auth Helpers', () => {
  describe('isAccountant', () => {
    it('retorna true para ACCOUNTANT', () => {
      expect(isAccountant(UserRole.ACCOUNTANT)).toBe(true);
    });

    it('retorna true para ADMIN', () => {
      expect(isAccountant(UserRole.ADMIN)).toBe(true);
    });

    it('retorna false para SELF_SERVICE', () => {
      expect(isAccountant(UserRole.SELF_SERVICE)).toBe(false);
    });
  });

  describe('isSelfService', () => {
    it('retorna true para SELF_SERVICE', () => {
      expect(isSelfService(UserRole.SELF_SERVICE)).toBe(true);
    });

    it('retorna false para ACCOUNTANT', () => {
      expect(isSelfService(UserRole.ACCOUNTANT)).toBe(false);
    });
  });

  describe('isAdmin', () => {
    it('retorna true para ADMIN', () => {
      expect(isAdmin(UserRole.ADMIN)).toBe(true);
    });

    it('retorna false para ACCOUNTANT', () => {
      expect(isAdmin(UserRole.ACCOUNTANT)).toBe(false);
    });
  });

  describe('canAccessCompany', () => {
    const userId = 'user-123';
    const otherUserId = 'user-456';

    it('ADMIN acede a qualquer empresa', () => {
      expect(canAccessCompany(userId, UserRole.ADMIN, otherUserId, otherUserId)).toBe(true);
    });

    it('ACCOUNTANT acede se for o accountant', () => {
      expect(canAccessCompany(userId, UserRole.ACCOUNTANT, otherUserId, userId)).toBe(true);
    });

    it('ACCOUNTANT nao acede se nao for o accountant', () => {
      expect(canAccessCompany(userId, UserRole.ACCOUNTANT, otherUserId, otherUserId)).toBe(false);
    });

    it('SELF_SERVICE acede se for o owner', () => {
      expect(canAccessCompany(userId, UserRole.SELF_SERVICE, userId, otherUserId)).toBe(true);
    });

    it('SELF_SERVICE nao acede se nao for o owner', () => {
      expect(canAccessCompany(userId, UserRole.SELF_SERVICE, otherUserId, otherUserId)).toBe(false);
    });
  });
});
