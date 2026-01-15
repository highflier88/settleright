/**
 * Factory Utilities
 *
 * Helper functions for generating test data.
 */

import crypto from 'crypto';

/**
 * Generate a random CUID-like ID
 */
export function generateId(prefix = ''): string {
  const id = crypto.randomBytes(12).toString('hex').slice(0, 24);
  return prefix ? `${prefix}_${id}` : `c${id}`;
}

/**
 * Generate a reference number with format PREFIX-YYYYMMDD-XXXXX
 */
export function generateReferenceNumber(prefix: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const sequence = Math.floor(Math.random() * 99999)
    .toString()
    .padStart(5, '0');
  return `${prefix}-${date}-${sequence}`;
}

/**
 * Generate a random date within a range
 */
export function randomDate(start?: Date, end?: Date): Date {
  const startTime = start?.getTime() ?? Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days ago
  const endTime = end?.getTime() ?? Date.now();
  return new Date(startTime + Math.random() * (endTime - startTime));
}

/**
 * Generate a random decimal value
 */
export function randomDecimal(min: number, max: number, decimals = 2): number {
  const value = min + Math.random() * (max - min);
  return parseFloat(value.toFixed(decimals));
}

/**
 * Generate a random email
 */
export function randomEmail(name?: string): string {
  const sanitizedName = (name || 'test').toLowerCase().replace(/\s+/g, '.');
  const random = Math.floor(Math.random() * 10000);
  return `${sanitizedName}.${random}@test.example.com`;
}

/**
 * Generate a random phone number
 */
export function randomPhone(): string {
  const areaCode = Math.floor(Math.random() * 900) + 100;
  const exchange = Math.floor(Math.random() * 900) + 100;
  const subscriber = Math.floor(Math.random() * 9000) + 1000;
  return `+1${areaCode}${exchange}${subscriber}`;
}

/**
 * Generate a random IP address
 */
export function randomIp(): string {
  return [1, 2, 3, 4].map(() => Math.floor(Math.random() * 256)).join('.');
}

/**
 * Generate a random user agent string
 */
export function randomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  ];
  return agents[Math.floor(Math.random() * agents.length)]!;
}

/**
 * Create a mock Prisma Decimal
 */
export function mockDecimal(value: number): { toNumber: () => number; toString: () => string } {
  return {
    toNumber: () => value,
    toString: () => value.toString(),
  };
}

/**
 * Pick random items from an array
 */
export function pickRandom<T>(array: T[], count = 1): T[] {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

/**
 * Counter for generating sequential IDs
 */
let sequenceCounter = 0;
export function nextSequence(): number {
  return ++sequenceCounter;
}

export function resetSequence(): void {
  sequenceCounter = 0;
}
