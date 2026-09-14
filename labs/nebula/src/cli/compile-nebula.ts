import { readFile } from 'node:fs/promises';
import { readCompilerRecipe, compilerControlsForRecipe } from '../reconstruction/compiler/model';
import { compileNebula } from '../reconstruction/compiler/compile';
const [recipePath, extra] = process.argv.slice(2);
if (!recipePath || extra) throw new TypeError('Usage: compile-nebula <compiler-recipe.json>');
const recipe = readCompilerRecipe(JSON.parse(await readFile(recipePath, 'utf8'))), started = performance.now();
const result = await compileNebula(process.cwd(), { action: 'apply', imageId: 'compiler', recipePath, cataloguePath: recipe.structureCatalogue,
  controls: compilerControlsForRecipe(recipe), imageToFrame: {}, evidence: { sensitivity: 1, weights: [] } }, new AbortController().signal,
  (message, fraction) => console.log(`${Math.round((fraction ?? 0) * 100)}% ${message}`));
console.log(JSON.stringify({ status: 'complete', id: result.id, metrics: result.metrics, pipeline: result.pipeline, seconds: (performance.now() - started) / 1000 }, null, 2));
