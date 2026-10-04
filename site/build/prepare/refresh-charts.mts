import { PREPARED_CONTENT_SCHEMA, readChartAssetRecipe, readPreparedChartContentRecord } from '@cssearth/objects';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { sha256 } from '@cssearth/core/node';
import { inventoryText, readInventory, type InventoryAsset } from '@cssearth/objects/node';
import { inventoryAssets } from '@cssearth/bake/delivery';
import { installRuntimeAssets } from '@cssearth/bake/asset-publication';
import { writePreparedSet, type PreparedOutput } from '@cssearth/bake/delivery';
import { parseChartAssetRecipe, prepareChartAssets } from '../charts/charts.ts';

/** Refresh existing charts and their intrinsic sizes without rebaking surfaces or galleries.
 * The full authored-preparation receipt is deliberately left alone: this is a partial preparation.
 */
export async function refreshObjectCharts(root: string, id: string, write = false) {
  if (!/^[a-z][a-z0-9-]*$/.test(id)) throw new TypeError('Unsafe chart object id.');
  const objectDirectory = resolve(root, 'src/objects', id), sourceDirectory = resolve(objectDirectory, 'source');
  const recipe = parseChartAssetRecipe(readChartAssetRecipe(JSON.parse(await readFile(resolve(sourceDirectory, 'content/charts.json'), 'utf8'))));
  if (recipe.publicBase !== `/scenes/${id}/` || !recipe.charts.length ||
      new Set(recipe.charts.map(c => c.output)).size !== recipe.charts.length ||
      recipe.charts.some(c => !/^[a-z0-9][a-z0-9._-]*\.svg$/.test(c.output))) throw new TypeError('Invalid chart output set.');
  const stage = write ? await mkdtemp(resolve(tmpdir(), 'cssearth-charts-')) : resolve(root, 'output/chart-recipes', id);
  try {
    const result = await prepareChartAssets({ sourceDirectory, publicDirectory: stage, config: { ...recipe, gallery: undefined } });
    if (!write) return result.dimensions;
    const inventory = await readInventory(id, objectDirectory);
    if (!inventory) throw new Error(`${id}: chart refresh needs an existing inventory.`);
    const assets = await inventoryAssets(root, [id]);
    const contentAsset = assets.find(a => a.location === 'prepared' && a.filename === 'content.json');
    if (!contentAsset) throw new Error(`${id}: no prepared content in inventory.`);
    // Restore only missing content. Refuse to overwrite a contributor's local edits.
    const previous = await readFile(contentAsset.file).catch(async (error: unknown) => {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
      await installRuntimeAssets([contentAsset]);
      return readFile(contentAsset.file);
    });
    if (previous.length !== contentAsset.bytes || sha256(previous) !== contentAsset.sha256) throw new Error(`${id}: local content differs from inventory.`);
    const content = readPreparedChartContentRecord(JSON.parse(previous.toString('utf8')));
    if (content.schema !== PREPARED_CONTENT_SCHEMA || content.objectId !== id) throw new TypeError('Incompatible prepared chart content.');
    const charts = requireArray(content.charts).map(value => {
      const chart = requireRecord(value), src = requireString(chart.src);
      const size = result.dimensions.find(d => d.src === src);
      if (!size) throw new Error(`${id}: chart content and recipe disagree: ${src}.`);
      return { ...chart, ...size };
    });
    if (charts.length !== result.dimensions.length || new Set(charts.map(c => c.src)).size !== charts.length)
      throw new Error(`${id}: chart content and recipe disagree.`);
    const replacements = new Map<string, InventoryAsset>(), writes: PreparedOutput[] = [];
    const replace = (location: 'prepared' | 'public', filename: string, bytes: Buffer) => {
      const target = assets.find(a => a.location === location && a.filename === filename);
      if (!target) throw new Error(`${id}: new chart outputs require full object preparation: ${filename}.`);
      replacements.set(`${location}/${filename}`, { location, filename, bytes: bytes.length, sha256: sha256(bytes) });
      writes.push({ path: target.file, text: bytes });
    };
    for (const chart of recipe.charts) replace('public', chart.output, await readFile(resolve(stage, chart.output)));
    replace('prepared', 'content.json', Buffer.from(`${JSON.stringify({ ...content, charts })}\n`));
    writes.push({ path: resolve(objectDirectory, 'inventory.json'), text: inventoryText({ ...inventory,
      assets: inventory.assets.map(a => replacements.get(`${a.location}/${a.filename}`) ?? a) }) });
    await writePreparedSet(writes);
    return result.dimensions;
  } finally {
    if (write) await rm(stage, { recursive: true, force: true });
  }
}
