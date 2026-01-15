/**
 * Case Flow E2E Tests
 *
 * Tests the complete case lifecycle from initiation to award.
 */

import { test, expect } from '@playwright/test';

test.describe('Case Initiation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test('should display case creation button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /new case|start case/i })).toBeVisible();
  });

  test('should navigate to case creation form', async ({ page }) => {
    await page.getByRole('button', { name: /new case|start case/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/cases\/new/);
  });

  test('should show required fields on case creation form', async ({ page }) => {
    await page.goto('/dashboard/cases/new');

    // Check for required form fields
    await expect(page.getByLabel(/jurisdiction/i)).toBeVisible();
    await expect(page.getByLabel(/dispute type/i)).toBeVisible();
    await expect(page.getByLabel(/description/i)).toBeVisible();
    await expect(page.getByLabel(/amount/i)).toBeVisible();
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/dashboard/cases/new');

    // Try to submit without filling required fields
    await page.getByRole('button', { name: /submit|create/i }).click();

    // Check for validation errors
    await expect(page.getByText(/required/i)).toBeVisible();
  });

  test('should create a new case with valid data', async ({ page }) => {
    await page.goto('/dashboard/cases/new');

    // Fill in the form
    await page.getByLabel(/jurisdiction/i).selectOption('US-CA');
    await page.getByLabel(/dispute type/i).selectOption('CONTRACTS');
    await page.getByLabel(/description/i).fill('Test contract dispute for E2E testing');
    await page.getByLabel(/amount/i).fill('5000');

    // Submit the form
    await page.getByRole('button', { name: /submit|create/i }).click();

    // Should navigate to case detail or show success
    await expect(page).toHaveURL(/\/dashboard\/cases\/[a-z0-9]+/);
  });
});

test.describe('Respondent Invitation', () => {
  test('should show invitation form on case detail', async ({ page }) => {
    // Navigate to a case in DRAFT status
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    // Check for invitation section
    await expect(page.getByText(/invite respondent/i)).toBeVisible();
  });

  test('should send invitation email', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    // Fill invitation form
    await page.getByLabel(/email/i).fill('respondent@test.example.com');
    await page.getByRole('button', { name: /send invitation/i }).click();

    // Should show success message
    await expect(page.getByText(/invitation sent/i)).toBeVisible();
  });
});

test.describe('Evidence Submission', () => {
  test('should display evidence upload area', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /evidence/i }).click();

    await expect(page.getByText(/upload|drop files/i)).toBeVisible();
  });

  test('should upload evidence file', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /evidence/i }).click();

    // Create a test file
    const buffer = Buffer.from('Test PDF content');
    await page.getByLabel(/upload/i).setInputFiles({
      name: 'test-evidence.pdf',
      mimeType: 'application/pdf',
      buffer,
    });

    // Should show upload progress or success
    await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 30000 });
  });

  test('should display uploaded evidence', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /evidence/i }).click();

    // Check for evidence list
    await expect(page.getByRole('list')).toBeVisible();
  });
});

test.describe('Statement Submission', () => {
  test('should display statement form', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /statement/i }).click();

    await expect(page.getByLabel(/statement/i)).toBeVisible();
  });

  test('should submit statement', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /statement/i }).click();

    await page.getByLabel(/statement/i).fill('This is my statement of claim...');
    await page.getByRole('button', { name: /submit/i }).click();

    await expect(page.getByText(/submitted/i)).toBeVisible();
  });
});

test.describe('Case Status', () => {
  test('should display case status badge', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    await expect(page.getByTestId('case-status')).toBeVisible();
  });

  test('should show case timeline', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    await expect(page.getByTestId('case-timeline')).toBeVisible();
  });
});
