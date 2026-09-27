import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectedObjectIds } from '../../assets/runtime-assets.mts';
import { parseChartAssetRecipe } from '../../objects/charts/charts.ts';
import { refreshObjectCharts } from '../../objects/charts/refresh-charts.mts';

const args = process.argv.slice(2), write = args.includes('--write');
const root = resolve(import.meta.dirname, '../../..');
const explicit = args.some(arg => arg.startsWith('--object='));
let count = 0;
for (const id of selectedObjectIds(args.filter(arg => arg !== '--write'), root)) {
  const path = resolve(root, 'src/objects', id, 'source/content/charts.json');
  const exists = await access(path).then(() => true, () => false);
  if (!exists) { if (explicit) throw new Error(`${id} has no chart recipe.`); continue; }
  const recipe = parseChartAssetRecipe(JSON.parse(await readFile(path, 'utf8')));
  if (!recipe.charts.length) continue;
  const charts = await refreshObjectCharts(root, id, write);
  count += charts.length;
  console.log(`${id}: ${charts.length} charts ${write ? 'refreshed with inventory' : 'previewed in output/chart-recipes'}.`);
}
console.log(`${count} charts. Publish changed assets before committing their inventories.`);
