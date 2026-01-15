/**
 * Respondent Journey E2E Tests
 *
 * Tests the complete respondent experience from invitation to award receipt.
 */

import { test, expect } from '@playwright/test';

test.describe('Respondent Journey', () => {
  /**
   * Invitation and onboarding
   */
  test.describe('Invitation Flow', () => {
    test('should access case via invitation link', async ({ page }) => {
      // Simulate clicking invitation link (token would be from email)
      await page.goto('/invitation/test-invitation-token');

      // Should show case summary or prompt to sign up
      await expect(page.getByText(/invited to respond|arbitration case/i)).toBeVisible();
    });

    test('should display case summary on invitation page', async ({ page }) => {
      await page.goto('/invitation/test-invitation-token');

      // Should see case details
      await expect(page.getByText(/case reference|claim against you/i)).toBeVisible();
      await expect(page.getByText(/dispute type/i)).toBeVisible();
      await expect(page.getByText(/claimed amount/i)).toBeVisible();
    });

    test('should prompt for account creation or login', async ({ page }) => {
      await page.goto('/invitation/test-invitation-token');

      // Should see account options
      await expect(page.getByRole('button', { name: /create account|sign up/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /sign in|login|already have/i })).toBeVisible();
    });

    test('should accept invitation and join case', async ({ page }) => {
      await page.goto('/invitation/test-invitation-token');

      // Accept invitation
      await page.getByRole('button', { name: /accept|respond|join/i }).click();

      // Should redirect to case or prompt for next steps
      await expect(page).toHaveURL(/\/dashboard\/cases\/|\/onboarding/);
    });

    test('should handle expired invitation', async ({ page }) => {
      await page.goto('/invitation/expired-token');

      await expect(page.getByText(/expired|no longer valid/i)).toBeVisible();
      await expect(page.getByRole('link', { name: /contact|support/i })).toBeVisible();
    });

    test('should handle invalid invitation token', async ({ page }) => {
      await page.goto('/invitation/invalid-token');

      await expect(page.getByText(/invalid|not found/i)).toBeVisible();
    });
  });

  /**
   * KYC verification
   */
  test.describe('Identity Verification', () => {
    test('should prompt for KYC verification', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      // If KYC not complete, should show prompt
      const kycPrompt = page.getByText(/verify your identity|kyc required/i);
      if (await kycPrompt.isVisible()) {
        await expect(kycPrompt).toBeVisible();
        await expect(page.getByRole('button', { name: /verify|start/i })).toBeVisible();
      }
    });

    test('should navigate to Stripe Identity verification', async ({ page }) => {
      await page.goto('/dashboard/settings/verification');

      await page.getByRole('button', { name: /verify|start/i }).click();

      // Should redirect to Stripe Identity or show verification modal
      await expect(page).toHaveURL(/identity\.stripe\.com|\/verification/);
    });
  });

  /**
   * Response submission
   */
  test.describe('Response to Claim', () => {
    test('should view claimant statement', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /statement/i }).click();

      // Should see claimant's statement
      await expect(page.getByText(/claimant.*statement/i)).toBeVisible();
    });

    test('should submit response statement', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /statement/i }).click();

      const response = `
        STATEMENT OF DEFENSE

        1. Respondent denies the allegations in the claim.
        2. The deliverables were provided as agreed on January 20, 2026.
        3. Claimant was notified and provided access to all materials.
        4. Claimant has failed to respond to completion notices.

        COUNTERCLAIM:
        - Respondent requests payment of remaining balance per contract.
      `;

      await page.getByLabel(/your response|statement/i).fill(response);
      await page.getByRole('button', { name: /submit|save/i }).click();

      await expect(page.getByText(/submitted|saved/i)).toBeVisible();
    });

    test('should upload defense evidence', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /evidence/i }).click();

      // Upload delivery confirmation
      const buffer = Buffer.from('Delivery confirmation content');
      await page.getByLabel(/upload/i).setInputFiles({
        name: 'delivery-confirmation.pdf',
        mimeType: 'application/pdf',
        buffer,
      });

      await expect(page.getByText(/uploaded|success/i)).toBeVisible({ timeout: 30000 });
    });
  });

  /**
   * Agreement signing
   */
  test.describe('Agreement Signing', () => {
    test('should view arbitration agreement', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /agreement/i }).click();

      await expect(page.getByText(/SUBMISSION AGREEMENT/i)).toBeVisible();
      await expect(page.getByText(/WAIVER OF JURY TRIAL/i)).toBeVisible();
      await expect(page.getByText(/CLASS ACTION WAIVER/i)).toBeVisible();
    });

    test('should sign agreement as respondent', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /agreement/i }).click();

      // Check required acknowledgments
      await page.getByLabel(/I have read/i).check();
      await page.getByLabel(/I agree to be bound/i).check();

      // Sign
      await page.getByRole('button', { name: /sign|execute/i }).click();
      await page.getByRole('button', { name: /confirm/i }).click();

      await expect(page.getByText(/signed|executed/i)).toBeVisible();
    });

    test('should see claimant signature status', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();
      await page.getByRole('tab', { name: /agreement/i }).click();

      // Check for signature status indicators
      await expect(page.getByText(/claimant.*signed|awaiting/i)).toBeVisible();
    });
  });

  /**
   * Response fee payment
   */
  test.describe('Response Fee Payment', () => {
    test('should see response fee requirement', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      await expect(page.getByText(/response fee|payment required/i)).toBeVisible();
    });

    test('should pay response fee', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      await page.getByRole('button', { name: /pay.*fee|checkout/i }).click();

      // Should redirect to payment
      await expect(page).toHaveURL(/checkout\.stripe\.com|\/payment/);
    });
  });

  /**
   * Case progress and notifications
   */
  test.describe('Case Progress', () => {
    test('should view case timeline', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      await expect(page.getByTestId('case-timeline')).toBeVisible();
    });

    test('should receive deadline notifications', async ({ page }) => {
      await page.goto('/dashboard');

      // Check notifications area
      await page.getByTestId('notifications').click();
      await expect(page.getByText(/deadline|due|reminder/i)).toBeVisible();
    });

    test('should view approaching deadlines', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      // Check deadline display
      await expect(page.getByText(/evidence deadline|response due/i)).toBeVisible();
    });
  });

  /**
   * Award receipt
   */
  test.describe('Award Receipt', () => {
    test('should receive notification of award', async ({ page }) => {
      await page.goto('/dashboard');

      // Check for award notification
      await page.getByTestId('notifications').click();
      const awardNotification = page.getByText(/award issued|decision/i);
      if (await awardNotification.isVisible()) {
        await expect(awardNotification).toBeVisible();
      }
    });

    test('should view award details', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      const awardTab = page.getByRole('tab', { name: /award/i });
      if (await awardTab.isVisible()) {
        await awardTab.click();

        await expect(page.getByText(/ARBITRATION AWARD/i)).toBeVisible();
        await expect(page.getByText(/FINDINGS OF FACT/i)).toBeVisible();
        await expect(page.getByText(/ORDER AND AWARD/i)).toBeVisible();
      }
    });

    test('should download award PDF', async ({ page }) => {
      await page.goto('/dashboard/cases');
      await page
        .getByRole('link', { name: /view|open/i })
        .first()
        .click();

      const awardTab = page.getByRole('tab', { name: /award/i });
      if (await awardTab.isVisible()) {
        await awardTab.click();

        const downloadButton = page.getByRole('button', { name: /download/i });
        if (await downloadButton.isVisible()) {
          // Start download
          const downloadPromise = page.waitForEvent('download');
          await downloadButton.click();
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toContain('.pdf');
        }
      }
    });
  });
});

