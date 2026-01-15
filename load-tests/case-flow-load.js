/**
 * Case Flow Load Test
 *
 * Simulates complete case lifecycle under load.
 * Tests concurrent case creation, evidence submission, and processing.
 */

import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const casesCreated = new Counter('cases_created');
const evidenceUploaded = new Counter('evidence_uploaded');
const statementsSubmitted = new Counter('statements_submitted');
const caseCreationTime = new Trend('case_creation_time');

// Test configuration
export const options = {
  scenarios: {
    // Scenario 1: Constant case creation
    case_creation: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 new cases per time unit
      timeUnit: '1m', // per minute
      duration: '10m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    // Scenario 2: Evidence upload spikes
    evidence_upload: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 20 },
        { duration: '5m', target: 20 },
        { duration: '3m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% under 1 second
    http_req_failed: ['rate<0.05'], // Less than 5% failures
    case_creation_time: ['p(95)<2000'], // Case creation under 2 seconds
    errors: ['rate<0.05'],
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'test_token';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

// Dispute types for random selection
const DISPUTE_TYPES = ['CONTRACTS', 'PROPERTY', 'CONSUMER', 'EMPLOYMENT'];
const JURISDICTIONS = ['US-CA', 'US-NY', 'US-TX', 'US-FL'];

/**
 * Generate a random case payload
 */
function generateCasePayload() {
  return {
    jurisdiction: JURISDICTIONS[randomIntBetween(0, JURISDICTIONS.length - 1)],
    disputeType: DISPUTE_TYPES[randomIntBetween(0, DISPUTE_TYPES.length - 1)],
    description: `Load test case - ${randomString(20)}`,
    amount: randomIntBetween(500, 25000),
  };
}

/**
 * Create a new case
 */
function createCase() {
  const payload = generateCasePayload();
  const start = Date.now();

  const res = http.post(`${BASE_URL}/api/cases`, JSON.stringify(payload), { headers });

  const duration = Date.now() - start;
  caseCreationTime.add(duration);

  const success = check(res, {
    'case created successfully': (r) => r.status === 201 || r.status === 200,
    'case has id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && body.data.id;
      } catch {
        return false;
      }
    },
  });

  if (success) {
    casesCreated.add(1);
    try {
      return JSON.parse(res.body).data.id;
    } catch {
      return null;
    }
  } else {
    errorRate.add(1);
    return null;
  }
}

/**
 * Upload evidence to a case
 */
function uploadEvidence(caseId) {
  const payload = {
    title: `Evidence ${randomString(8)}`,
    description: 'Load test evidence file',
    type: 'DOCUMENT',
  };

  const res = http.post(`${BASE_URL}/api/cases/${caseId}/evidence`, JSON.stringify(payload), {
    headers,
  });

  const success = check(res, {
    'evidence uploaded': (r) => r.status === 201 || r.status === 200,
  });

  if (success) {
    evidenceUploaded.add(1);
  } else {
    errorRate.add(1);
  }
}

/**
 * Submit a statement
 */
function submitStatement(caseId) {
  const payload = {
    type: 'CLAIMANT',
    content: `This is a load test statement. ${randomString(100)}`,
  };

  const res = http.post(`${BASE_URL}/api/cases/${caseId}/statements`, JSON.stringify(payload), {
    headers,
  });

  const success = check(res, {
    'statement submitted': (r) => r.status === 201 || r.status === 200,
  });

  if (success) {
    statementsSubmitted.add(1);
  } else {
    errorRate.add(1);
  }
}

/**
 * Get case status
 */
function getCaseStatus(caseId) {
  const res = http.get(`${BASE_URL}/api/cases/${caseId}`, { headers });

  check(res, {
    'case status retrieved': (r) => r.status === 200,
  });
}

/**
 * Main test function - case creation scenario
 */
export default function () {
  group('Complete Case Flow', function () {
    // Step 1: Create case
    const caseId = createCase();
    if (!caseId) {
      console.log('Failed to create case, skipping remaining steps');
      return;
    }

    sleep(1);

    // Step 2: Upload multiple evidence files
    for (let i = 0; i < randomIntBetween(1, 3); i++) {
      uploadEvidence(caseId);
      sleep(0.5);
    }

    sleep(1);

    // Step 3: Submit statement
    submitStatement(caseId);

    sleep(1);

    // Step 4: Check case status
    getCaseStatus(caseId);
  });

  sleep(randomIntBetween(2, 5));
}

/**
 * Handle results summary
 */
export function handleSummary(data) {
  return {
    'load-tests/results/case-flow-summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const { metrics } = data;
  let summary = '\n=== Case Flow Load Test Summary ===\n\n';

  summary += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `Request Duration (p95): ${metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `Cases Created: ${metrics.cases_created?.values?.count || 0}\n`;
  summary += `Evidence Uploaded: ${metrics.evidence_uploaded?.values?.count || 0}\n`;
  summary += `Statements Submitted: ${metrics.statements_submitted?.values?.count || 0}\n`;

  return summary;
}
