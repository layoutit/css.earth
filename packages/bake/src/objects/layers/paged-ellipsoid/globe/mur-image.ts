import { readJsonSource } from '../../../sources/index.ts';
import { requireString } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { parseMurReceipt } from '../source-contract.ts';
import type { EnsoRecipe } from '../contracts.ts';

// The prepared NASA MUR anomaly image and its colour legend, read by the paged-ellipsoid assets. Acquiring and mosaicking the
// tiles is Earth's authoring (packages/bake/authoring/earth/mur-imagery.mts), which reads the colour table through this module.
function demand(ok: unknown, why: string): asserts ok { if (!ok) throw new Error(`MUR imagery: ${why}`); };

export function parseMurColors(xml: string) {
  const entries = [...xml.matchAll(/<ColorMapEntry\s+([^>]+)\/>/g)].map(match => {
    const attrs = Object.fromEntries([...match[1].matchAll(/([\w]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
    return { rgb: requireString(attrs.rgb, "MUR RGB color").split(',').map(Number), nodata: attrs.nodata === 'true', transparent: attrs.transparent === 'true', range: attrs.value };
  });
  const valid = entries.filter(e => !e.nodata);
  demand(entries.length === 63 && valid.length === 62 && entries[0].transparent, 'color table changed');
  demand(valid[0].range === '[-INF,-3.0)' && valid[valid.length - 1].range === '[3.0,+INF)', 'saturation endpoints changed');
  const bins = valid.slice(1, -1);
  demand(bins.every((e, i) => e.range === `[${(-3 + i / 10).toFixed(1)},${(-3 + (i + 1) / 10).toFixed(1)})`), 'anomaly bins changed');
  return { entries, bins, under: valid[0], over: valid[valid.length - 1] };
}

export async function verifyPreparedMurImage(sourceDirectory: string, recipe: Pick<EnsoRecipe, "date" | "baseline">) {
  const receipt = parseMurReceipt(await readJsonSource(join(sourceDirectory, 'science/mur-gibs-receipt.json')));
  demand(recipe.date === receipt.date && recipe.baseline === '2003–2014' && receipt.baseline === recipe.baseline, 'date or baseline differs');
  demand(receipt.complete && receipt.tiles.length === 3200 && receipt.grid.level === 6, 'incomplete source grid');
  const input = await readFile(join(sourceDirectory, 'science/mur-gibs.png'));
  const info = await sharp(input).metadata();
  demand(info.width === 16384 && info.height === 8192, 'prepared source dimensions changed');
  return input;
}

export async function writeMurLegend(sourceDirectory: string, outputPath: string) {
  const { entries } = parseMurColors(await readFile(join(sourceDirectory, 'science/mur-gibs-colormap.xml'), 'utf8'));
  const colors = entries.filter(e => !e.nodata), width = colors.length * 10, height = 16;
  const data = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) data.set(colors[Math.floor(x / 10)].rgb, (y * width + x) * 3);
  await sharp(data, { raw: { width, height, channels: 3 } }).png().toFile(outputPath);
}
