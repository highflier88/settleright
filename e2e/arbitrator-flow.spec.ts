/**
 * Arbitrator Flow E2E Tests
 *
 * Tests the arbitrator review and award signing workflow.
 */

import { test, expect } from '@playwright/test';

test.describe('Arbitrator Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // This would use the arbitrator auth state
    // test.use({ storageState: 'playwright/.auth/arbitrator.json' });
    await page.goto('/arbitrator/dashboard');
  });

  test('should display assigned cases', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /assigned cases/i })).toBeVisible();
    await expect(page.getByTestId('case-queue')).toBeVisible();
  });

  test('should show case count and statistics', async ({ page }) => {
    await expect(page.getByTestId('case-stats')).toBeVisible();
  });

  test('should filter cases by status', async ({ page }) => {
    await page.getByRole('combobox', { name: /status/i }).selectOption('pending');
    await expect(page.getByTestId('case-list')).toBeVisible();
  });

  test('should sort cases by date', async ({ page }) => {
    await page.getByRole('button', { name: /sort/i }).click();
    await page.getByRole('menuitem', { name: /date/i }).click();
    await expect(page.getByTestId('case-list')).toBeVisible();
  });
});

test.describe('Case Review', () => {
  test('should navigate to case review page', async ({ page }) => {
    await page.goto('/arbitrator/dashboard');
    await page
      .getByRole('link', { name: /review/i })
      .first()
      .click();
    await expect(page).toHaveURL(/\/arbitrator\/cases\/[a-z0-9]+/);
  });

  test('should display case summary', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await expect(page.getByTestId('case-summary')).toBeVisible();
  });

  test('should display party information', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await expect(page.getByText(/claimant/i)).toBeVisible();
    await expect(page.getByText(/respondent/i)).toBeVisible();
  });

  test('should display evidence viewer', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /evidence/i }).click();
    await expect(page.getByTestId('evidence-viewer')).toBeVisible();
  });

  test('should display statements side by side', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /statements/i }).click();
    await expect(page.getByTestId('statement-comparison')).toBeVisible();
  });
});

test.describe('Draft Award Review', () => {
  test('should display AI-generated draft award', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await expect(page.getByTestId('draft-award')).toBeVisible();
  });

  test('should display findings of fact', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await expect(page.getByText(/findings of fact/i)).toBeVisible();
  });

  test('should display conclusions of law', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await expect(page.getByText(/conclusions of law/i)).toBeVisible();
  });

  test('should show confidence score', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await expect(page.getByTestId('confidence-score')).toBeVisible();
  });
});

test.describe('Award Actions', () => {
  test('should approve draft award', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await page.getByRole('button', { name: /approve/i }).click();

    // Should show confirmation dialog
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/approved/i)).toBeVisible();
  });

  test('should request modifications to draft', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await page.getByRole('button', { name: /modify/i }).click();

    // Should show modification form
    await expect(page.getByLabel(/notes/i)).toBeVisible();
    await page.getByLabel(/notes/i).fill('Please revise finding #3');
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByText(/modification requested/i)).toBeVisible();
  });

  test('should reject draft award', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await page.getByRole('button', { name: /reject/i }).click();

    await expect(page.getByLabel(/reason/i)).toBeVisible();
    await page.getByLabel(/reason/i).fill('Insufficient evidence to support conclusions');
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/rejected/i)).toBeVisible();
  });

  test('should escalate to senior arbitrator', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id');
    await page.getByRole('tab', { name: /award/i }).click();
    await page.getByRole('button', { name: /escalate/i }).click();

    await expect(page.getByLabel(/reason/i)).toBeVisible();
    await page.getByLabel(/reason/i).fill('Complex legal issues requiring senior review');
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/escalated/i)).toBeVisible();
  });
});

test.describe('Award Signing', () => {
  test('should display signature interface', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id/sign');
    await expect(page.getByTestId('signature-interface')).toBeVisible();
  });

  test('should require confirmation before signing', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id/sign');
    await page.getByRole('button', { name: /sign award/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/final and binding/i)).toBeVisible();
  });

  test('should complete award signing', async ({ page }) => {
    await page.goto('/arbitrator/cases/test-case-id/sign');
    await page.getByRole('button', { name: /sign award/i }).click();
    await page.getByRole('button', { name: /confirm/i }).click();

    await expect(page.getByText(/award issued/i)).toBeVisible({ timeout: 30000 });
  });
});
