/**
 * User Factory
 *
 * Creates mock User objects for testing.
 */

import { generateId, randomEmail, randomPhone, randomDate } from './utils';

export interface UserFactoryOptions {
  id?: string;
  email?: string;
  name?: string;
  role?: 'USER' | 'ARBITRATOR' | 'ADMIN';
  emailVerified?: boolean;
  phoneVerified?: boolean;
  isActive?: boolean;
  createdAt?: Date;
}

export interface ArbitratorProfileFactoryOptions {
  userId?: string;
  barNumber?: string;
  barState?: string;
  isRetiredJudge?: boolean;
  yearsExperience?: number;
  specializations?: string[];
  jurisdictions?: string[];
  isVerified?: boolean;
}

/**
 * Create a mock User
 */
export function createUser(options: UserFactoryOptions = {}) {
  const id = options.id ?? generateId();
  const name = options.name ?? `Test User ${id.slice(-4)}`;
  const createdAt = options.createdAt ?? new Date();

  return {
    id,
    clerkId: `clerk_${id}`,
    email: options.email ?? randomEmail(name),
    name,
    phone: randomPhone(),
    role: options.role ?? 'USER',
    emailVerified: options.emailVerified ?? true,
    phoneVerified: options.phoneVerified ?? false,
    isActive: options.isActive ?? true,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
  };
}

/**
 * Create a mock Claimant (USER role)
 */
export function createClaimant(options: Omit<UserFactoryOptions, 'role'> = {}) {
  return createUser({ ...options, role: 'USER', name: options.name ?? 'Test Claimant' });
}

/**
 * Create a mock Respondent (USER role)
 */
export function createRespondent(options: Omit<UserFactoryOptions, 'role'> = {}) {
  return createUser({ ...options, role: 'USER', name: options.name ?? 'Test Respondent' });
}

/**
 * Create a mock Arbitrator (ARBITRATOR role)
 */
export function createArbitrator(options: Omit<UserFactoryOptions, 'role'> = {}) {
  return createUser({
    ...options,
    role: 'ARBITRATOR',
    name: options.name ?? 'Hon. Test Arbitrator',
    emailVerified: true,
  });
}

/**
 * Create a mock Admin (ADMIN role)
 */
export function createAdmin(options: Omit<UserFactoryOptions, 'role'> = {}) {
  return createUser({
    ...options,
    role: 'ADMIN',
    name: options.name ?? 'Admin User',
    emailVerified: true,
  });
}

/**
 * Create a mock ArbitratorProfile
 */
export function createArbitratorProfile(options: ArbitratorProfileFactoryOptions = {}) {
  const userId = options.userId ?? generateId();
  const createdAt = new Date();

  return {
    id: generateId(),
    userId,
    barNumber: options.barNumber ?? `BAR${Math.floor(Math.random() * 900000) + 100000}`,
    barState: options.barState ?? 'CA',
    isRetiredJudge: options.isRetiredJudge ?? false,
    yearsExperience: options.yearsExperience ?? 15,
    lawSchool: 'Test Law School',
    graduationYear: 2000,
    specializations: options.specializations ?? ['Contract Disputes', 'Consumer Protection'],
    jurisdictions: options.jurisdictions ?? ['US-CA', 'US-NY'],
    availabilityStatus: 'AVAILABLE',
    maxConcurrentCases: 10,
    currentCaseload: 3,
    totalCasesHandled: 150,
    averageReviewTimeHours: 4.5,
    approvalRate: 0.92,
    modificationRate: 0.05,
    escalationRate: 0.03,
    credentialVerifiedAt: options.isVerified ? randomDate() : null,
    onboardedAt: randomDate(),
    createdAt,
    updatedAt: createdAt,
  };
}

/**
 * Create a user with arbitrator profile
 */
export function createArbitratorWithProfile(
  userOptions: Omit<UserFactoryOptions, 'role'> = {},
  profileOptions: Omit<ArbitratorProfileFactoryOptions, 'userId'> = {}
) {
  const user = createArbitrator(userOptions);
  const profile = createArbitratorProfile({ ...profileOptions, userId: user.id });
  return { user, profile };
}
