// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment
  environment: process.env.NODE_ENV,

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: false,

  // Replay configuration
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,

  integrations: [
    Sentry.replayIntegration({
      // Mask all text and block all media
      maskAllText: true,
      blockAllMedia: true,
    }),
    Sentry.browserTracingIntegration(),
  ],

  // Filter out sensitive data
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Remove sensitive data from breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb) => {
        if (breadcrumb.data) {
          // Remove any potential PII from breadcrumb data
          const sanitizedData = { ...breadcrumb.data };
          delete sanitizedData.email;
          delete sanitizedData.password;
          delete sanitizedData.token;
          delete sanitizedData.authorization;
          breadcrumb.data = sanitizedData;
        }
        return breadcrumb;
      });
    }

    return event;
  },

  // Filter out noisy errors
  ignoreErrors: [
    // Browser extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^moz-extension:\/\//i,

    // Network errors that are expected
    'Network request failed',
    'Failed to fetch',
    'NetworkError',
    'AbortError',

    // User-triggered errors
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',

    // Third-party script errors
    /^Script error\.?$/,
    /^Javascript error: Script error\.? on line 0$/,
  ],

  // Filter out requests to third-party services
  denyUrls: [
    // Chrome extensions
    /extensions\//i,
    /^chrome:\/\//i,
    /^chrome-extension:\/\//i,

    // Firefox extensions
    /^moz-extension:\/\//i,

    // Safari extensions
    /^safari-extension:\/\//i,

    // Third-party scripts
    /hotjar\.com/i,
    /intercom\.io/i,
    /google-analytics\.com/i,
    /googletagmanager\.com/i,
  ],
});
