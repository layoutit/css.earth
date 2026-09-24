#!/usr/bin/env node
import { sha256 } from '../../../../src/platform/sha256.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireRecord, requireArray } from '@cssearth/core';

function verify(bytes: Uint8Array, entry: unknown, label: string) {
  requireRecord(entry, `${label} source manifest entry`);
  if (!bytes.length) throw new Error(`${label} is empty.`);
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node author.mts <body-source-directory>');
  const source = resolve(process.argv[2]);
  const manifest = requireRecord(JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8')));
  const measurementBytes = await readFile(resolve(source, 'measurements.json'));
  const entries = (name: string) => requireArray(manifest[name], `Manifest ${name}`).map(entry => requireRecord(entry));
  verify(measurementBytes, entries('documents').find(entry => entry.path === 'measurements.json'), 'Measurement file');
  const measurements = requireRecord(JSON.parse(measurementBytes.toString('utf8')));
  const axes = requireArray(requireRecord(measurements.constraints).fullAxesKm);
  if (measurements.schema !== 'cssearth-approximate-ellipsoid@1' ||
      axes.length !== 3 || !axes.every((value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    throw new Error('Expected the existing approximate-ellipsoid measurements and three positive full axes.');
  }
  const [a, c2, c] = axes.map(x => x / 2);
  const shape = [];
  for (let lat = -90; lat <= 90; lat += 5) for (let lon = 0; lon <= 360; lon += 5) {
    const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
    const r = 1 / Math.sqrt((Math.cos(p) * Math.cos(l) / a) ** 2 + (Math.cos(p) * Math.sin(l) / c2) ** 2 + (Math.sin(p) / c) ** 2);
    shape.push(`${lon} ${lat} ${r.toFixed(12)}`);
  }
  const table = Buffer.from(shape.join('\n') + '\n');
  verify(table, entries('inputs').find(entry => entry.path === 'shape/ellipsoid.tab'), 'Ellipsoid table');
  process.stdout.write(table);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
