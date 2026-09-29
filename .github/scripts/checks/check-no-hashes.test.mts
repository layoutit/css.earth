import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashLines } from './check-no-hashes.mts';

const encode = (text: string) => new TextEncoder().encode(text);
// Built at run time, so this test file itself holds no 64-digit hex string.
const digest = 'ab'.repeat(32);

test('a SHA-256 anywhere but an object inventory is refused, with its file and line', () => {
  assert.deepEqual(hashLines('src/objects/moon/source/manifest.json', encode(`{\n  "sha256": "${digest}"\n}`)),
    [`src/objects/moon/source/manifest.json:2: "sha256": "${digest}"`]);
  assert.equal(hashLines('docs/notes.md', encode(`restored from runtime-assets/${digest}/moon.webp`)).length, 1);
});

test('an object inventory, a binary file and shorter or longer hex runs pass', () => {
  assert.deepEqual(hashLines('src/objects/moon/inventory.json', encode(`"sha256": "${digest}"`)), []);
  assert.deepEqual(hashLines('public/moon.webp', new Uint8Array([0x52, 0, ...encode(digest)])), []);
  assert.deepEqual(hashLines('site/colors.css', encode(`--a: #${'c'.repeat(6)}; id ${'f'.repeat(40)} ${'e'.repeat(65)}`)), []);
});
