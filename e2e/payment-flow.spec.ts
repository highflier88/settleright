/**
 * Payment Flow E2E Tests
 *
 * Tests the payment and fee collection workflow.
 */

import { test, expect } from '@playwright/test';

test.describe('Filing Fee Payment', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/cases');
  });

  test('should display payment required message', async ({ page }) => {
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await expect(page.getByText(/payment required|pay filing fee/i)).toBeVisible();
  });

  test('should show fee amount based on claim', async ({ page }) => {
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await expect(page.getByTestId('filing-fee-amount')).toBeVisible();
  });

  test('should navigate to payment page', async ({ page }) => {
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('button', { name: /pay|checkout/i }).click();

    // Should redirect to Stripe Checkout or show embedded payment
    await expect(page).toHaveURL(/checkout\.stripe\.com|\/payment/);
  });

  test('should handle successful payment', async ({ page }) => {
    // Navigate to a case with ?payment=success
    await page.goto('/dashboard/cases/test-case-id?payment=success');
    await expect(page.getByText(/payment successful|thank you/i)).toBeVisible();
  });

  test('should handle canceled payment', async ({ page }) => {
    await page.goto('/dashboard/cases/test-case-id?payment=canceled');
    await expect(page.getByText(/payment canceled|try again/i)).toBeVisible();
  });
});

test.describe('Response Fee Payment', () => {
  test('should show response fee for respondent', async ({ page }) => {
    // Assumes user is logged in as respondent
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await expect(page.getByText(/response fee/i)).toBeVisible();
  });

  test('should display correct fee amount', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await expect(page.getByTestId('response-fee-amount')).toBeVisible();
  });
});

test.describe('Payment History', () => {
  test('should display payment history', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /payments/i }).click();

    await expect(page.getByTestId('payment-history')).toBeVisible();
  });

  test('should show payment status', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /payments/i }).click();

    await expect(page.getByTestId('payment-status')).toBeVisible();
  });

  test('should provide receipt download link', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();
    await page.getByRole('tab', { name: /payments/i }).click();

    await expect(page.getByRole('link', { name: /receipt|download/i })).toBeVisible();
  });
});

test.describe('Fee Structure Display', () => {
  test('should show fee calculator on case creation', async ({ page }) => {
    await page.goto('/dashboard/cases/new');
    await expect(page.getByTestId('fee-calculator')).toBeVisible();
  });

  test('should update fee when amount changes', async ({ page }) => {
    await page.goto('/dashboard/cases/new');
    await page.getByLabel(/amount/i).fill('5000');
    await page.getByLabel(/amount/i).blur();

    // Fee should update based on amount
    await expect(page.getByTestId('calculated-fee')).toHaveText(/\$99/);
  });

  test('should show fee tiers', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page.getByTestId('fee-tiers')).toBeVisible();
  });
});

test.describe('Split Payment', () => {
  test('should display split payment option', async ({ page }) => {
    await page.goto('/dashboard/cases/test-case-id');
    await page.getByRole('tab', { name: /payments/i }).click();

    // If award allocates fees
    await expect(page.getByText(/split payment|fee allocation/i)).toBeVisible();
  });

  test('should show each party share', async ({ page }) => {
    await page.goto('/dashboard/cases/test-case-id');
    await page.getByRole('tab', { name: /payments/i }).click();

    await expect(page.getByTestId('claimant-share')).toBeVisible();
    await expect(page.getByTestId('respondent-share')).toBeVisible();
  });
});

test.describe('Refunds', () => {
  test('should display refund status for refunded payments', async ({ page }) => {
    await page.goto('/dashboard/cases/test-case-id');
    await page.getByRole('tab', { name: /payments/i }).click();

    // If there's a refunded payment
    const refundedPayment = page.locator('[data-status="refunded"]');
    if (await refundedPayment.isVisible()) {
      await expect(refundedPayment.getByText(/refunded/i)).toBeVisible();
    }
  });
});
