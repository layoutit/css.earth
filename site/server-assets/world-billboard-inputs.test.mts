import assert from 'node:assert/strict';
import test from 'node:test';
import { worldBillboardInputs } from './world-billboard-inputs.mts';

test('the resolver and cache share implicit and explicit owners, with null/plain/external exclusions', () => {
  const plan = worldBillboardInputs({ bodies: {
    id: ['implicit', 'explicit', 'plain', 'bare', 'external'],
    billboard: [{}, { url: '/scenes/image-bank/explicit.webp' }, {}, null, { url: 'https://other.example/picture.webp' }],
    plainDot: [null, null, true, null, null],
  } });
  assert.deepEqual(plan?.inputs.map(({ index, address, owner }) => ({ index, address, owner })), [
    { index: 0, address: '/scenes/implicit/implicit-billboard.webp', owner: 'implicit' },
    { index: 1, address: '/scenes/image-bank/explicit.webp', owner: 'image-bank' },
    { index: 4, address: 'https://other.example/picture.webp', owner: undefined },
  ]);
  assert.equal(worldBillboardInputs({ bodies: { id: ['bare'] } }), null);
  assert.throws(() => worldBillboardInputs({ bodies: { id: ['bad'], billboard: [] } }), /equal length/u);
});
