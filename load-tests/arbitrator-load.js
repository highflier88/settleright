/**
 * Arbitrator Load Test
 *
 * Tests the arbitrator workflow under load.
 * Simulates multiple arbitrators reviewing cases concurrently.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const awardsReviewed = new Counter('awards_reviewed');
const awardsApproved = new Counter('awards_approved');
const reviewTime = new Trend('review_time');
const queueLoadTime = new Trend('queue_load_time');

// Test configuration - simulating arbitrator workload
export const options = {
  scenarios: {
    // Simulate 10-20 arbitrators working concurrently
    arbitrator_review: {
      executor: 'constant-vus',
      vus: 15,
      duration: '10m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800'],
    queue_load_time: ['p(95)<500'],
    review_time: ['p(95)<1000'],
    errors: ['rate<0.02'],
  },
};

// Configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || 'arbitrator_test_token';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
};

/**
 * Load arbitrator case queue
 */
function loadCaseQueue() {
  const start = Date.now();

  const res = http.get(`${BASE_URL}/api/arbitrator/cases`, { headers });

  queueLoadTime.add(Date.now() - start);

  const success = check(res, {
    'queue loaded': (r) => r.status === 200,
    'queue has cases': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.success === true;
      } catch {
        return false;
      }
    },
  });

  if (!success) {
    errorRate.add(1);
    return [];
  }

  try {
    const body = JSON.parse(res.body);
    return body.data?.cases || [];
  } catch {
    return [];
  }
}

/**
 * Load case details for review
 */
function loadCaseDetails(caseId) {
  const res = http.get(`${BASE_URL}/api/arbitrator/cases/${caseId}`, { headers });

  check(res, {
    'case details loaded': (r) => r.status === 200,
  });

  return res.status === 200;
}

/**
 * Load draft award for review
 */
function loadDraftAward(caseId) {
  const res = http.get(`${BASE_URL}/api/cases/${caseId}/draft-award`, { headers });

  check(res, {
    'draft award loaded': (r) => r.status === 200 || r.status === 404,
  });

  if (res.status === 200) {
    try {
      return JSON.parse(res.body).data;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Submit award review decision
 */
function submitReview(caseId, decision) {
  const start = Date.now();

  const payload = {
    reviewStatus: decision,
    reviewNotes: decision === 'APPROVE' ? null : 'Load test review notes',
  };

  const res = http.post(
    `${BASE_URL}/api/cases/${caseId}/draft-award/review`,
    JSON.stringify(payload),
    { headers }
  );

  reviewTime.add(Date.now() - start);

  const success = check(res, {
    'review submitted': (r) => r.status === 200,
  });

  if (success) {
    awardsReviewed.add(1);
    if (decision === 'APPROVE') {
      awardsApproved.add(1);
    }
  } else {
    errorRate.add(1);
  }
}

/**
 * Load evidence for review
 */
function loadEvidence(caseId) {
  const res = http.get(`${BASE_URL}/api/cases/${caseId}/evidence`, { headers });

  check(res, {
    'evidence loaded': (r) => r.status === 200,
  });
}

/**
 * Load statements for review
 */
function loadStatements(caseId) {
  const res = http.get(`${BASE_URL}/api/cases/${caseId}/statements`, { headers });

  check(res, {
    'statements loaded': (r) => r.status === 200,
  });
}

/**
 * Simulate arbitrator review workflow
 */
export default function () {
  group('Arbitrator Workflow', function () {
    // Step 1: Load case queue
    group('Load Queue', function () {
      const cases = loadCaseQueue();

      if (cases.length === 0) {
        console.log('No cases in queue');
        sleep(5);
        return;
      }

      // Select a random case to review
      const caseIndex = randomIntBetween(0, Math.min(cases.length - 1, 4));
      const selectedCase = cases[caseIndex];
      const caseId = selectedCase?.id || 'test-case';

      sleep(1);

      // Step 2: Load case details
      group('Review Case', function () {
        loadCaseDetails(caseId);
        sleep(1);

        // Load evidence
        loadEvidence(caseId);
        sleep(0.5);

        // Load statements
        loadStatements(caseId);
        sleep(0.5);

        // Load draft award
        const draftAward = loadDraftAward(caseId);
        sleep(1);

        // Step 3: Submit review decision
        if (draftAward) {
          // Simulate review time (reading and analyzing)
          sleep(randomIntBetween(3, 8));

          // 85% approve, 10% modify, 5% escalate
          const random = Math.random();
          let decision;
          if (random < 0.85) {
            decision = 'APPROVE';
          } else if (random < 0.95) {
            decision = 'MODIFY';
          } else {
            decision = 'ESCALATE';
          }

          submitReview(caseId, decision);
        }
      });
    });
  });

  // Wait before next review cycle
  sleep(randomIntBetween(5, 15));
}

/**
 * Handle results summary
 */
export function handleSummary(data) {
  return {
    'load-tests/results/arbitrator-summary.json': JSON.stringify(data, null, 2),
    stdout: generateSummary(data),
  };
}

function generateSummary(data) {
  const { metrics } = data;
  let summary = '\n=== Arbitrator Load Test Summary ===\n\n';

  summary += `Total Requests: ${metrics.http_reqs?.values?.count || 0}\n`;
  summary += `Queue Load Time (p95): ${metrics.queue_load_time?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `Review Submit Time (p95): ${metrics.review_time?.values?.['p(95)']?.toFixed(2) || 0}ms\n`;
  summary += `Error Rate: ${((metrics.errors?.values?.rate || 0) * 100).toFixed(2)}%\n`;
  summary += `Awards Reviewed: ${metrics.awards_reviewed?.values?.count || 0}\n`;
  summary += `Awards Approved: ${metrics.awards_approved?.values?.count || 0}\n`;

  const approvalRate = metrics.awards_reviewed?.values?.count
    ? (
        ((metrics.awards_approved?.values?.count || 0) / metrics.awards_reviewed.values.count) *
        100
      ).toFixed(1)
    : 0;
  summary += `Approval Rate: ${approvalRate}%\n`;

  return summary;
}
