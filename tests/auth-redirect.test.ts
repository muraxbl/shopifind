import assert from 'node:assert/strict';
import test from 'node:test';
import { isProtectedPath, safeNextPath } from '../src/lib/auth/redirect';

test('safeNextPath keeps valid internal paths and query strings', () => {
  assert.equal(safeNextPath('/wishlist'), '/wishlist');
  assert.equal(safeNextPath('/product/example?from=login'), '/product/example?from=login');
});

test('safeNextPath rejects external and encoded redirect payloads', () => {
  const fallback = '/wishlist';
  assert.equal(safeNextPath('https://attacker.example', fallback), fallback);
  assert.equal(safeNextPath('//attacker.example/path', fallback), fallback);
  assert.equal(safeNextPath('/%2f%2fattacker.example', fallback), fallback);
  assert.equal(safeNextPath('/%5c%5cattacker.example', fallback), fallback);
  assert.equal(safeNextPath('/%E0%A4%A', fallback), fallback);
});

test('isProtectedPath matches route boundaries, not lookalike prefixes', () => {
  const protectedPaths = ['/wishlist', '/account', '/settings'];
  assert.equal(isProtectedPath('/wishlist', protectedPaths), true);
  assert.equal(isProtectedPath('/wishlist/shared', protectedPaths), true);
  assert.equal(isProtectedPath('/wishlist-public', protectedPaths), false);
  assert.equal(isProtectedPath('/accounting', protectedPaths), false);
});
