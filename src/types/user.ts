/**
 * User-related types that can be used in both server and client components.
 * These mirror the Prisma enums but are safe for client-side use.
 */

export type UserRole = 'USER' | 'ARBITRATOR' | 'ADMIN';

export const UserRoles = {
  USER: 'USER',
  ARBITRATOR: 'ARBITRATOR',
  ADMIN: 'ADMIN',
} as const;
