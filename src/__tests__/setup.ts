/**
 * Jest Test Setup
 *
 * Global setup for all tests including mocks and environment configuration.
 */

import { resetSequence } from './factories/utils';

// Mock environment variables
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_mock';
process.env.CLERK_SECRET_KEY = 'sk_test_mock';
process.env.BLOB_READ_WRITE_TOKEN = 'mock_token';
process.env.ANTHROPIC_API_KEY = 'mock_api_key';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_mock';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
process.env.SENDGRID_API_KEY = 'SG.mock_key';
process.env.TWILIO_ACCOUNT_SID = 'AC_mock';
process.env.TWILIO_AUTH_TOKEN = 'mock_token';

// Increase default timeout for async operations
jest.setTimeout(30000);

// Suppress console output in tests (can be overridden per test)
const originalConsole = { ...console };
beforeAll(() => {
  // Suppress console.log and console.error in tests
  // Comment out these lines to see console output during debugging
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
});

beforeEach(() => {
  // Reset sequence counter before each test
  resetSequence();
  // Clear all mocks
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
});

// Custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within range ${floor} - ${ceiling}`,
        pass: false,
      };
    }
  },
  toBeValidCuid(received: string) {
    const cuidPattern = /^c[a-z0-9]{24}$/;
    const pass = cuidPattern.test(received);
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid CUID`
          : `expected ${received} to be a valid CUID`,
      pass,
    };
  },
  toBeISODate(received: string) {
    const date = new Date(received);
    const pass = !isNaN(date.getTime()) && received === date.toISOString();
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid ISO date`
          : `expected ${received} to be a valid ISO date`,
      pass,
    };
  },
});

// Type declarations for custom matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
      toBeValidCuid(): R;
      toBeISODate(): R;
    }
  }
}
