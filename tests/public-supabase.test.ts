import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicFetchInit } from '../src/lib/supabase/public';

test('public Supabase fetch uses revalidation without conflicting cache flags', () => {
  const init = buildPublicFetchInit(
    {
      cache: 'no-store',
      headers: { accept: 'application/json' },
      next: { revalidate: 5, tags: ['catalog'] },
    },
    300,
  );

  assert.equal('cache' in init, false);
  assert.deepEqual(init.next, { revalidate: 300, tags: ['catalog'] });
  assert.deepEqual(init.headers, { accept: 'application/json' });
});

test('request-time public Supabase fetch opts out of Data Cache', () => {
  const init = buildPublicFetchInit(
    { cache: 'force-cache', next: { revalidate: 60, tags: ['old'] } },
    false,
  );

  assert.equal(init.cache, 'no-store');
  assert.equal('next' in init, false);
});
