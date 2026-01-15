/**
 * User Registration and Onboarding E2E Tests
 *
 * Tests the complete user registration, verification, and onboarding flow.
 */

import { test, expect } from '@playwright/test';

test.describe('User Registration', () => {
  /**
   * Sign up flow
   */
  test.describe('Sign Up', () => {
    test('should display sign up page', async ({ page }) => {
      await page.goto('/sign-up');

      await expect(page.getByRole('heading', { name: /sign up|create account/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should validate email format', async ({ page }) => {
      await page.goto('/sign-up');

      await page.getByLabel(/email/i).fill('invalid-email');
      await page.getByRole('button', { name: /sign up|continue/i }).click();

      await expect(page.getByText(/invalid.*email|email.*valid/i)).toBeVisible();
    });

    test('should validate password requirements', async ({ page }) => {
      await page.goto('/sign-up');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('weak');
      await page.getByRole('button', { name: /sign up|continue/i }).click();

      await expect(page.getByText(/password.*requirements|characters/i)).toBeVisible();
    });

    test('should complete sign up with valid data', async ({ page }) => {
      await page.goto('/sign-up');

      await page.getByLabel(/email/i).fill('newuser@test.example.com');
      await page.getByLabel(/password/i).fill('SecurePassword123!');

      await page.getByRole('button', { name: /sign up|continue/i }).click();

      // Should show verification email sent or redirect to verification
      await expect(page.getByText(/verify|email sent|check your email/i)).toBeVisible();
    });

    test('should show social login options', async ({ page }) => {
      await page.goto('/sign-up');

      // Check for social auth buttons (Google, etc.)
      await expect(
        page.getByRole('button', { name: /google|continue with google/i })
      ).toBeVisible();
    });

    test('should link to sign in page', async ({ page }) => {
      await page.goto('/sign-up');

      await expect(page.getByRole('link', { name: /sign in|already have/i })).toBeVisible();
      await page.getByRole('link', { name: /sign in|already have/i }).click();
      await expect(page).toHaveURL(/sign-in/);
    });
  });

  /**
   * Email verification
   */
  test.describe('Email Verification', () => {
    test('should display verification pending page', async ({ page }) => {
      await page.goto('/verification-pending');

      await expect(page.getByText(/verify.*email|check your inbox/i)).toBeVisible();
    });

    test('should allow resending verification email', async ({ page }) => {
      await page.goto('/verification-pending');

      await page.getByRole('button', { name: /resend|send again/i }).click();
      await expect(page.getByText(/sent|resent/i)).toBeVisible();
    });

    test('should handle verification link', async ({ page }) => {
      // Simulate clicking email verification link
      await page.goto('/verify-email?token=test-verification-token');

      // Should show success or redirect
      await expect(
        page.getByText(/verified|success/i).or(page.locator('[data-testid="dashboard"]'))
      ).toBeVisible();
    });
  });

  /**
   * Sign in flow
   */
  test.describe('Sign In', () => {
    test('should display sign in page', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(page.getByRole('heading', { name: /sign in|welcome back/i })).toBeVisible();
    });

    test('should sign in with valid credentials', async ({ page }) => {
      await page.goto('/sign-in');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('TestPassword123!');
      await page.getByRole('button', { name: /sign in|continue/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await page.goto('/sign-in');

      await page.getByLabel(/email/i).fill('wrong@example.com');
      await page.getByLabel(/password/i).fill('WrongPassword');
      await page.getByRole('button', { name: /sign in|continue/i }).click();

      await expect(page.getByText(/invalid|incorrect|try again/i)).toBeVisible();
    });

    test('should link to forgot password', async ({ page }) => {
      await page.goto('/sign-in');

      await expect(page.getByRole('link', { name: /forgot|reset/i })).toBeVisible();
    });
  });

  /**
   * Password reset flow
   */
  test.describe('Password Reset', () => {
    test('should display password reset page', async ({ page }) => {
      await page.goto('/forgot-password');

      await expect(page.getByRole('heading', { name: /reset|forgot/i })).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should send password reset email', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByRole('button', { name: /send|reset/i }).click();

      await expect(page.getByText(/email sent|check your inbox/i)).toBeVisible();
    });

    test('should handle password reset link', async ({ page }) => {
      await page.goto('/reset-password?token=test-reset-token');

      await expect(page.getByLabel(/new password/i)).toBeVisible();
      await expect(page.getByLabel(/confirm password/i)).toBeVisible();
    });
  });
});

/**
 * Onboarding flow
 */
test.describe('User Onboarding', () => {
  test.describe('Profile Setup', () => {
    test('should prompt for profile completion', async ({ page }) => {
      await page.goto('/onboarding');

      await expect(page.getByRole('heading', { name: /complete.*profile|welcome/i })).toBeVisible();
    });

    test('should collect user information', async ({ page }) => {
      await page.goto('/onboarding/profile');

      await page.getByLabel(/first name/i).fill('John');
      await page.getByLabel(/last name/i).fill('Smith');
      await page.getByLabel(/phone/i).fill('+1234567890');

      await page.getByRole('button', { name: /next|continue/i }).click();

      await expect(page).toHaveURL(/onboarding/);
    });
  });

  test.describe('KYC Verification', () => {
    test('should explain KYC requirements', async ({ page }) => {
      await page.goto('/onboarding/verify');

      await expect(page.getByText(/identity verification|kyc/i)).toBeVisible();
      await expect(page.getByText(/government.*id|photo id/i)).toBeVisible();
    });

    test('should start Stripe Identity verification', async ({ page }) => {
      await page.goto('/onboarding/verify');

      await page.getByRole('button', { name: /start|verify/i }).click();

      // Should redirect to Stripe Identity
      await expect(page).toHaveURL(/identity\.stripe\.com|\/verification/);
    });

    test('should allow skipping KYC temporarily', async ({ page }) => {
      await page.goto('/onboarding/verify');

      const skipButton = page.getByRole('button', { name: /skip|later/i });
      if (await skipButton.isVisible()) {
        await skipButton.click();
        await expect(page).toHaveURL(/dashboard|onboarding/);
      }
    });
  });

  test.describe('Platform Tour', () => {
    test('should show platform introduction', async ({ page }) => {
      await page.goto('/onboarding/tour');

      await expect(page.getByText(/welcome|tour|introduction/i)).toBeVisible();
    });

    test('should navigate through tour steps', async ({ page }) => {
      await page.goto('/onboarding/tour');

      // Step through tour
      await page.getByRole('button', { name: /next|continue/i }).click();
      await page.getByRole('button', { name: /next|continue/i }).click();
      await page.getByRole('button', { name: /finish|done|start/i }).click();

      // Should complete to dashboard
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should allow skipping tour', async ({ page }) => {
      await page.goto('/onboarding/tour');

      await page.getByRole('button', { name: /skip|close/i }).click();
      await expect(page).toHaveURL(/dashboard/);
    });
  });
});

/**
 * Account management
 */
test.describe('Account Settings', () => {
  test.describe('Profile Settings', () => {
    test('should display profile settings', async ({ page }) => {
      await page.goto('/dashboard/settings/profile');

      await expect(page.getByLabel(/name/i)).toBeVisible();
      await expect(page.getByLabel(/email/i)).toBeVisible();
    });

    test('should update profile information', async ({ page }) => {
      await page.goto('/dashboard/settings/profile');

      await page.getByLabel(/phone/i).fill('+1987654321');
      await page.getByRole('button', { name: /save|update/i }).click();

      await expect(page.getByText(/saved|updated/i)).toBeVisible();
    });
  });

  test.describe('Security Settings', () => {
    test('should display security options', async ({ page }) => {
      await page.goto('/dashboard/settings/security');

      await expect(page.getByText(/password/i)).toBeVisible();
      await expect(page.getByText(/two-factor|2fa/i)).toBeVisible();
    });

    test('should change password', async ({ page }) => {
      await page.goto('/dashboard/settings/security');

      await page.getByRole('button', { name: /change password/i }).click();

      await page.getByLabel(/current password/i).fill('OldPassword123!');
      await page.getByLabel(/new password/i).fill('NewPassword456!');
      await page.getByLabel(/confirm.*password/i).fill('NewPassword456!');
      await page.getByRole('button', { name: /save|update/i }).click();

      await expect(page.getByText(/changed|updated/i)).toBeVisible();
    });
  });

  test.describe('Notification Settings', () => {
    test('should display notification preferences', async ({ page }) => {
      await page.goto('/dashboard/settings/notifications');

      await expect(page.getByText(/email notifications/i)).toBeVisible();
      await expect(page.getByText(/sms notifications/i)).toBeVisible();
    });

    test('should update notification preferences', async ({ page }) => {
      await page.goto('/dashboard/settings/notifications');

      await page.getByLabel(/email.*case updates/i).check();
      await page.getByLabel(/sms.*deadlines/i).uncheck();
      await page.getByRole('button', { name: /save/i }).click();

      await expect(page.getByText(/saved|preferences updated/i)).toBeVisible();
    });
  });
});

/**
 * Logout
 */
test.describe('Logout', () => {
  test('should logout successfully', async ({ page }) => {
    await page.goto('/dashboard');

    // Click user menu
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /sign out|logout/i }).click();

    // Should redirect to home or sign in
    await expect(page).toHaveURL(/\/$|sign-in/);
  });

  test('should clear session on logout', async ({ page }) => {
    await page.goto('/dashboard');
    await page.getByTestId('user-menu').click();
    await page.getByRole('menuitem', { name: /sign out|logout/i }).click();

    // Try to access protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/sign-in/);
  });
});
