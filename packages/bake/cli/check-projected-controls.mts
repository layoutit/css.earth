/**
 * Inspect published planetocentric controls in native image pixels, without fitting or qualifying a camera. The work is
 * `checkProjectedControlRecipe` in `@cssearth/bake/objects/surface-features`.
 *
 *   node packages/bake/cli/check-projected-controls.mts RECIPE INPUT_DIRECTORY OUTPUT_DIRECTORY
 */
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkProjectedControlRecipe } from '@cssearth/bake/objects/surface-features';

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [recipe, inputs, output, ...extra] = process.argv.slice(2);
  if (!recipe || !inputs || !output || extra.length) throw new Error('Usage: node packages/bake/cli/check-projected-controls.mts RECIPE INPUT_DIRECTORY OUTPUT_DIRECTORY');
  if (resolve(output) === dirname(resolve(recipe))) throw new Error('Write diagnostics to an output directory, then inspect them before promotion.');
  const report = await checkProjectedControlRecipe(resolve(recipe), resolve(inputs), resolve(output));
  console.log(JSON.stringify(report.models.map(m => ({ model: m.id, controls: m.controls.map(c => ({ id: c.id, visible: c.visible, residualPixels: c.residualPixels, distanceFromRegionPixels: c.distanceFromIdentificationRegionPixels })) })), null, 2));
}
