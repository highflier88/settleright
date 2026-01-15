/**
 * Prisma Mock Helpers
 *
 * Provides utilities for mocking Prisma in tests.
 */

import type { PrismaClient } from '@prisma/client';

type MockPrismaClient = {
  [K in keyof PrismaClient]: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
    aggregate: jest.Mock;
    groupBy: jest.Mock;
    upsert: jest.Mock;
  };
} & {
  $transaction: jest.Mock;
  $queryRaw: jest.Mock;
  $executeRaw: jest.Mock;
};

/**
 * Create a fully mocked Prisma client
 */
export function createMockPrismaClient(): MockPrismaClient {
  const createModelMock = () => ({
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    upsert: jest.fn(),
  });

  const mockClient = {
    user: createModelMock(),
    case: createModelMock(),
    evidence: createModelMock(),
    statement: createModelMock(),
    agreement: createModelMock(),
    signature: createModelMock(),
    invitation: createModelMock(),
    payment: createModelMock(),
    notification: createModelMock(),
    notificationPreference: createModelMock(),
    auditLog: createModelMock(),
    award: createModelMock(),
    draftAward: createModelMock(),
    draftAwardRevision: createModelMock(),
    awardEscalation: createModelMock(),
    analysisJob: createModelMock(),
    arbitratorProfile: createModelMock(),
    arbitratorAssignment: createModelMock(),
    arbitratorCompensation: createModelMock(),
    identityVerification: createModelMock(),
    legalDocument: createModelMock(),
    legalDocumentChunk: createModelMock(),
    jurisdictionLawMapping: createModelMock(),
    legalIngestionJob: createModelMock(),
    documentProcessingJob: createModelMock(),
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
  } as unknown as MockPrismaClient;

  // Set up $transaction to pass the mock client to the callback
  (mockClient.$transaction as jest.Mock).mockImplementation((callback: (tx: MockPrismaClient) => unknown) =>
    callback(mockClient)
  );

  return mockClient;
}

/**
 * Reset all mocks on a Prisma client
 */
export function resetPrismaMocks(prisma: MockPrismaClient): void {
  Object.values(prisma).forEach((model) => {
    if (typeof model === 'object' && model !== null) {
      Object.values(model).forEach((method: unknown) => {
        if (typeof method === 'function' && 'mockReset' in method) {
          (method as jest.Mock).mockReset();
        }
      });
    }
  });
}

/**
 * Setup common Prisma mock responses
 */
export function setupPrismaMockResponses(
  prisma: MockPrismaClient,
  responses: {
    [model: string]: {
      [method: string]: unknown;
    };
  }
): void {
  Object.entries(responses).forEach(([model, methods]) => {
    const prismaModel = prisma[model as keyof MockPrismaClient];
    if (prismaModel && typeof prismaModel === 'object') {
      Object.entries(methods).forEach(([method, response]) => {
        const mockMethod = (prismaModel as Record<string, jest.Mock>)[method];
        if (mockMethod && typeof mockMethod.mockResolvedValue === 'function') {
          mockMethod.mockResolvedValue(response);
        }
      });
    }
  });
}
