import { signAccessToken, CSRF_COOKIE_NAME, CSRF_HEADER_NAME } from '../../src/utils/authCookie';
import type { UserRole } from '../../src/middlewares/requireRole';
import { generateCsrfToken } from '../../src/utils/authCookie';

export const TEST_EMAIL = 'security-test@maple-garden.test';

export function signTestToken(role: UserRole, email = TEST_EMAIL): string {
  return signAccessToken(email, 'Security Test User', role);
}

export function csrfHeaders(): { cookie: string; header: Record<string, string> } {
  const token = generateCsrfToken();
  return {
    cookie: `${CSRF_COOKIE_NAME}=${token}`,
    header: { [CSRF_HEADER_NAME]: token },
  };
}

export function defaultSystemSettings() {
  return {
    id: 'global',
    vatRate: 17,
    basePricePerPortion: 100,
    designBasePrice: 4500,
    receptionPrice: 2000,
    separateReceptionPrice: 3000,
    extraSecurityPrice: 650,
    lightingPrice: 1800,
    soundSystemPrice: 1400,
    screensPrice: 800,
    fireworksPrice: 700,
  };
}
