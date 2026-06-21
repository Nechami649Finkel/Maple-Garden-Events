import '../src/instrument';
import { Sentry } from '../src/config/sentry';

try {
  // Intentional test error for Sentry Verify step
  // @ts-expect-error undefined function on purpose
  foo();
} catch (e) {
  Sentry.captureException(e);
}

Sentry.flush(3000).then(() => {
  console.log('Test error sent to Sentry — refresh the Verify page.');
});
