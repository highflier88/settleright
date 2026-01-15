/**
 * RBAC (Role-Based Access Control) Tests
 *
 * Tests for permission checking and role management.
 */

import { UserRole } from '@prisma/client';
import { ForbiddenError } from '@/lib/api/errors';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  requirePermission,
  meetsRoleLevel,
  getRolePermissions,
  PERMISSIONS,
  ROLE_DISPLAY_NAMES,
  ROLE_DESCRIPTIONS,
} from '@/lib/rbac';

describe('RBAC Service', () => {
  // ==========================================================================
  // hasPermission
  // ==========================================================================

  describe('hasPermission', () => {
    describe('USER role', () => {
      it('should have user:read permission', () => {
        expect(hasPermission(UserRole.USER, 'user:read')).toBe(true);
      });

      it('should have case:create permission', () => {
        expect(hasPermission(UserRole.USER, 'case:create')).toBe(true);
      });

      it('should have evidence:upload permission', () => {
        expect(hasPermission(UserRole.USER, 'evidence:upload')).toBe(true);
      });

      it('should NOT have user:delete permission', () => {
        expect(hasPermission(UserRole.USER, 'user:delete')).toBe(false);
      });

      it('should NOT have arbitrator:review permission', () => {
        expect(hasPermission(UserRole.USER, 'arbitrator:review')).toBe(false);
      });

      it('should NOT have admin permissions', () => {
        expect(hasPermission(UserRole.USER, 'admin:users')).toBe(false);
        expect(hasPermission(UserRole.USER, 'admin:cases')).toBe(false);
        expect(hasPermission(UserRole.USER, 'admin:settings')).toBe(false);
      });
    });

    describe('ARBITRATOR role', () => {
      it('should have user:read permission', () => {
        expect(hasPermission(UserRole.ARBITRATOR, 'user:read')).toBe(true);
      });

      it('should have arbitrator:review permission', () => {
        expect(hasPermission(UserRole.ARBITRATOR, 'arbitrator:review')).toBe(true);
      });

      it('should have arbitrator:sign permission', () => {
        expect(hasPermission(UserRole.ARBITRATOR, 'arbitrator:sign')).toBe(true);
      });

      it('should NOT have case:create permission', () => {
        expect(hasPermission(UserRole.ARBITRATOR, 'case:create')).toBe(false);
      });

      it('should NOT have admin permissions', () => {
        expect(hasPermission(UserRole.ARBITRATOR, 'admin:users')).toBe(false);
        expect(hasPermission(UserRole.ARBITRATOR, 'admin:cases')).toBe(false);
      });
    });

    describe('ADMIN role', () => {
      it('should have all permissions', () => {
        const allPermissions = Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[];
        allPermissions.forEach((permission) => {
          expect(hasPermission(UserRole.ADMIN, permission)).toBe(true);
        });
      });
    });
  });

  // ==========================================================================
  // hasAllPermissions
  // ==========================================================================

  describe('hasAllPermissions', () => {
    it('should return true when user has all permissions', () => {
      expect(
        hasAllPermissions(UserRole.USER, ['user:read', 'case:create', 'evidence:upload'])
      ).toBe(true);
    });

    it('should return false when user lacks any permission', () => {
      expect(
        hasAllPermissions(UserRole.USER, ['user:read', 'admin:users'])
      ).toBe(false);
    });

    it('should return true for empty permissions array', () => {
      expect(hasAllPermissions(UserRole.USER, [])).toBe(true);
    });

    it('should work for admin with all permissions', () => {
      expect(
        hasAllPermissions(UserRole.ADMIN, [
          'user:read',
          'admin:users',
          'arbitrator:review',
        ])
      ).toBe(true);
    });
  });

  // ==========================================================================
  // hasAnyPermission
  // ==========================================================================

  describe('hasAnyPermission', () => {
    it('should return true when user has any of the permissions', () => {
      expect(
        hasAnyPermission(UserRole.USER, ['user:read', 'admin:users'])
      ).toBe(true);
    });

    it('should return false when user has none of the permissions', () => {
      expect(
        hasAnyPermission(UserRole.USER, ['admin:users', 'admin:settings'])
      ).toBe(false);
    });

    it('should return false for empty permissions array', () => {
      expect(hasAnyPermission(UserRole.USER, [])).toBe(false);
    });

    it('should work for arbitrator', () => {
      expect(
        hasAnyPermission(UserRole.ARBITRATOR, ['arbitrator:review', 'admin:users'])
      ).toBe(true);
    });
  });

  // ==========================================================================
  // requirePermission
  // ==========================================================================

  describe('requirePermission', () => {
    it('should not throw when permission is granted', () => {
      expect(() => requirePermission(UserRole.USER, 'user:read')).not.toThrow();
    });

    it('should throw ForbiddenError when permission is denied', () => {
      expect(() => requirePermission(UserRole.USER, 'admin:users')).toThrow(
        ForbiddenError
      );
    });

    it('should include permission name in error message', () => {
      expect(() => requirePermission(UserRole.USER, 'admin:users')).toThrow(
        /admin:users/
      );
    });

    it('should work for admin permissions', () => {
      expect(() => requirePermission(UserRole.ADMIN, 'admin:users')).not.toThrow();
    });
  });

  // ==========================================================================
  // meetsRoleLevel
  // ==========================================================================

  describe('meetsRoleLevel', () => {
    it('should return true when role equals minimum', () => {
      expect(meetsRoleLevel(UserRole.USER, UserRole.USER)).toBe(true);
      expect(meetsRoleLevel(UserRole.ARBITRATOR, UserRole.ARBITRATOR)).toBe(true);
      expect(meetsRoleLevel(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
    });

    it('should return true when role exceeds minimum', () => {
      expect(meetsRoleLevel(UserRole.ARBITRATOR, UserRole.USER)).toBe(true);
      expect(meetsRoleLevel(UserRole.ADMIN, UserRole.USER)).toBe(true);
      expect(meetsRoleLevel(UserRole.ADMIN, UserRole.ARBITRATOR)).toBe(true);
    });

    it('should return false when role is below minimum', () => {
      expect(meetsRoleLevel(UserRole.USER, UserRole.ARBITRATOR)).toBe(false);
      expect(meetsRoleLevel(UserRole.USER, UserRole.ADMIN)).toBe(false);
      expect(meetsRoleLevel(UserRole.ARBITRATOR, UserRole.ADMIN)).toBe(false);
    });
  });

  // ==========================================================================
  // getRolePermissions
  // ==========================================================================

  describe('getRolePermissions', () => {
    it('should return all permissions for USER role', () => {
      const permissions = getRolePermissions(UserRole.USER);

      expect(permissions).toContain('user:read');
      expect(permissions).toContain('case:create');
      expect(permissions).toContain('evidence:upload');
      expect(permissions).not.toContain('admin:users');
    });

    it('should return arbitrator permissions for ARBITRATOR role', () => {
      const permissions = getRolePermissions(UserRole.ARBITRATOR);

      expect(permissions).toContain('arbitrator:review');
      expect(permissions).toContain('arbitrator:sign');
      expect(permissions).not.toContain('case:create');
    });

    it('should return all permissions for ADMIN role', () => {
      const permissions = getRolePermissions(UserRole.ADMIN);
      const allPermissions = Object.keys(PERMISSIONS);

      expect(permissions.length).toBe(allPermissions.length);
    });

    it('should return an array of permission strings', () => {
      const permissions = getRolePermissions(UserRole.USER);

      expect(Array.isArray(permissions)).toBe(true);
      permissions.forEach((permission) => {
        expect(typeof permission).toBe('string');
        expect(permission).toMatch(/^\w+:\w+$/);
      });
    });
  });

  // ==========================================================================
  // Constants
  // ==========================================================================

  describe('Constants', () => {
    describe('PERMISSIONS', () => {
      it('should define user permissions', () => {
        expect(PERMISSIONS['user:read']).toBeDefined();
        expect(PERMISSIONS['user:update']).toBeDefined();
        expect(PERMISSIONS['user:delete']).toBeDefined();
      });

      it('should define case permissions', () => {
        expect(PERMISSIONS['case:create']).toBeDefined();
        expect(PERMISSIONS['case:read']).toBeDefined();
        expect(PERMISSIONS['case:update']).toBeDefined();
        expect(PERMISSIONS['case:delete']).toBeDefined();
      });

      it('should define admin permissions', () => {
        expect(PERMISSIONS['admin:users']).toBeDefined();
        expect(PERMISSIONS['admin:cases']).toBeDefined();
        expect(PERMISSIONS['admin:settings']).toBeDefined();
        expect(PERMISSIONS['admin:audit']).toBeDefined();
        expect(PERMISSIONS['admin:payments']).toBeDefined();
      });
    });

    describe('ROLE_DISPLAY_NAMES', () => {
      it('should have display names for all roles', () => {
        expect(ROLE_DISPLAY_NAMES[UserRole.USER]).toBe('User');
        expect(ROLE_DISPLAY_NAMES[UserRole.ARBITRATOR]).toBe('Arbitrator');
        expect(ROLE_DISPLAY_NAMES[UserRole.ADMIN]).toBe('Administrator');
      });
    });

    describe('ROLE_DESCRIPTIONS', () => {
      it('should have descriptions for all roles', () => {
        expect(ROLE_DESCRIPTIONS[UserRole.USER]).toBeDefined();
        expect(ROLE_DESCRIPTIONS[UserRole.ARBITRATOR]).toBeDefined();
        expect(ROLE_DESCRIPTIONS[UserRole.ADMIN]).toBeDefined();
      });

      it('should have meaningful descriptions', () => {
        expect(ROLE_DESCRIPTIONS[UserRole.USER].length).toBeGreaterThan(10);
        expect(ROLE_DESCRIPTIONS[UserRole.ARBITRATOR].length).toBeGreaterThan(10);
        expect(ROLE_DESCRIPTIONS[UserRole.ADMIN].length).toBeGreaterThan(10);
      });
    });
  });
});
