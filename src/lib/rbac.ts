import { UserRole } from '@prisma/client';

import { ForbiddenError } from './api/errors';

// Permission definitions
export const PERMISSIONS = {
  // User permissions
  'user:read': [UserRole.USER, UserRole.ARBITRATOR, UserRole.ADMIN],
  'user:update': [UserRole.USER, UserRole.ARBITRATOR, UserRole.ADMIN],
  'user:delete': [UserRole.ADMIN],

  // Case permissions
  'case:create': [UserRole.USER, UserRole.ADMIN],
  'case:read': [UserRole.USER, UserRole.ARBITRATOR, UserRole.ADMIN],
  'case:update': [UserRole.USER, UserRole.ADMIN],
  'case:delete': [UserRole.ADMIN],

  // Evidence permissions
  'evidence:upload': [UserRole.USER, UserRole.ADMIN],
  'evidence:read': [UserRole.USER, UserRole.ARBITRATOR, UserRole.ADMIN],
  'evidence:delete': [UserRole.USER, UserRole.ADMIN],

  // Statement permissions
  'statement:submit': [UserRole.USER, UserRole.ADMIN],
  'statement:read': [UserRole.USER, UserRole.ARBITRATOR, UserRole.ADMIN],

  // Arbitrator permissions
  'arbitrator:review': [UserRole.ARBITRATOR, UserRole.ADMIN],
  'arbitrator:sign': [UserRole.ARBITRATOR, UserRole.ADMIN],
  'arbitrator:assign': [UserRole.ADMIN],

  // Admin permissions
  'admin:users': [UserRole.ADMIN],
  'admin:cases': [UserRole.ADMIN],
  'admin:settings': [UserRole.ADMIN],
  'admin:audit': [UserRole.ADMIN],
  'admin:payments': [UserRole.ADMIN],
} as const;

export type Permission = keyof typeof PERMISSIONS;

// Check if a role has a specific permission
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const allowedRoles = PERMISSIONS[permission];
  return (allowedRoles as readonly UserRole[]).includes(role);
}

// Check multiple permissions (AND logic)
export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every((permission) => hasPermission(role, permission));
}

// Check multiple permissions (OR logic)
export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some((permission) => hasPermission(role, permission));
}

// Throw if permission not granted
export function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError(`Permission denied: ${permission}`);
  }
}

// Role hierarchy for comparison
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.ARBITRATOR]: 2,
  [UserRole.ADMIN]: 3,
};

// Check if role meets minimum level
export function meetsRoleLevel(role: UserRole, minimumRole: UserRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimumRole];
}

// Get all permissions for a role
export function getRolePermissions(role: UserRole): Permission[] {
  return (Object.entries(PERMISSIONS) as unknown as [Permission, readonly UserRole[]][])
    .filter(([_, roles]) => roles.includes(role))
    .map(([permission]) => permission);
}

// Role display names
export const ROLE_DISPLAY_NAMES: Record<UserRole, string> = {
  [UserRole.USER]: 'User',
  [UserRole.ARBITRATOR]: 'Arbitrator',
  [UserRole.ADMIN]: 'Administrator',
};

// Role descriptions
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  [UserRole.USER]: 'Can create and participate in cases as claimant or respondent',
  [UserRole.ARBITRATOR]: 'Can review cases and sign arbitration awards',
  [UserRole.ADMIN]: 'Full platform access including user and system management',
};
