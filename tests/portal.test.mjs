import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { externalGames } from '../catalog.mjs';
import { directory } from '../directory.mjs';
import { selectItems, readPreferences, remember, safeExternalUrl } from '../portal-state.mjs';

test('preserves all 116 original game cards with existing local artwork and safe URLs', () => {
  assert.equal(externalGames.length, 116);
  assert.equal(new Set(externalGames.map((item) => item.id)).size, 116);
  for (const item of externalGames) {
    assert.ok(item.title);
    assert.ok(safeExternalUrl(item.url));
    assert.ok(existsSync(new URL(`../${item.image}`, import.meta.url)), item.image);
  }
});

const items = [
  { id: 'a', title: 'Acción rápida', category: 'Arcade', kind: 'local' },
  { id: 'b', title: 'Ajedrez', category: 'Mesa', kind: 'external-game' },
  { id: 'c', title: 'RTVE Play', category: 'Directos', kind: 'link', section: 'football' },
];
test('search ignores accents and combines section, category and all search words', () => {
  assert.deepEqual(selectItems(items, { section: 'local', query: 'ACCION rap' }).map((item) => item.id), ['a']);
  assert.deepEqual(selectItems(items, { section: 'games' }).map((item) => item.id), ['a', 'b']);
  assert.equal(selectItems(items, { section: 'football', category: 'Mesa' }).length, 0);
  assert.equal(selectItems(items, { query: 'accion inexistente' }).length, 0);
  assert.deepEqual(selectItems(items, { section: 'favorites', favorites: ['b'] }).map((item) => item.id), ['b']);
  assert.deepEqual(selectItems(items, { section: 'recent', recent: ['b', 'a'] }).map((item) => item.id), ['b', 'a']);
});

test('corrupt, unavailable and stale storage never prevents playing', () => {
  const ids = new Set(['a', 'b']);
  const empty = { favorites: [], recent: [], scores: {} };
  assert.deepEqual(readPreferences({ getItem() { throw Error('denied'); } }, ids), empty);
  assert.deepEqual(readPreferences({ getItem: () => '{bad' }, ids), empty);
  assert.deepEqual(readPreferences({ getItem: () => 'null' }, ids), empty);
  assert.deepEqual(readPreferences({ getItem: () => JSON.stringify({ favorites: ['a', 'a', 'unknown'], recent: ['b'], scores: { a: 12, b: '999', unknown: 44 } }) }, ids), { favorites: ['a'], recent: ['b'], scores: { a: 12 } });
});

test('recents are unique, most recent first and bounded', () => {
  assert.deepEqual(remember(['a', 'b'], 'b'), ['b', 'a']);
  assert.equal(remember(Array.from({ length: 40 }, (_, i) => String(i)), 'new').length, 30);
});

test('external navigation rejects script URLs, insecure schemes and credentials', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,hi', 'http://example.com', 'https://user:password@example.com', '/relative']) assert.equal(safeExternalUrl(url), null);
  for (const item of directory) assert.ok(safeExternalUrl(item.url), item.title);
  assert.equal(directory.length, 43);
});
