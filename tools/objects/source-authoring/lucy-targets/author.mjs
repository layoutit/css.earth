#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

function verify(bytes, entry, label) {
  if (!entry || bytes.length !== entry.expectedBytes ||
      createHash('sha256').update(bytes).digest('hex') !== entry.expectedSha256) {
    throw new Error(`${label} differs from its source manifest pin.`);
  }
}

async function main() {
  if (process.argv.length !== 3) throw new Error('Usage: node author.mjs <body-source-directory>');
  const source = resolve(process.argv[2]);
  const manifest = JSON.parse(await readFile(resolve(source, 'manifest.json')));
  const measurementBytes = await readFile(resolve(source, 'measurements.json'));
  verify(measurementBytes, manifest.documents.find(entry => entry.path === 'measurements.json'), 'Measurement file');
  const measurements = JSON.parse(measurementBytes);
  const axes = measurements.constraints?.fullAxesKm;
  if (measurements.schema !== 'cssearth-approximate-ellipsoid@1' || !Array.isArray(axes) ||
      axes.length !== 3 || !axes.every(value => Number.isFinite(value) && value > 0)) {
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
  verify(table, manifest.inputs.find(entry => entry.path === 'shape/ellipsoid.tab'), 'Ellipsoid table');
  process.stdout.write(table);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
