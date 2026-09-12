#!/usr/bin/env node
/** Write a sample of archived DRACO intercepts (pixel and body-fixed km) for the SpiceyPy oracle to place independently. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodePds4GeometryCube } from '../../objects/terrestrial-layers/pds4-geometry-cube.mts';
const root = resolve(import.meta.dirname, '../../../src/planets/dimorphos/source');
const config = JSON.parse(await readFile(resolve(root, 'preparation/terrestrial.json'), 'utf8'));
const recipe = config.raster.surfaceObservations.find((entry: { id: string }) => entry.id === 'draco');
const name = 'dart_0401930040_12262_01_geo.fits';
const cube = decodePds4GeometryCube(await readFile(resolve(root, recipe.path)), await readFile(resolve(root, recipe.labelPath), 'utf8'), { fileName: name, cube: recipe.cube, filter: recipe.filter });
const points = [];
for (let i = 0; i < cube.width * cube.height; i += 4001) if (cube.valid(i)) points.push({ pixel: [i % cube.width, Math.floor(i / cube.width)], xyz: cube.xyz(i) });
const out = process.argv[2] ?? resolve(import.meta.dirname, '../../../.local/oracles/dart-draco-points.json');
await writeFile(out, JSON.stringify(points));
console.log(`${points.length} archived intercepts written to ${out}`);
