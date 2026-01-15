/**
 * Integration Test Helpers
 *
 * Utilities for integration testing API routes.
 */

import { NextRequest } from 'next/server';
import type { UserRole } from '@prisma/client';

/**
 * Mock user for authenticated requests
 */
export interface MockUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

/**
 * Create a default mock user
 */
export function createMockUser(overrides?: Partial<MockUser>): MockUser {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    role: 'USER',
    ...overrides,
  };
}

/**
 * Create a mock admin user
 */
export function createMockAdmin(overrides?: Partial<MockUser>): MockUser {
  return createMockUser({
    id: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    role: 'ADMIN',
    ...overrides,
  });
}

/**
 * Create a mock arbitrator user
 */
export function createMockArbitrator(overrides?: Partial<MockUser>): MockUser {
  return createMockUser({
    id: 'arb-123',
    email: 'arbitrator@example.com',
    name: 'Judge Arbitrator',
    role: 'ARBITRATOR',
    ...overrides,
  });
}

/**
 * Create a NextRequest object for testing
 */
export function createTestRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const { method = 'GET', body, headers = {} } = options || {};

  const requestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body && method !== 'GET' ? JSON.stringify(body) : undefined,
  };

  return new NextRequest(new URL(url, 'http://localhost:3000'), requestInit);
}

/**
 * Parse JSON response from API route handler
 */
export async function parseResponse<T = unknown>(
  response: Response
): Promise<{ status: number; data: T }> {
  const status = response.status;
  const data = (await response.json()) as T;
  return { status, data };
}

/**
 * Generate a unique ID for testing
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * Mock case data factory
 */
export function createMockCase(overrides?: Record<string, unknown>) {
  return {
    id: generateTestId('case'),
    referenceNumber: `SR-2026-${Math.random().toString(36).substring(7).toUpperCase()}`,
    claimantId: 'user-123',
    respondentId: 'user-456',
    status: 'PENDING_RESPONDENT',
    disputeType: 'CONTRACT',
    jurisdiction: 'US-CA',
    amount: 5000,
    description: 'Test dispute description',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock payment data factory
 */
export function createMockPayment(overrides?: Record<string, unknown>) {
  return {
    id: generateTestId('pay'),
    caseId: 'case-123',
    userId: 'user-123',
    type: 'FILING_FEE',
    amount: 99,
    currency: 'usd',
    status: 'PENDING',
    stripeSessionId: `cs_test_${Math.random().toString(36).substring(7)}`,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock award data factory
 */
export function createMockAward(overrides?: Record<string, unknown>) {
  return {
    id: generateTestId('award'),
    caseId: 'case-123',
    referenceNumber: `AWD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-00001`,
    findingsOfFact: [{ number: 1, finding: 'Test finding', supportingEvidence: ['doc1.pdf'] }],
    conclusionsOfLaw: [{ number: 1, conclusion: 'Test conclusion', legalBasis: 'Contract law' }],
    decision: 'Claimant prevails',
    awardAmount: 5000,
    prevailingParty: 'CLAIMANT',
    arbitratorId: 'arb-123',
    signedAt: new Date(),
    issuedAt: new Date(),
    documentUrl: 'https://storage.example.com/awards/test.pdf',
    documentHash: 'sha256:abc123',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Mock draft award data factory
 */
export function createMockDraftAward(overrides?: Record<string, unknown>) {
  return {
    id: generateTestId('draft'),
    caseId: 'case-123',
    version: 1,
    status: 'APPROVED',
    findingsOfFact: [{ number: 1, finding: 'Test finding', supportingEvidence: ['doc1.pdf'] }],
    conclusionsOfLaw: [{ number: 1, conclusion: 'Test conclusion', legalBasis: 'Contract law' }],
    decision: 'Claimant prevails',
    awardAmount: 5000,
    prevailingParty: 'CLAIMANT',
    generatedAt: new Date(),
    reviewedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Wait helper for async operations
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
