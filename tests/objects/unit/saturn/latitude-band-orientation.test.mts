import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('saturn');

import { orientLatitudeBands } from '../../../../tools/objects/observation/projection.mts';

test("orients rows inside each latitude band without crossing bands", () => {
  const source = Buffer.from([1, 1, 2, 2, 3, 3, 4, 4]);
  const oriented = orientLatitudeBands(
    source,
    { width: 2, height: 4, channels: 1, bandCount: 2 },
  );

  assert.deepEqual([...oriented], [2, 2, 1, 1, 4, 4, 3, 3]);
  assert.deepEqual([...source], [1, 1, 2, 2, 3, 3, 4, 4]);
});
