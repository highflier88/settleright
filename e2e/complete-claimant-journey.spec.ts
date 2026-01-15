/**
 * Complete Claimant Journey E2E Tests
 *
 * Tests the full claimant experience from case creation to award receipt.
 * This simulates a realistic user journey through the arbitration platform.
 */

import { test, expect } from '@playwright/test';

test.describe('Complete Claimant Journey', () => {
  /**
   * Complete journey from case creation to award receipt
   */
  test.describe('Full Case Lifecycle', () => {
    test('should complete case creation wizard', async ({ page }) => {
      // Start at dashboard
      await page.goto('/dashboard');

      // Click to start new case
      await page.getByRole('button', { name: /new case|file claim|start/i }).click();
      await expect(page).toHaveURL(/\/dashboard\/cases\/new/);

      // Step 1: Dispute Type
      await page.getByLabel(/dispute type/i).selectOption('CONTRACT');
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Step 2: Jurisdiction
      await page.getByLabel(/jurisdiction/i).selectOption('US-CA');
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Step 3: Claim Details
      await page.getByLabel(/amount/i).fill('7500');
      await page
        .getByLabel(/description/i)
        .fill(
          'Breach of contract for consulting services. ' +
            'Respondent failed to deliver agreed-upon deliverables and has refused to refund payment.'
        );
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Step 4: Respondent Information
      await page.getByLabel(/respondent.*name/i).fill('ABC Corp');
      await page.getByLabel(/respondent.*email/i).fill('legal@abccorp.test.example');
      await page.getByRole('button', { name: /next|continue/i }).click();

      // Step 5: Review and Submit
      await expect(page.getByText(/review your case/i)).toBeVisible();
      await expect(page.getByText('CONTRACT')).toBeVisible();
      await expect(page.getByText('$7,500')).toBeVisible();
      await page.getByRole('button', { name: /submit|create case/i }).click();

      // Should show success and redirect to case page
      await expect(page.getByText(/case created|success/i)).toBeVisible();
      await expect(page).toHaveURL(/\/dashboard\/cases\/[a-z0-9-]+/);
    });

    test('should pay filing fee after case creation', async ({ page }) => {
      await page.goto('/dashboard/cases');

      // Find a case pending payment
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      // Should see payment required
      await expect(page.getByText(/filing fee|payment required/i)).toBeVisible();
      await expect(page.getByTestId('filing-fee-amount')).toContainText(/\$\d+/);

      // Click pay button
      await page.getByRole('button', { name: /pay|checkout/i }).click();

      // Verify navigation to checkout
      await expect(page).toHaveURL(/checkout\.stripe\.com|\/payment|\/checkout/);
    });

    test('should upload evidence documents', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /evidence/i }).click();

      // Upload contract document
      const contractBuffer = Buffer.from('Contract PDF content');
      await page.getByLabel(/upload/i).setInputFiles({
        name: 'consulting-contract.pdf',
        mimeType: 'application/pdf',
        buffer: contractBuffer,
      });
      await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 30000 });

      // Upload invoice
      const invoiceBuffer = Buffer.from('Invoice PDF content');
      await page.getByLabel(/upload/i).setInputFiles({
        name: 'unpaid-invoice.pdf',
        mimeType: 'application/pdf',
        buffer: invoiceBuffer,
      });
      await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 30000 });

      // Verify documents are listed
      await expect(page.getByText('consulting-contract.pdf')).toBeVisible();
      await expect(page.getByText('unpaid-invoice.pdf')).toBeVisible();
    });

    test('should write and submit statement of claim', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /statement/i }).click();

      const statement = `
        STATEMENT OF CLAIM

        1. On January 1, 2026, Claimant and Respondent entered into a consulting agreement.
        2. Claimant paid $7,500 for consulting services to be delivered within 30 days.
        3. Respondent failed to deliver any deliverables despite multiple requests.
        4. Respondent has refused to refund the payment.

        RELIEF REQUESTED:
        - Return of full payment ($7,500)
        - Filing fees and costs
      `;

      await page.getByLabel(/statement|claim/i).fill(statement);
      await page.getByRole('button', { name: /submit|save/i }).click();

      await expect(page.getByText(/submitted|saved/i)).toBeVisible();
    });

    test('should sign arbitration agreement', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /agreement/i }).click();

      // Read agreement content
      await expect(page.getByText(/SUBMISSION AGREEMENT/i)).toBeVisible();
      await expect(page.getByText(/waiver of jury trial/i)).toBeVisible();

      // Check acknowledgment checkboxes
      await page.getByLabel(/I have read and understand/i).check();
      await page.getByLabel(/I agree to be bound/i).check();

      // Sign agreement
      await page.getByRole('button', { name: /sign|execute/i }).click();

      // Confirm signature
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByRole('button', { name: /confirm/i }).click();

      await expect(page.getByText(/signed|agreement executed/i)).toBeVisible();
    });

    test('should track case progress on timeline', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      // Check timeline visibility
      await expect(page.getByTestId('case-timeline')).toBeVisible();

      // Verify timeline events
      await expect(page.getByText(/case filed/i)).toBeVisible();
      // These would depend on the case status
      // await expect(page.getByText(/agreement signed/i)).toBeVisible();
      // await expect(page.getByText(/evidence submitted/i)).toBeVisible();
    });

    test('should view case status and deadlines', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      // Check status display
      await expect(page.getByTestId('case-status')).toBeVisible();

      // Check deadlines display
      await expect(page.getByText(/deadline|due date/i)).toBeVisible();
    });

    test('should receive and view final award', async ({ page }) => {
      // Navigate to a decided case
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      // If case has an award
      const awardTab = page.getByRole('tab', { name: /award/i });
      if (await awardTab.isVisible()) {
        await awardTab.click();

        // View award details
        await expect(page.getByText(/arbitration award/i)).toBeVisible();
        await expect(page.getByText(/findings of fact/i)).toBeVisible();
        await expect(page.getByText(/order and award/i)).toBeVisible();

        // Download award PDF
        await expect(page.getByRole('button', { name: /download/i })).toBeVisible();
      }
    });

    test('should download enforcement package', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      const awardTab = page.getByRole('tab', { name: /award/i });
      if (await awardTab.isVisible()) {
        await awardTab.click();

        // Check for enforcement package option
        const enforcementButton = page.getByRole('button', { name: /enforcement|court filing/i });
        if (await enforcementButton.isVisible()) {
          await enforcementButton.click();
          // Should start download or show enforcement options
          await expect(page.getByText(/enforcement package|download/i)).toBeVisible();
        }
      }
    });
  });

  /**
   * Dashboard and case management
   */
  test.describe('Dashboard Experience', () => {
    test('should display all cases in dashboard', async ({ page }) => {
      await page.goto('/dashboard');

      await expect(page.getByRole('heading', { name: /my cases|dashboard/i })).toBeVisible();
      await expect(page.getByTestId('case-list')).toBeVisible();
    });

    test('should filter cases by status', async ({ page }) => {
      await page.goto('/dashboard/cases');

      await page.getByRole('combobox', { name: /status|filter/i }).selectOption('PENDING');
      await expect(page.getByTestId('case-list')).toBeVisible();
    });

    test('should search cases', async ({ page }) => {
      await page.goto('/dashboard/cases');

      await page.getByRole('searchbox', { name: /search/i }).fill('contract');
      await page.keyboard.press('Enter');

      // Should filter to matching cases
      await expect(page.getByTestId('case-list')).toBeVisible();
    });

    test('should show case notifications', async ({ page }) => {
      await page.goto('/dashboard');

      // Check notification bell or area
      await expect(page.getByTestId('notifications')).toBeVisible();
    });

    test('should navigate to case from notification', async ({ page }) => {
      await page.goto('/dashboard');

      // Click on notification
      await page.getByTestId('notifications').click();
      const notification = page.getByRole('link', { name: /case|update/i }).first();
      if (await notification.isVisible()) {
        await notification.click();
        await expect(page).toHaveURL(/\/dashboard\/cases\/[a-z0-9-]+/);
      }
    });
  });

  /**
   * Profile and settings
   */
  test.describe('User Profile', () => {
    test('should view and update profile', async ({ page }) => {
      await page.goto('/dashboard/settings/profile');

      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
      await expect(page.getByLabel(/phone/i)).toBeVisible();
    });

    test('should view KYC status', async ({ page }) => {
      await page.goto('/dashboard/settings/verification');

      await expect(page.getByText(/identity verification|kyc/i)).toBeVisible();
    });

    test('should view payment methods', async ({ page }) => {
      await page.goto('/dashboard/settings/billing');

      await expect(page.getByText(/payment method|billing/i)).toBeVisible();
    });
  });
});

/**
 * Error handling and edge cases
 */
test.describe('Error Handling', () => {
  test('should handle session timeout gracefully', async ({ page }) => {
    await page.goto('/dashboard');

    // Simulate session timeout by clearing cookies
    await page.context().clearCookies();
    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/sign-in|login/);
  });

  test('should show error for invalid case access', async ({ page }) => {
    await page.goto('/dashboard/cases/invalid-case-id');

    await expect(page.getByText(/not found|no access/i)).toBeVisible();
  });

  test('should handle network errors', async ({ page }) => {
    // Start with dashboard loaded
    await page.goto('/dashboard');

    // Simulate offline
    await page.route('**/*', (route) => route.abort());

    // Try to navigate
    await page.getByRole('button', { name: /new case/i }).click();

    // Should show error message
    await expect(page.getByText(/error|offline|network/i)).toBeVisible();
  });
});
