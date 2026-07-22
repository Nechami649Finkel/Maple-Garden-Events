import * as Sentry from '@sentry/react';

const tenantTag = import.meta.env.VITE_TENANT_NAME || 'default-tenant';

export function initSentry(): boolean {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    integrations: [Sentry.browserTracingIntegration()],
    initialScope: {
      tags: {
        tenant: tenantTag,
      },
    },
    beforeSend(event) {
      const msg = event.exception?.values?.[0]?.value ?? '';
      if (
        import.meta.env.DEV &&
        (msg.includes('Failed to fetch') || msg.includes('NetworkError'))
      ) {
        return null;
      }
      return event;
    },
  });

  return true;
}

export { Sentry };
