/**
 * Authentication Setup for E2E Tests
 *
 * Handles user authentication state for E2E tests.
 */

import { test as setup, expect } from '@playwright/test';

const STORAGE_STATE_PATH = 'playwright/.auth/user.json';

/**
 * Setup: Authenticate as a test user
 *
 * This creates an authenticated session that can be reused across tests.
 */
setup('authenticate', async ({ page }) => {
  // Navigate to the app
  await page.goto('/');

  // In a real implementation, you would:
  // 1. Navigate to login page
  // 2. Enter test credentials
  // 3. Submit the form
  // 4. Wait for authentication to complete

  // For now, we'll use Clerk's test mode or mock authentication
  // Example with Clerk test mode:
  // await page.goto('/sign-in');
  // await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL!);
  // await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD!);
  // await page.click('button[type="submit"]');

  // Wait for the page to be authenticated
  // await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

  // Save the authentication state
  await page.context().storageState({ path: STORAGE_STATE_PATH });
});

/**
 * Setup: Authenticate as an arbitrator
 */
setup('authenticate as arbitrator', async ({ page }) => {
  const arbitratorStoragePath = 'playwright/.auth/arbitrator.json';

  await page.goto('/');

  // Similar authentication flow for arbitrator account
  // await page.goto('/sign-in');
  // await page.fill('input[name="email"]', process.env.TEST_ARBITRATOR_EMAIL!);
  // await page.fill('input[name="password"]', process.env.TEST_ARBITRATOR_PASSWORD!);
  // await page.click('button[type="submit"]');

  await page.context().storageState({ path: arbitratorStoragePath });
});

/**
 * Setup: Authenticate as admin
 */
setup('authenticate as admin', async ({ page }) => {
  const adminStoragePath = 'playwright/.auth/admin.json';

  await page.goto('/');

  // Similar authentication flow for admin account
  // await page.goto('/sign-in');
  // await page.fill('input[name="email"]', process.env.TEST_ADMIN_EMAIL!);
  // await page.fill('input[name="password"]', process.env.TEST_ADMIN_PASSWORD!);
  // await page.click('button[type="submit"]');

  await page.context().storageState({ path: adminStoragePath });
});
