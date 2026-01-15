import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Audit - WCAG 2.1 AA', () => {
  test.describe('Legal Pages', () => {
    const legalPages = [
      { path: '/legal/terms-of-service', name: 'Terms of Service' },
      { path: '/legal/privacy-policy', name: 'Privacy Policy' },
      { path: '/legal/procedural-rules', name: 'Procedural Rules' },
    ];

    for (const page of legalPages) {
      test(`${page.name} page meets WCAG 2.1 AA`, async ({ page: browserPage }) => {
        await browserPage.goto(page.path);

        // Wait for content to load
        await browserPage.waitForSelector('article');

        const accessibilityResults = await new AxeBuilder({ page: browserPage })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
          .analyze();

        // Log violations for debugging
        if (accessibilityResults.violations.length > 0) {
          console.log(
            `Accessibility violations on ${page.name}:`,
            JSON.stringify(accessibilityResults.violations, null, 2)
          );
        }

        expect(accessibilityResults.violations).toEqual([]);
      });
    }
  });

  test.describe('Public Pages', () => {
    test('Home page meets WCAG 2.1 AA', async ({ page }) => {
      await page.goto('/');

      const accessibilityResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      if (accessibilityResults.violations.length > 0) {
        console.log(
          'Accessibility violations on home page:',
          JSON.stringify(accessibilityResults.violations, null, 2)
        );
      }

      expect(accessibilityResults.violations).toEqual([]);
    });

    test('Sign in page meets WCAG 2.1 AA', async ({ page }) => {
      await page.goto('/sign-in');

      const accessibilityResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      if (accessibilityResults.violations.length > 0) {
        console.log(
          'Accessibility violations on sign-in page:',
          JSON.stringify(accessibilityResults.violations, null, 2)
        );
      }

      expect(accessibilityResults.violations).toEqual([]);
    });
  });

  test.describe('Redirect Pages', () => {
    test('/terms redirects to /legal/terms-of-service', async ({ page }) => {
      await page.goto('/terms');

      // Wait for redirect
      await page.waitForURL('/legal/terms-of-service');

      expect(page.url()).toContain('/legal/terms-of-service');
    });

    test('/privacy redirects to /legal/privacy-policy', async ({ page }) => {
      await page.goto('/privacy');

      // Wait for redirect
      await page.waitForURL('/legal/privacy-policy');

      expect(page.url()).toContain('/legal/privacy-policy');
    });
  });
});
