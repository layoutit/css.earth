/** Exit 1 alone cannot qualify a mutation when its intended family was not observed. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expected, checkFamilies } from './verify.mts';
test('missing intended families and malformed contracts fail closed', () => {
  assert.deepEqual(checkFamilies(['errors', 'content'], '{"family":"errors"}\n{"family":"content"}\nDIFFERENT\n'), ['content', 'errors']);
  assert.throws(() => checkFamilies(['errors'], '{"family":"network"}\n'), /Expected breakage family missing/u);
  assert.throws(() => expected({ schema: 'journey-breakage@1', expectedFamilies: ['invented'] }), /Invalid expected/u);
});
