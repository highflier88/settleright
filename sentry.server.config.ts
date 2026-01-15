// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
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

  // Integrations
  integrations: [
    // Prisma integration for database query tracing
    Sentry.prismaIntegration(),
  ],

  // Filter out sensitive data
  beforeSend(event) {
    // Don't send events in development
    if (process.env.NODE_ENV === 'development') {
      return null;
    }

    // Sanitize user data
    if (event.user) {
      // Keep user ID for debugging but remove PII
      event.user = {
        id: event.user.id,
      };
    }

    // Sanitize request data
    if (event.request) {
      // Remove sensitive headers
      if (event.request.headers) {
        delete event.request.headers.authorization;
        delete event.request.headers.cookie;
        delete event.request.headers['x-api-key'];
      }

      // Remove sensitive body data
      if (event.request.data) {
        const sanitizedData =
          typeof event.request.data === 'string'
            ? event.request.data
            : { ...event.request.data };

        if (typeof sanitizedData === 'object') {
          delete sanitizedData.password;
          delete sanitizedData.token;
          delete sanitizedData.apiKey;
          delete sanitizedData.creditCard;
          delete sanitizedData.ssn;
        }

        event.request.data = sanitizedData;
      }
    }

    return event;
  },

  // Don't send breadcrumbs with sensitive info
  beforeBreadcrumb(breadcrumb) {
    // Filter out sensitive HTTP breadcrumbs
    if (breadcrumb.category === 'http') {
      if (breadcrumb.data) {
        // Remove sensitive URLs
        if (
          breadcrumb.data.url &&
          (breadcrumb.data.url.includes('/api/auth') ||
            breadcrumb.data.url.includes('stripe.com') ||
            breadcrumb.data.url.includes('clerk.'))
        ) {
          return null;
        }
      }
    }

    return breadcrumb;
  },
});
