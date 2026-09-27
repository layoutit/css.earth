import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp, { type OverlayOptions } from 'sharp';
import { inventoriedObjectIds } from '../assets/runtime-assets.mts';
import { parseChartAssetRecipe } from '../objects/charts/charts.ts';
import { escapeXml } from '../objects/charts/chart-style.mts';
import { refreshObjectCharts } from '../objects/charts/refresh-charts.mts';
import { refuseDirectRun } from '../cli/library-entry.mts';

// Illustrations use the same source recipes and SVG renderer as the live panels.
export async function prepareChartCatalog(args: readonly string[] = [], root = resolve(import.meta.dirname, '../..')) {
  if (args.some(arg => arg !== '--write')) throw new Error('Usage: prepare-chart-catalog.mts [--write]');
  const entries: { id: string; kind: string; output: string; variant: string; png: Buffer }[] = [];
  for (const id of inventoriedObjectIds([], root)) {
    const raw = await readFile(resolve(root, 'src/objects', id, 'source/content/charts.json'), 'utf8').catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
      throw error;
    });
    if (raw === null) continue;
    const recipe = parseChartAssetRecipe(JSON.parse(raw));
    if (!recipe.charts.length) continue;
    await refreshObjectCharts(root, id);
    for (const chart of recipe.charts) entries.push({ id, kind: chart.kind, output: chart.output,
      variant: chart.kind === 'measured-spectrum' ? chart.model ? 'points + model' : chart.mode : '',
      png: await sharp(resolve(root, 'output/chart-recipes', id, chart.output), { density: 144 }).png().toBuffer() });
  }
  async function board(items: typeof entries, path: string) {
    const cellWidth = 692, cellHeight = 860, composite: OverlayOptions[] = [];
    for (const [index, entry] of items.entries()) {
      const left = index % 3 * cellWidth + 40, top = Math.floor(index / 3) * cellHeight + 32;
      const label = `<svg width="612" height="52"><text x="0" y="19" font-family="sans-serif" font-size="20" fill="#ddd">${escapeXml(entry.id)} · ${entry.kind}${entry.variant ? ` · ${entry.variant}` : ''}</text></svg>`;
      composite.push({ input: Buffer.from(label), left, top }, { input: entry.png, left, top: top + 55 });
    }
    await sharp({ create: { width: cellWidth * 3, height: cellHeight * Math.ceil(items.length / 3), channels: 3, background: '#111111' } })
      .composite(composite).png({ compressionLevel: 9 }).toFile(path);
  }
  const examples = entries.filter(e => e.id === 'mars' && e.kind !== 'phase' || e.id === 'saturn' && e.kind === 'phase' ||
    ['hd-189733b', 'trappist-1', 'wasp-18b'].includes(e.id));
  const output = args.includes('--write') ? resolve(root, 'docs/images') : resolve(root, 'output/chart-recipes');
  await mkdir(output, { recursive: true });
  await board(examples, resolve(output, 'chart-recipes.png'));
  for (let i = 0; i < entries.length; i += 9) await board(entries.slice(i, i + 9), resolve(root, `output/chart-recipes/all-${i / 9 + 1}.png`));
  console.log(`${entries.length} charts inspected through source recipes; ${examples.length} illustrated catalogue examples. ${output}/chart-recipes.png`);
}

refuseDirectRun(import.meta);
