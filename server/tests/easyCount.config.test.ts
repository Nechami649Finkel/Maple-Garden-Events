import {
  getEasyCountMeta,
  getEasyCountWebhookSecret,
  isEasyCountConfigured,
  isEasyCountMockMode,
  resolveEasyCountMode,
} from '../src/Services/easyCount/config';

describe('EasyCount unified config', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('prefers EASYCOUNT_* over legacy EASY_COUNT_*', () => {
    process.env.EASYCOUNT_WEBHOOK_SECRET = 'new-secret';
    process.env.EASY_COUNT_WEBHOOK_SECRET = 'legacy-secret';
    expect(getEasyCountWebhookSecret()).toBe('new-secret');
  });

  it('falls back to legacy EASY_COUNT_* when canonical unset', () => {
    delete process.env.EASYCOUNT_WEBHOOK_SECRET;
    process.env.EASY_COUNT_WEBHOOK_SECRET = 'legacy-secret';
    expect(getEasyCountWebhookSecret()).toBe('legacy-secret');
  });

  it('treats mock mode as configured', () => {
    delete process.env.EASYCOUNT_API_KEY;
    delete process.env.EASY_COUNT_API_KEY;
    delete process.env.EASYCOUNT_API_URL;
    delete process.env.EASY_COUNT_API_URL;
    process.env.EASYCOUNT_MOCK_MODE = 'true';
    expect(isEasyCountMockMode()).toBe(true);
    expect(isEasyCountConfigured()).toBe(true);
  });

  it('defaults mode to simulation without document credentials', () => {
    delete process.env.EASYCOUNT_MODE;
    delete process.env.EASY_COUNT_MODE;
    delete process.env.EASYCOUNT_API_KEY;
    delete process.env.EASYCOUNT_DEVELOPER_EMAIL;
    expect(resolveEasyCountMode()).toBe('simulation');
    expect(getEasyCountMeta().canIssueRealDocuments).toBe(false);
  });
});
