import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { bandDepth, parseRecipe } from './vir-mosaic.mts';

test('band depth is 1 - Rb/Rc at the band minimum under the line joining the two anchor maxima (Frigeri et al. 2019)', () => {
  // A flat continuum at 0.05 with a 20% deep triangular band centred at 3.06 µm, anchors at 3.0 and 3.2 µm.
  const wavelengths = Array.from({ length: 41 }, (_, i) => 2.9 + i * 0.01);
  const iof = wavelengths.map(w => 0.05 * (1 - Math.max(0, 0.2 - Math.abs(w - 3.06) * 2)));
  assert.ok(Math.abs(bandDepth(wavelengths, iof, { left: [2.91, 3.01], right: [3.19, 3.24] }) - 0.2) < 1e-9);
  // A sloped continuum: the depth is measured against the line, not a flat level.
  const sloped = wavelengths.map((w, i) => iof[i] * (1 + (w - 2.9)));
  assert.ok(Math.abs(bandDepth(wavelengths, sloped, { left: [2.91, 3.01], right: [3.19, 3.24] }) - 0.2) < 0.01);
  // No anchor inside a window: no value.
  assert.ok(Number.isNaN(bandDepth(wavelengths, iof, { left: [2.5, 2.6], right: [3.19, 3.24] })));
});

test('the Ceres ammonium recipe parses: Survey and HAMO primary, LAMO then Approach as gap fill', async () => {
  const recipe = parseRecipe(JSON.parse(await readFile(resolve(import.meta.dirname, '../../../src/objects/ceres/source/science/vir-reduction/recipe.json'), 'utf8')));
  assert.deepEqual(recipe.phases.map(phase => [phase.volume, phase.role, phase.cubes.length]), [['DWNCHVIR_I1B', 'primary', 477], ['DWNCSVIR_I1B', 'primary', 195], ['DWNCLVIR_I1B', 'fill', 875], ['DWNCAVIR_I1B', 'fill', 110]]);
  assert.deepEqual(recipe.parameters.map(parameter => parameter.continuum), [{ left: [2.91, 3.01], right: [3.19, 3.24] }]);
  assert.equal(recipe.policy.maximumIncidenceDegrees, 70);
  assert.throws(() => parseRecipe({ ...recipe, schema: 'other' }), /schema/);
  assert.throws(() => parseRecipe({ ...recipe, phases: [{ ...recipe.phases[0], role: 'extra' }] }), /role/);
});
