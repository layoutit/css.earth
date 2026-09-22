/** What the default camera shows, from the runtime's camera math and the pinned records, with no browser: the substellar point,
 * with the orbit normal up. The atlas is painted with longitude 0 at its first column, as the mesh places every atlas. */
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('wasp-43b');
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { angularSeparationDegrees, defaultViewGeometry } from '../../../../tools/objects/default-view.mts';
import { requireBodyFixedToIcrf } from '../../../../src/platform/solar-geometry.mts';
import { requireArray, requireRecord } from '../../../../tools/sources/source-values.mts';

const BODY = resolve(import.meta.dirname, '../../../../src/objects/wasp-43b');
const json = async (path: string) => JSON.parse(await readFile(resolve(BODY, path), 'utf8')) as unknown;

test('the default camera looks at the substellar point with the orbit normal up', async () => {
  const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
  const view = defaultViewGeometry('wasp-43b', requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
  const separation = angularSeparationDegrees(view.subCamera, { longitudeDegrees: 0, latitudeDegrees: 0 });
  assert.ok(separation < 1.5, `default view ${separation.toFixed(2)} degrees from the substellar point`);
  const m = requireBodyFixedToIcrf('wasp-43b');
  assert.ok(Math.abs(view.screen([m[2]!, m[5]!, m[8]!]).angleDegrees - 90) < 0.1, 'the pole is straight up');
  const science = requireRecord(requireRecord(requireArray(requireRecord(await json('source/preparation/raster.json')).surfaces)[0]).science);
  assert.equal(science.outputLongitudeOrigin, 0);
});
