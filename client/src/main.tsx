import { initSentry, Sentry } from './config/sentry';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { QueryClientProvider } from '@tanstack/react-query';
import { initAccessibilitySettings } from './accessibility/accessibilitySettings';
import { I18nProvider } from './i18n/I18nProvider';
import { initDocumentLocale } from './i18n/languageStorage';
import { initBrand } from './brand/initBrand';
import { ToastProvider } from './components/ui/Toast/ToastProvider';
import './index.css';
import App from './App.tsx';
import { ErrorFallback } from './components/ErrorFallback/ErrorFallback';
import { queryClient } from './lib/queryClient';

initSentry();
initAccessibilitySettings();
initDocumentLocale();
initBrand();

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  'missing-google-client-id.apps.googleusercontent.com';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <I18nProvider>
          <ToastProvider>
            <Sentry.ErrorBoundary fallback={({ error, resetError }) => (
              <ErrorFallback error={error instanceof Error ? error : undefined} resetError={resetError} />
            )}>
              <App />
            </Sentry.ErrorBoundary>
          </ToastProvider>
        </I18nProvider>
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
);
