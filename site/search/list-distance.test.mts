import assert from 'node:assert/strict';
import { test } from 'node:test';
import { listDistance } from './list-distance.mts';

test('a list row reads parsecs past a thousand in kpc or Mpc, and keeps nearer distances as they are', () => {
  assert.deepEqual(listDistance({ value: 776247.108, unit: 'pc' }), { value: '776.2', unit: 'kpc' });
  assert.deepEqual(listDistance({ value: 2089296.135, unit: 'pc' }), { value: '2.089', unit: 'Mpc' });
  assert.deepEqual(listDistance({ value: 8277, unit: 'pc' }), { value: '8.277', unit: 'kpc' });
  assert.deepEqual(listDistance({ value: 12.4660001, unit: 'pc' }), { value: '12.466', unit: 'pc' });
  assert.deepEqual(listDistance({ value: 9.4430004, unit: 'AU' }), { value: '9.443', unit: 'AU' });
});
