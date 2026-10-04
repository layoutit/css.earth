import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readPublishedDepthRecipe, readPublishedPhotometricMgeRecipe } from '@cssearth/objects';
import { readPublishedDepthRecipe as sourceDepthReader } from './nebula-depth-model.js';
import { readPublishedPhotometricMgeRecipe as sourcePhotometricReader } from '../emission/photometric-mge.js';

test('publication ownership readers preserve identity-only accepted records and diagnostics', () => {
  const variants = [
    { read: readPublishedDepthRecipe, schema: 'cssearth-nebula-depth-model@1', message: 'Prepared depth recipe belongs to another nebula or has an invalid schema.' },
    { read: readPublishedPhotometricMgeRecipe, schema: 'cssearth-photometric-mge@1', message: 'Prepared nebula omits its configured photometric model.' },
  ];
  variants.push({ ...variants[0]!, read: sourceDepthReader }, { ...variants[1]!, read: sourcePhotometricReader });
  for (const { read, schema, message } of variants) {
    for (const evidence of [undefined, null, { path: 'labs/nebula/models/example/evidence.json' }, {}])
      assert.deepEqual(read({ schema, id: 'example', evidence }, 'example'), { evidence });
    for (const value of [null, [], {}, { schema, id: 'other' }, { schema: 'other', id: 'example' }])
      assert.throws(() => read(value, 'example'), { name: 'Error', message });
  }
});