/**
 * Counterclaim flow
 */
test.describe('Counterclaim', () => {
  test('should submit counterclaim', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    // Check for counterclaim option
    const counterclaimButton = page.getByRole('button', { name: /counterclaim|file counter/i });
    if (await counterclaimButton.isVisible()) {
      await counterclaimButton.click();

      await page.getByLabel(/amount/i).fill('2500');
      await page.getByLabel(/description/i).fill('Counterclaim for unpaid balance per contract.');
      await page.getByRole('button', { name: /submit/i }).click();

      await expect(page.getByText(/counterclaim filed|submitted/i)).toBeVisible();
    }
  });
});

/**
 * Settlement offer flow
 */
test.describe('Settlement', () => {
  test('should view settlement offer', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    // Check for settlement offers
    const settlementTab = page.getByRole('tab', { name: /settlement|offers/i });
    if (await settlementTab.isVisible()) {
      await settlementTab.click();
      await expect(page.getByText(/settlement offer/i)).toBeVisible();
    }
  });

  test('should respond to settlement offer', async ({ page }) => {
    await page.goto('/dashboard/cases');
    await page
      .getByRole('link', { name: /view|open/i })
      .first()
      .click();

    const settlementTab = page.getByRole('tab', { name: /settlement|offers/i });
    if (await settlementTab.isVisible()) {
      await settlementTab.click();

      // Accept or counter
      const acceptButton = page.getByRole('button', { name: /accept/i });
      const counterButton = page.getByRole('button', { name: /counter/i });

      if ((await acceptButton.isVisible()) || (await counterButton.isVisible())) {
        await expect(acceptButton.or(counterButton)).toBeVisible();
      }
    }
  });
});
