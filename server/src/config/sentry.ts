import * as Sentry from '@sentry/node';

let enabled = false;

const tenantTag = process.env.TENANT_NAME || 'default-tenant';

export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.expressIntegration()],
    initialScope: {
      tags: {
        tenant: tenantTag,
      },
    },
  });

  enabled = true;
  return true;
}

export function isSentryEnabled(): boolean {
  return enabled;
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag('tenant', tenantTag);
    if (context) scope.setContext('details', context);
    Sentry.captureException(error);
  });
}

export { Sentry };
