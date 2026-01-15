/**
 * Request Mock Helpers
 *
 * Provides utilities for mocking Next.js requests in API route tests.
 */

import type { NextRequest } from 'next/server';

import type { UserRole } from '@prisma/client';

import { generateId, randomIp, randomUserAgent } from '../factories/utils';

export interface MockRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url?: string;
  body?: Record<string, unknown>;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
}

export interface MockAuthenticatedRequestOptions extends MockRequestOptions {
  userId?: string;
  userRole?: UserRole;
  userEmail?: string;
}

/**
 * Create a mock NextRequest
 */
export function createMockRequest(options: MockRequestOptions = {}): NextRequest {
  const {
    method = 'GET',
    url = 'http://localhost:3000/api/test',
    body,
    headers = {},
    searchParams = {},
  } = options;

  // Build URL with search params
  const urlObj = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  // Create headers
  const requestHeaders = new Headers({
    'content-type': 'application/json',
    'x-forwarded-for': randomIp(),
    'user-agent': randomUserAgent(),
    ...headers,
  });

  // Create request init
  const init: RequestInit = {
    method,
    headers: requestHeaders,
  };

  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }

  const request = new Request(urlObj.toString(), init) as unknown as NextRequest;

  // Add NextRequest-specific properties
  Object.defineProperty(request, 'nextUrl', {
    value: urlObj,
    writable: false,
  });

  return request;
}

/**
 * Create a mock authenticated request
 */
export function createMockAuthenticatedRequest(
  options: MockAuthenticatedRequestOptions = {}
): NextRequest & { user: { id: string; role: UserRole; email: string } } {
  const {
    userId = generateId(),
    userRole = 'USER',
    userEmail = 'test@example.com',
    ...requestOptions
  } = options;

  const request = createMockRequest(requestOptions);

  // Add user property
  const authenticatedRequest = request as NextRequest & {
    user: { id: string; role: UserRole; email: string };
  };

  authenticatedRequest.user = {
    id: userId,
    role: userRole,
    email: userEmail,
  };

  return authenticatedRequest;
}

/**
 * Create a GET request
 */
export function createGetRequest(
  url: string,
  options: Omit<MockRequestOptions, 'method' | 'url'> = {}
): NextRequest {
  return createMockRequest({ ...options, method: 'GET', url });
}

/**
 * Create a POST request
 */
export function createPostRequest(
  url: string,
  body: Record<string, unknown>,
  options: Omit<MockRequestOptions, 'method' | 'url' | 'body'> = {}
): NextRequest {
  return createMockRequest({ ...options, method: 'POST', url, body });
}

/**
 * Create a PUT request
 */
export function createPutRequest(
  url: string,
  body: Record<string, unknown>,
  options: Omit<MockRequestOptions, 'method' | 'url' | 'body'> = {}
): NextRequest {
  return createMockRequest({ ...options, method: 'PUT', url, body });
}

/**
 * Create a DELETE request
 */
export function createDeleteRequest(
  url: string,
  options: Omit<MockRequestOptions, 'method' | 'url'> = {}
): NextRequest {
  return createMockRequest({ ...options, method: 'DELETE', url });
}

/**
 * Create route context with params
 */
export function createRouteContext(params: Record<string, string>): {
  params: Record<string, string>;
} {
  return { params };
}

/**
 * Extract JSON from NextResponse
 */
export async function getResponseJson<T = unknown>(response: Response): Promise<T> {
  return response.json() as Promise<T>;
}

/**
 * Assert response status and get JSON
 */
export async function expectJsonResponse<T = unknown>(
  response: Response,
  expectedStatus: number
): Promise<T> {
  expect(response.status).toBe(expectedStatus);
  return getResponseJson<T>(response);
}
