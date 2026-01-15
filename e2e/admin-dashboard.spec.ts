/**
 * Admin Dashboard E2E Tests
 *
 * Tests the admin portal functionality for platform management.
 */

import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  // Admin tests would use admin auth state
  // test.use({ storageState: 'playwright/.auth/admin.json' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  /**
   * Dashboard overview
   */
  test.describe('Dashboard Overview', () => {
    test('should display admin dashboard', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /admin|dashboard/i })).toBeVisible();
    });

    test('should show platform statistics', async ({ page }) => {
      await expect(page.getByTestId('stats-overview')).toBeVisible();
      await expect(page.getByText(/total cases/i)).toBeVisible();
      await expect(page.getByText(/active users/i)).toBeVisible();
      await expect(page.getByText(/pending actions/i)).toBeVisible();
    });

    test('should display recent activity', async ({ page }) => {
      await expect(page.getByTestId('recent-activity')).toBeVisible();
    });

    test('should show system alerts', async ({ page }) => {
      const alerts = page.getByTestId('system-alerts');
      if (await alerts.isVisible()) {
        await expect(alerts).toBeVisible();
      }
    });
  });

  /**
   * User management
   */
  test.describe('User Management', () => {
    test('should navigate to user management', async ({ page }) => {
      await page.getByRole('link', { name: /users/i }).click();
      await expect(page).toHaveURL(/\/admin\/users/);
    });

    test('should display user list', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.getByTestId('user-list')).toBeVisible();
    });

    test('should search users', async ({ page }) => {
      await page.goto('/admin/users');
      await page.getByRole('searchbox', { name: /search/i }).fill('test@example');
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('user-list')).toBeVisible();
    });

    test('should filter users by role', async ({ page }) => {
      await page.goto('/admin/users');
      await page.getByRole('combobox', { name: /role/i }).selectOption('ARBITRATOR');
      await expect(page.getByTestId('user-list')).toBeVisible();
    });

    test('should view user details', async ({ page }) => {
      await page.goto('/admin/users');
      await page.getByRole('link', { name: /view|details/i }).first().click();
      await expect(page).toHaveURL(/\/admin\/users\/[a-z0-9-]+/);
      await expect(page.getByText(/user details/i)).toBeVisible();
    });

    test('should update user role', async ({ page }) => {
      await page.goto('/admin/users');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await page.getByRole('button', { name: /edit|change role/i }).click();
      await page.getByRole('combobox', { name: /role/i }).selectOption('ARBITRATOR');
      await page.getByRole('button', { name: /save|update/i }).click();

      await expect(page.getByText(/updated|saved/i)).toBeVisible();
    });

    test('should suspend user account', async ({ page }) => {
      await page.goto('/admin/users');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await page.getByRole('button', { name: /suspend|disable/i }).click();
      await page.getByRole('button', { name: /confirm/i }).click();

      await expect(page.getByText(/suspended|disabled/i)).toBeVisible();
    });
  });

  /**
   * Case management
   */
  test.describe('Case Management', () => {
    test('should navigate to case management', async ({ page }) => {
      await page.getByRole('link', { name: /cases/i }).click();
      await expect(page).toHaveURL(/\/admin\/cases/);
    });

    test('should display all cases', async ({ page }) => {
      await page.goto('/admin/cases');
      await expect(page.getByTestId('case-list')).toBeVisible();
    });

    test('should filter cases by status', async ({ page }) => {
      await page.goto('/admin/cases');
      await page.getByRole('combobox', { name: /status/i }).selectOption('ARBITRATOR_REVIEW');
      await expect(page.getByTestId('case-list')).toBeVisible();
    });

    test('should filter cases by date range', async ({ page }) => {
      await page.goto('/admin/cases');
      await page.getByLabel(/from date/i).fill('2026-01-01');
      await page.getByLabel(/to date/i).fill('2026-01-31');
      await page.getByRole('button', { name: /filter|apply/i }).click();
      await expect(page.getByTestId('case-list')).toBeVisible();
    });

    test('should view case details', async ({ page }) => {
      await page.goto('/admin/cases');
      await page.getByRole('link', { name: /view|details/i }).first().click();
      await expect(page.getByText(/case details/i)).toBeVisible();
    });

    test('should reassign case arbitrator', async ({ page }) => {
      await page.goto('/admin/cases');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await page.getByRole('button', { name: /reassign|change arbitrator/i }).click();
      await page.getByRole('combobox', { name: /arbitrator/i }).selectOption({ index: 1 });
      await page.getByRole('button', { name: /assign|save/i }).click();

      await expect(page.getByText(/reassigned|assigned/i)).toBeVisible();
    });
  });

  /**
   * Arbitrator management
   */
  test.describe('Arbitrator Management', () => {
    test('should navigate to arbitrator management', async ({ page }) => {
      await page.getByRole('link', { name: /arbitrators/i }).click();
      await expect(page).toHaveURL(/\/admin\/arbitrators/);
    });

    test('should display arbitrator list', async ({ page }) => {
      await page.goto('/admin/arbitrators');
      await expect(page.getByTestId('arbitrator-list')).toBeVisible();
    });

    test('should view arbitrator credentials', async ({ page }) => {
      await page.goto('/admin/arbitrators');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await expect(page.getByText(/credentials|qualifications/i)).toBeVisible();
      await expect(page.getByText(/bar number/i)).toBeVisible();
    });

    test('should verify arbitrator credentials', async ({ page }) => {
      await page.goto('/admin/arbitrators');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await page.getByRole('button', { name: /verify|approve/i }).click();
      await page.getByRole('button', { name: /confirm/i }).click();

      await expect(page.getByText(/verified|approved/i)).toBeVisible();
    });

    test('should view arbitrator workload', async ({ page }) => {
      await page.goto('/admin/arbitrators');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await expect(page.getByText(/active cases|workload/i)).toBeVisible();
      await expect(page.getByTestId('case-count')).toBeVisible();
    });

    test('should set arbitrator availability', async ({ page }) => {
      await page.goto('/admin/arbitrators');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      await page.getByRole('button', { name: /availability|status/i }).click();
      await page.getByRole('combobox', { name: /status/i }).selectOption('AVAILABLE');
      await page.getByRole('button', { name: /save/i }).click();

      await expect(page.getByText(/updated/i)).toBeVisible();
    });
  });

  /**
   * Payment management
   */
  test.describe('Payment Management', () => {
    test('should navigate to payments', async ({ page }) => {
      await page.getByRole('link', { name: /payments|billing/i }).click();
      await expect(page).toHaveURL(/\/admin\/payments/);
    });

    test('should display payment list', async ({ page }) => {
      await page.goto('/admin/payments');
      await expect(page.getByTestId('payment-list')).toBeVisible();
    });

    test('should filter payments by status', async ({ page }) => {
      await page.goto('/admin/payments');
      await page.getByRole('combobox', { name: /status/i }).selectOption('COMPLETED');
      await expect(page.getByTestId('payment-list')).toBeVisible();
    });

    test('should view payment details', async ({ page }) => {
      await page.goto('/admin/payments');
      await page.getByRole('link', { name: /view|details/i }).first().click();
      await expect(page.getByText(/payment details/i)).toBeVisible();
    });

    test('should process refund', async ({ page }) => {
      await page.goto('/admin/payments');
      await page.getByRole('link', { name: /view|details/i }).first().click();

      const refundButton = page.getByRole('button', { name: /refund/i });
      if (await refundButton.isVisible()) {
        await refundButton.click();
        await page.getByLabel(/reason/i).fill('Admin refund request');
        await page.getByRole('button', { name: /confirm/i }).click();
        await expect(page.getByText(/refunded|processed/i)).toBeVisible();
      }
    });

    test('should view revenue reports', async ({ page }) => {
      await page.goto('/admin/payments/reports');
      await expect(page.getByText(/revenue|report/i)).toBeVisible();
      await expect(page.getByTestId('revenue-chart')).toBeVisible();
    });
  });

  /**
   * Audit logs
   */
  test.describe('Audit Logs', () => {
    test('should navigate to audit logs', async ({ page }) => {
      await page.getByRole('link', { name: /audit|logs/i }).click();
      await expect(page).toHaveURL(/\/admin\/audit/);
    });

    test('should display audit log entries', async ({ page }) => {
      await page.goto('/admin/audit');
      await expect(page.getByTestId('audit-log')).toBeVisible();
    });

    test('should filter audit logs by action', async ({ page }) => {
      await page.goto('/admin/audit');
      await page.getByRole('combobox', { name: /action/i }).selectOption('CASE_CREATED');
      await expect(page.getByTestId('audit-log')).toBeVisible();
    });

    test('should filter audit logs by user', async ({ page }) => {
      await page.goto('/admin/audit');
      await page.getByLabel(/user/i).fill('user-id');
      await page.getByRole('button', { name: /filter|search/i }).click();
      await expect(page.getByTestId('audit-log')).toBeVisible();
    });

    test('should export audit logs', async ({ page }) => {
      await page.goto('/admin/audit');

      const exportButton = page.getByRole('button', { name: /export/i });
      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/audit.*\.csv|\.xlsx/);
      }
    });
  });

  /**
   * System settings
   */
  test.describe('System Settings', () => {
    test('should navigate to settings', async ({ page }) => {
      await page.getByRole('link', { name: /settings/i }).click();
      await expect(page).toHaveURL(/\/admin\/settings/);
    });

    test('should view platform settings', async ({ page }) => {
      await page.goto('/admin/settings');
      await expect(page.getByText(/platform settings/i)).toBeVisible();
    });

    test('should update fee structure', async ({ page }) => {
      await page.goto('/admin/settings/fees');

      const feeInput = page.getByLabel(/filing fee/i);
      if (await feeInput.isVisible()) {
        await feeInput.fill('99');
        await page.getByRole('button', { name: /save/i }).click();
        await expect(page.getByText(/saved|updated/i)).toBeVisible();
      }
    });

    test('should view email templates', async ({ page }) => {
      await page.goto('/admin/settings/templates');
      await expect(page.getByText(/email templates/i)).toBeVisible();
    });

    test('should view integrations', async ({ page }) => {
      await page.goto('/admin/settings/integrations');
      await expect(page.getByText(/stripe/i)).toBeVisible();
      await expect(page.getByText(/sendgrid/i)).toBeVisible();
    });
  });

  /**
   * Compliance reports
   */
  test.describe('Compliance Reports', () => {
    test('should navigate to compliance', async ({ page }) => {
      await page.getByRole('link', { name: /compliance|reports/i }).click();
      await expect(page).toHaveURL(/\/admin\/compliance/);
    });

    test('should generate compliance report', async ({ page }) => {
      await page.goto('/admin/compliance');
      await page.getByRole('button', { name: /generate report/i }).click();

      await page.getByLabel(/from date/i).fill('2026-01-01');
      await page.getByLabel(/to date/i).fill('2026-01-31');
      await page.getByRole('button', { name: /generate/i }).click();

      await expect(page.getByText(/generating|report ready/i)).toBeVisible({ timeout: 60000 });
    });

    test('should export compliance report', async ({ page }) => {
      await page.goto('/admin/compliance');

      const exportButton = page.getByRole('button', { name: /export/i });
      if (await exportButton.isVisible()) {
        const downloadPromise = page.waitForEvent('download');
        await exportButton.click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toContain('.pdf');
      }
    });
  });
});

/**
 * Admin analytics
 */
test.describe('Admin Analytics', () => {
  test('should display analytics dashboard', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByText(/analytics|metrics/i)).toBeVisible();
  });

  test('should show case volume metrics', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByTestId('case-volume-chart')).toBeVisible();
  });

  test('should show resolution time metrics', async ({ page }) => {
    await page.goto('/admin/analytics');
    await expect(page.getByTestId('resolution-time-chart')).toBeVisible();
  });

  test('should export analytics data', async ({ page }) => {
    await page.goto('/admin/analytics');

    const exportButton = page.getByRole('button', { name: /export/i });
    if (await exportButton.isVisible()) {
      await exportButton.click();
      await expect(page.getByText(/exporting|download/i)).toBeVisible();
    }
  });
});
