import assert from 'node:assert/strict';
import test from 'node:test';
import {
  hasValidBearerSecret,
  safeSecretEquals,
} from '../src/lib/http/secrets';

test('server secrets require non-empty exact values', () => {
  assert.equal(safeSecretEquals('same', 'same'), true);
  assert.equal(safeSecretEquals('same', 'different'), false);
  assert.equal(safeSecretEquals('', ''), false);
  assert.equal(safeSecretEquals(null, 'secret'), false);
});

test('cron authorization accepts only an exact Bearer secret', () => {
  assert.equal(hasValidBearerSecret('Bearer cron-secret', 'cron-secret'), true);
  assert.equal(
    hasValidBearerSecret('bearer cron-secret', 'cron-secret'),
    false,
  );
  assert.equal(hasValidBearerSecret('Bearer wrong', 'cron-secret'), false);
  assert.equal(hasValidBearerSecret(null, 'cron-secret'), false);
});
