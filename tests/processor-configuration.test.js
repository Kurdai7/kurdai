import test from 'node:test';
import assert from 'node:assert/strict';
import { configurationStatus } from '../processor/server.js';

test('operator diagnostics expose no credential, identity, path or arbitrary environment values', () => {
  const config = {
    GEMINI_API_KEY: 'sensitive-provider-key', LONG_VIDEO_SERVICE_SECRET: 'sensitive-service-key',
    LONG_DATA_DIR: '/private/customer-files', VIDEO_TEST_EMAIL: 'private@example.test',
    EXTRA_SETTING: 'private-unrecognized-value', LONG_MEDIA_EUR: 'bad-cost-value',
    OMNI_INPUT_TOKENS_PER_SEGMENT: ' ', OMNI_TEXT_TOKENS_PER_SEGMENT: '-1',
    LONG_FX_PERCENT: '0', LONG_VAT_PERCENT: '0'
  };
  const status = configurationStatus(config);
  const text = JSON.stringify(status);
  for (const value of ['sensitive-provider-key', 'sensitive-service-key', '/private/customer-files',
    'private@example.test', 'private-unrecognized-value', 'bad-cost-value']) assert.ok(!text.includes(value));
  assert.equal(status.geminiConfigured, true);
  assert.equal(status.omniEnabled, false);
  assert.equal(status.durableStorageConfirmed, false);
  assert.deepEqual(status.missingCostSettings, ['OMNI_INPUT_TOKENS_PER_SEGMENT',
    'OMNI_TEXT_TOKENS_PER_SEGMENT', 'LONG_MEDIA_EUR']);
});
