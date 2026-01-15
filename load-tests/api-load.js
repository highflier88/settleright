/**
 * API Load Test
 *
 * Basic load testing for API endpoints.
 * Tests the most common API operations under load.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const casesResponseTime = new Trend('cases_response_time');
const paymentsResponseTime = new Trend('payments_response_time');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },  // Ramp up to 10 users
    { duration: '3m', target: 10 },  // Stay at 10 users
    { duration: '2m', target: 50 },  // Ramp up to 50 users
    { duration: '5m', target: 50 },  // Stay at 50 users
    { duration: '2m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],  // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],    // Error rate should be below 1%
    errors: ['rate<0.01'],             // Custom error rate below 1%
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test_token';

// Common headers
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${AUTH_TOKEN}`,
};

/**
 * Main test function
 */
export default function () {
  group('Health Check', function () {
    const res = http.get(`${BASE_URL}/api/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Case Listing', function () {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/cases`, { headers });
    const duration = Date.now() - start;

    casesResponseTime.add(duration);

    check(res, {
      'cases list status is 200': (r) => r.status === 200,
      'cases list has data': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.success === true;
        } catch {
          return false;
        }
      },
      'cases list response time < 300ms': (r) => r.timings.duration < 300,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(1);

  group('Single Case Fetch', function () {
    // Use a test case ID
    const caseId = 'test-case-id';
    const res = http.get(`${BASE_URL}/api/cases/${caseId}`, { headers });

    check(res, {
      'single case fetch status is 200 or 404': (r) =>
        r.status === 200 || r.status === 404,
    });
  });

  sleep(1);

  group('Notifications', function () {
    const res = http.get(`${BASE_URL}/api/notifications`, { headers });

    check(res, {
      'notifications status is 200': (r) => r.status === 200,
    });

    errorRate.add(res.status !== 200);
  });

  sleep(1);

  group('Payment Status', function () {
    const caseId = 'test-case-id';
    const start = Date.now();
    const res = http.get(`${BASE_URL}/api/cases/${caseId}/payments`, { headers });
    const duration = Date.now() - start;

    paymentsResponseTime.add(duration);

    check(res, {
      'payment status fetch successful': (r) =>
        r.status === 200 || r.status === 404,
    });
  });

  sleep(Math.random() * 2 + 1); // Random sleep between 1-3 seconds
}

/**
 * Setup function - runs once before load test
 */
export function setup() {
  // Verify the service is up
  const res = http.get(`${BASE_URL}/api/health`);
  if (res.status !== 200) {
    throw new Error(`Service not available: ${res.status}`);
  }

  return {
    startTime: new Date().toISOString(),
  };
}

/**
 * Teardown function - runs once after load test
 */
export function teardown(data) {
  console.log(`Load test completed. Started at: ${data.startTime}`);
}
