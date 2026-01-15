/**
 * Test Data Factories
 *
 * Provides factory functions for creating consistent test data
 * across all test files. Each factory returns realistic mock data
 * that matches Prisma model types.
 */

export * from './user';
export * from './case';
export * from './evidence';
export * from './statement';
export * from './award';
export * from './payment';
export * from './notification';

// Re-export utility functions
export { generateId, generateReferenceNumber, randomDate, randomDecimal } from './utils';
