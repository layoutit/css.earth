import { requireRecord, requireString } from '../../../../tools/sources/source-values.mts';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('charon');
import { required } from '../../../../tools/contract/test-values.mts';
import { parseInterpreterRecipe } from '../../../../tools/objects/observation/interpret.mts';
import { decodePds4Color, mapPds4Color } from '../../../../tools/objects/terrestrial-layers/observed-pds4.mts';

const root = new URL('../../../../src/objects/charon/source/', import.meta.url);
test('Charon MVIC bands and missing masks match independent NumPy source anchors', async () => {
  const recipe = parseInterpreterRecipe(JSON.parse((await readFile(new URL('preparation/raster.json', root))).toString('utf8')));
  const manifest = JSON.parse((await readFile(new URL('manifest.json', root))).toString('utf8'));
  const policy = required(recipe.surfaces.find(surface => surface.id === 'enhanced-color')?.science, 'enhanced-color science').validity;
  const entry = manifest.inputs.find((x: { lensId: string; }) => x.lensId === 'enhanced-color');
  const source = decodePds4Color(await readFile(new URL(entry.path, root)), await readFile(new URL(requireString(requireRecord(required(policy, 'enhanced-color validity')).labelPath), root), 'utf8'), entry, policy);
  const anchors = JSON.parse((await readFile(new URL('validation/color-source-inspection.json', root))).toString('utf8'));
  assert.equal(source.sourceMissingPixels, 3145121);
  assert.equal(source.valid.reduce((a, b) => a + b), anchors.validRgbPixels);
  const stride = source.grid.width * source.grid.height;
  for (const anchor of anchors.anchors) {
    const i = anchor.nearest[1] * source.grid.width + anchor.nearest[0];
    assert.equal(Boolean(source.valid[i]), anchor.valid);
    for (let b = 0; b < 4; b++) assert.equal(source.values[b * stride + i], anchor.bands[b]);
  }
  const mapped = mapPds4Color(source, policy, 360, 180);
  assert.equal(mapped.missing[10 * 360], 0, 'Northern pole-region observation remains present');
  assert.ok(mapped.rgb[10 * 360 * 3] > mapped.rgb[10 * 360 * 3 + 2], 'Independent mission red-pole color anchor');
  assert.equal(mapped.missing[140 * 360], 1, 'Dark southern cap is absent');
  assert.equal(mapped.missing[90 * 360 + 180], 1, 'Unobserved anti-Pluto longitude remains absent');
});
