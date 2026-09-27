import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { selectedObjectIds } from '@cssearth/bake/delivery';
import { parseChartAssetRecipe } from '../objects/charts/charts.ts';
import { refreshObjectCharts } from '../objects/content/refresh-charts.mts';
import { refuseDirectRun } from '../cli/library-entry.mts';

export async function prepareCharts(args: readonly string[] = [], root = resolve(import.meta.dirname, '../..')) {
  const write = args.includes('--write');
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
}

refuseDirectRun(import.meta);
