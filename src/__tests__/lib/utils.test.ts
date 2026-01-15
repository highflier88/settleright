/**
 * Utility Functions Tests
 *
 * Tests for common utility functions.
 */

import {
  cn,
  formatDate,
  formatDateTime,
  formatCurrency,
  formatNumber,
  truncate,
  generateId,
  sleep,
  isServer,
  isClient,
  getBaseUrl,
  absoluteUrl,
  capitalize,
  toTitleCase,
  slugify,
} from '@/lib/utils';

describe('Utility Functions', () => {
  // ==========================================================================
  // cn (class name merger)
  // ==========================================================================

  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
      expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
    });

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('should merge Tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
    });
  });

  // ==========================================================================
  // formatDate
  // ==========================================================================

  describe('formatDate', () => {
    it('should format Date object', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const formatted = formatDate(date);
      expect(formatted).toContain('2024');
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
    });

    it('should format date string', () => {
      const formatted = formatDate('2024-01-15');
      expect(formatted).toContain('Jan');
    });

    it('should format timestamp', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const formatted = formatDate(timestamp);
      expect(formatted).toContain('Jan');
    });

    it('should accept custom options', () => {
      const date = new Date('2024-01-15T12:00:00Z');
      const formatted = formatDate(date, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
      expect(formatted).toContain('January');
    });
  });

  // ==========================================================================
  // formatDateTime
  // ==========================================================================

  describe('formatDateTime', () => {
    it('should format date with time', () => {
      const date = new Date('2024-01-15T14:30:00Z');
      const formatted = formatDateTime(date);
      expect(formatted).toContain('Jan');
      expect(formatted).toContain('15');
      expect(formatted).toContain('2024');
    });

    it('should include time component', () => {
      const date = new Date('2024-01-15T14:30:00');
      const formatted = formatDateTime(date);
      // Should have some time representation
      expect(formatted.length).toBeGreaterThan(10);
    });
  });

  // ==========================================================================
  // formatCurrency
  // ==========================================================================

  describe('formatCurrency', () => {
    it('should format USD by default', () => {
      expect(formatCurrency(1234.56)).toBe('$1,234.56');
    });

    it('should format large amounts', () => {
      expect(formatCurrency(1000000)).toBe('$1,000,000.00');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format different currencies', () => {
      const result = formatCurrency(100, 'EUR', 'de-DE');
      expect(result).toContain('€');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-50);
      expect(result).toContain('-');
      expect(result).toContain('$50.00');
    });
  });

  // ==========================================================================
  // formatNumber
  // ==========================================================================

  describe('formatNumber', () => {
    it('should format numbers with commas', () => {
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('should format small numbers', () => {
      expect(formatNumber(123)).toBe('123');
    });

    it('should format decimal numbers', () => {
      const result = formatNumber(1234.56);
      expect(result).toContain('1,234');
    });

    it('should format zero', () => {
      expect(formatNumber(0)).toBe('0');
    });

    it('should format negative numbers', () => {
      expect(formatNumber(-1234)).toBe('-1,234');
    });
  });

  // ==========================================================================
  // truncate
  // ==========================================================================

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('Hello, World!', 5)).toBe('Hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('Hello', 10)).toBe('Hello');
    });

    it('should handle exact length', () => {
      expect(truncate('Hello', 5)).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(truncate('', 5)).toBe('');
    });

    it('should handle very short length', () => {
      expect(truncate('Hello, World!', 1)).toBe('H...');
    });
  });

  // ==========================================================================
  // generateId
  // ==========================================================================

  describe('generateId', () => {
    it('should generate id of default length', () => {
      const id = generateId();
      expect(id.length).toBe(16);
    });

    it('should generate id of specified length', () => {
      expect(generateId(8).length).toBe(8);
      expect(generateId(32).length).toBe(32);
    });

    it('should generate unique ids', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId());
      }
      expect(ids.size).toBe(100);
    });

    it('should only contain alphanumeric characters', () => {
      const id = generateId(100);
      expect(id).toMatch(/^[A-Za-z0-9]+$/);
    });
  });

  // ==========================================================================
  // sleep
  // ==========================================================================

  describe('sleep', () => {
    it('should delay execution', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45);
    });

    it('should resolve without value', async () => {
      const result = await sleep(1);
      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // isServer / isClient
  // ==========================================================================

  describe('isServer', () => {
    it('should return true in Node environment', () => {
      expect(isServer()).toBe(true);
    });
  });

  describe('isClient', () => {
    it('should return false in Node environment', () => {
      expect(isClient()).toBe(false);
    });
  });

  // ==========================================================================
  // getBaseUrl / absoluteUrl
  // ==========================================================================

  describe('getBaseUrl', () => {
    it('should return default localhost URL', () => {
      const originalEnv = process.env.VERCEL_URL;
      const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.VERCEL_URL;
      delete process.env.NEXT_PUBLIC_APP_URL;

      const url = getBaseUrl();
      expect(url).toBe('http://localhost:3000');

      process.env.VERCEL_URL = originalEnv;
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    });

    it('should use NEXT_PUBLIC_APP_URL if set', () => {
      const originalEnv = process.env.NEXT_PUBLIC_APP_URL;
      process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';
      delete process.env.VERCEL_URL;

      const url = getBaseUrl();
      expect(url).toBe('https://example.com');

      process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    });
  });

  describe('absoluteUrl', () => {
    it('should create absolute URL from path', () => {
      const url = absoluteUrl('/api/test');
      expect(url).toContain('/api/test');
      expect(url).toMatch(/^https?:\/\//);
    });
  });

  // ==========================================================================
  // capitalize
  // ==========================================================================

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should not affect rest of string', () => {
      expect(capitalize('hELLO')).toBe('HELLO');
    });
  });

  // ==========================================================================
  // toTitleCase
  // ==========================================================================

  describe('toTitleCase', () => {
    it('should convert to title case', () => {
      expect(toTitleCase('hello world')).toBe('Hello World');
    });

    it('should handle uppercase input', () => {
      expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
    });

    it('should handle mixed case', () => {
      expect(toTitleCase('hElLo WoRlD')).toBe('Hello World');
    });

    it('should handle single word', () => {
      expect(toTitleCase('hello')).toBe('Hello');
    });

    it('should handle multiple spaces', () => {
      expect(toTitleCase('hello  world')).toBe('Hello  World');
    });
  });

  // ==========================================================================
  // slugify
  // ==========================================================================

  describe('slugify', () => {
    it('should convert to slug', () => {
      expect(slugify('Hello World')).toBe('hello-world');
    });

    it('should remove special characters', () => {
      expect(slugify('Hello, World!')).toBe('hello-world');
    });

    it('should handle multiple spaces', () => {
      expect(slugify('Hello   World')).toBe('hello-world');
    });

    it('should handle underscores', () => {
      expect(slugify('hello_world')).toBe('hello-world');
    });

    it('should trim whitespace', () => {
      expect(slugify('  Hello World  ')).toBe('hello-world');
    });

    it('should handle already slugified', () => {
      expect(slugify('hello-world')).toBe('hello-world');
    });

    it('should remove leading/trailing hyphens', () => {
      expect(slugify('-hello-world-')).toBe('hello-world');
    });
  });
});
