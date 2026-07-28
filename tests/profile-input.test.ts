import assert from 'node:assert/strict';
import test from 'node:test';
import { MAX_PROFILE_NAME_LENGTH, normalizeProfileInput } from '../src/lib/profile/input';

test('normalizeProfileInput trims the name and deduplicates valid niches', () => {
  assert.deepEqual(
    normalizeProfileInput({
      fullName: '  Ana   García  ',
      nichePrefs: ['iluminacion', 'home-deco', 'iluminacion'],
    }),
    {
      success: true,
      data: {
        fullName: 'Ana García',
        nichePrefs: ['iluminacion', 'home-deco'],
      },
    }
  );
});

test('normalizeProfileInput converts an empty name to null', () => {
  assert.deepEqual(normalizeProfileInput({ fullName: '   ', nichePrefs: [] }), {
    success: true,
    data: { fullName: null, nichePrefs: [] },
  });
});

test('normalizeProfileInput rejects overlong names and unknown niches', () => {
  assert.deepEqual(
    normalizeProfileInput({ fullName: 'x'.repeat(MAX_PROFILE_NAME_LENGTH + 1), nichePrefs: [] }),
    { success: false, error: 'invalid_name' }
  );
  assert.deepEqual(
    normalizeProfileInput({ fullName: 'Ana', nichePrefs: ['not-a-niche'] }),
    { success: false, error: 'invalid_niche' }
  );
});
