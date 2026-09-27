#!/usr/bin/env node
/** A compact visual index of a native iPad screen filmstrip. */
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { isRecord } from '@cssearth/core';

export async function makeIpadStrip(directory: string, maximum = 12): Promise<string> {
  if (!Number.isInteger(maximum) || maximum < 2 || maximum > 30) throw new TypeError('Strip frame count must be 2–30.');
  const folder = resolve(directory);
  const report: unknown = JSON.parse(await readFile(resolve(folder, 'report.json'), 'utf8'));
  if (!isRecord(report) || !isRecord(report.filmstrip) || report.filmstrip.source !== 'device-screen')
    throw new Error(`${folder} has no receipt for a native iPad screen filmstrip.`);
  const names = (await readdir(resolve(folder, 'screens'))).filter(name => /^\d+\.jpg$/u.test(name)).sort();
  if (!names.length) throw new Error(`${folder} contains no native iPad screen frames.`);
  const count = Math.min(maximum, names.length);
  const selected = count === 1 ? [names[0]!] : [...new Set(Array.from({ length: count }, (_, index) => names[Math.round(index * (names.length - 1) / (count - 1))]!))];
  const first = sharp(resolve(folder, 'screens', selected[0]!));
  const meta = await first.metadata();
  if (!meta.width || !meta.height) throw new Error('The first iPad frame has no dimensions.');
  const cellWidth = 220, imageHeight = Math.round(meta.height * cellWidth / meta.width), labelHeight = 28;
  const width = selected.length * cellWidth, height = imageHeight + labelHeight;
  const start = Number(names[0]!.slice(0, -4));
  const layers = await Promise.all(selected.flatMap((name, index) => {
    const elapsed = ((Number(name.slice(0, -4)) - start) / 1000).toFixed(1);
    const label = Buffer.from(`<svg width="${cellWidth}" height="${labelHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#15171b"/><text x="8" y="19" fill="white" font-family="Arial,sans-serif" font-size="15">${elapsed} s</text></svg>`);
    return [sharp(resolve(folder, 'screens', name)).resize(cellWidth, imageHeight).jpeg({ quality: 82 }).toBuffer()
      .then(input => ({ input, left: index * cellWidth, top: labelHeight })),
    Promise.resolve({ input: label, left: index * cellWidth, top: 0 })];
  }));
  const out = resolve(folder, 'filmstrip.png');
  await sharp({ create: { width, height, channels: 4, background: '#15171b' } }).composite(layers).png().toFile(out);
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2];
  if (!directory) throw new TypeError('Usage: node labs/performance/ipad-strip.mts <capture-directory>');
  console.log(await makeIpadStrip(directory));
}
