/** What the default camera shows, from the runtime's camera math and the pinned records, with no browser. The star's presentation
 * frame puts its measured spin axis up, so the camera orbit lies in its equator and the default view sits one degree from the
 * sub-Earth point. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { angularSeparationDegrees, defaultViewGeometry } from '../../../../tools/objects/default-view.mts';
import { requireBodyFixedToIcrf } from '../../../../src/platform/solar-geometry.mts';
import { requireRecord } from '../../../../tools/sources/source-values.mts';

for (const id of ['hd-189733', 'hd-189733-companion']) {
  test(`${id}: the default camera looks at the Earth-facing hemisphere with the pole up`, async () => {
    const body = resolve(import.meta.dirname, '../../../../src/objects', id);
    const json = async (path: string) => JSON.parse(await readFile(resolve(body, path), 'utf8')) as unknown;
    const descriptor = requireRecord(await json('object.json')), runtime = requireRecord(await json('prepared/runtime.json'));
    const view = defaultViewGeometry(id, requireRecord(runtime.camera) as never, requireRecord(requireRecord(descriptor.properties).worldFrame) as never);
    const separation = angularSeparationDegrees(view.subCamera, { longitudeDegrees: 0, latitudeDegrees: 0 });
    assert.ok(separation < 1.5, `default view ${separation.toFixed(2)} degrees from the sub-Earth point`);
    const m = requireBodyFixedToIcrf(id);
    assert.ok(Math.abs(view.screen([m[2]!, m[5]!, m[8]!]).angleDegrees - 90) < 0.1, 'the pole is straight up');
  });
}
