import { expect, it } from 'vitest';
import { sha256 } from './index.js';

it('sha256 addresses text (UTF-8) and its bytes alike, as 64 lowercase hex characters', () => {
  expect(sha256(new TextEncoder().encode('abc'))).toBe(sha256('abc'));
  expect(sha256(Buffer.from('é'))).toBe(sha256('é'));
  expect(sha256('abc')).toMatch(/^[0-9a-f]{64}$/u);
  expect(sha256('abd')).not.toBe(sha256('abc'));
});
