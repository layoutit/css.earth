#!/usr/bin/env node
/** A published corona simulation (a BATS-R-US solution in Tecplot binary) resampled onto a cube about the star.
 *
 *   node packages/bake/authoring/eps-eridani-corona/simulation.mts inspect <file.plt>
 *
 * `resample` returns mass density (g/cm³) and magnetic field strength (gauss) on a 128³ cube of ±4 stellar radii in the
 * simulation's own axes, x fastest, with what was measured on them. Each cell of the simulation paints the voxels whose
 * centres fall inside its bounding box with the mean of its corner values; a cell smaller than a voxel adds to the voxel
 * that holds its centre. Voxels no cell reaches stay empty (NaN). */
import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PROTON_MASS_G } from './corona-models.mts';
import { openTecplot, readTecplotVariable } from './tecplot-binary.mts';

export const NATIVE = Object.freeze({ size: 128, halfUnits: 4 });

export async function inspect(path: string) {
  const file = await openTecplot(path);
  return { version: file.version, title: file.title, bytes: file.bytes, variables: file.variables,
    zones: file.zones.map(zone => ({ name: zone.name, zoneType: zone.zoneType, solutionTime: zone.solutionTime, dimensions: zone.dimensions, points: zone.points, elements: zone.elements,
      nodesPerElement: zone.connectivity?.nodesPerElement, ranges: Object.fromEntries(zone.variables.filter(variable => variable.minimum !== undefined).map(variable => [variable.name, [variable.minimum, variable.maximum]])) })) };
}

const named = (names: readonly string[], pattern: RegExp) => { const found = names.find(name => pattern.test(name)); if (!found) throw new RangeError(`No variable matches ${pattern}; the file has ${names.join(', ')}.`); return found; };

export async function resample(path: string) {
  const file = await openTecplot(path), { size, halfUnits } = NATIVE, step = 2 * halfUnits / size, voxels = size ** 3;
  const densitySum = new Float64Array(voxels), fieldSum = new Float64Array(voxels), weight = new Float32Array(voxels);
  let cellsInside = 0, cellsSmall = 0, cellsTotal = 0;
  const index = (value: number) => (value + halfUnits) / step - 0.5;
  for (const [zoneIndex, zone] of file.zones.entries()) {
    if (zone.connectivity?.nodesPerElement !== 8) throw new TypeError(`Zone ${zone.name} is not made of bricks (type ${zone.zoneType}); only brick zones are resampled.`);
    const x = await readTecplotVariable(file, zoneIndex, named(file.variables, /^X\b/i)), y = await readTecplotVariable(file, zoneIndex, named(file.variables, /^Y\b/i)),
      z = await readTecplotVariable(file, zoneIndex, named(file.variables, /^Z\b/i)), rho = await readTecplotVariable(file, zoneIndex, named(file.variables, /^(rho|`r)\b/i)); // Tecplot writes the Greek letter as `r
    const bx = await readTecplotVariable(file, zoneIndex, named(file.variables, /^B_?x/i)), by = await readTecplotVariable(file, zoneIndex, named(file.variables, /^B_?y/i)),
      bz = await readTecplotVariable(file, zoneIndex, named(file.variables, /^B_?z/i));
    const handle = await open(path, 'r');
    try {
      const chunkElements = 1 << 19, chunk = Buffer.alloc(chunkElements * 32);
      // Tecplot versions before 112 number nodes from one; the smallest index of the first chunk tells which.
      let base: number | undefined;
      for (let done = 0; done < zone.elements; done += chunkElements) {
        const count = Math.min(chunkElements, zone.elements - done);
        const { bytesRead } = await handle.read(chunk, 0, count * 32, zone.connectivity.offset + done * 32);
        if (bytesRead !== count * 32) throw new RangeError('Short read of the connectivity.');
        const nodes = new Int32Array(chunk.buffer, chunk.byteOffset, count * 8);
        if (base === undefined) { let least = Infinity; for (let i = 0; i < nodes.length; i++) least = Math.min(least, nodes[i]!); base = least >= 1 && file.version < 112 ? 1 : 0; }
        for (let element = 0; element < count; element++) {
          let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, density = 0, field = 0;
          for (let corner = 0; corner < 8; corner++) {
            const node = nodes[element * 8 + corner]! - base;
            if (node < 0 || node >= zone.points) throw new RangeError(`Element ${done + element} names node ${node}, outside the zone's ${zone.points}.`);
            const px = x[node]!, py = y[node]!, pz = z[node]!;
            if (px < x0) x0 = px; if (px > x1) x1 = px; if (py < y0) y0 = py; if (py > y1) y1 = py; if (pz < z0) z0 = pz; if (pz > z1) z1 = pz;
            density += rho[node]!; field += Math.hypot(bx[node]!, by[node]!, bz[node]!);
          }
          cellsTotal++;
          if (x1 < -halfUnits || x0 > halfUnits || y1 < -halfUnits || y0 > halfUnits || z1 < -halfUnits || z0 > halfUnits) continue;
          cellsInside++; density /= 8; field /= 8;
          let i0 = Math.ceil(index(x0)), i1 = Math.floor(index(x1)), j0 = Math.ceil(index(y0)), j1 = Math.floor(index(y1)), k0 = Math.ceil(index(z0)), k1 = Math.floor(index(z1));
          if (i0 > i1 || j0 > j1 || k0 > k1) { cellsSmall++; i0 = i1 = Math.round(index((x0 + x1) / 2)); j0 = j1 = Math.round(index((y0 + y1) / 2)); k0 = k1 = Math.round(index((z0 + z1) / 2)); }
          for (let k = Math.max(0, k0); k <= Math.min(size - 1, k1); k++) for (let j = Math.max(0, j0); j <= Math.min(size - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(size - 1, i1); i++) {
            const o = (k * size + j) * size + i; densitySum[o] += density; fieldSum[o] += field; weight[o] += 1;
          }
        }
      }
    } finally { await handle.close(); }
  }
  const density = new Float32Array(voxels), field = new Float32Array(voxels);
  let covered = 0, outsideStar = 0;
  for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const o = (k * size + j) * size + i, radius = Math.hypot(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step, -halfUnits + (k + 0.5) * step);
    if (radius >= 1 && radius <= halfUnits) outsideStar++;
    if (weight[o]! > 0) { density[o] = densitySum[o]! / weight[o]!; field[o] = fieldSum[o]! / weight[o]!; if (radius >= 1 && radius <= halfUnits) covered++; }
    else { density[o] = NaN; field[o] = NaN; }
  }
  // Shells: the spread of density over the sphere at each radius says how far from uniform the corona is.
  const M_P = PROTON_MASS_G, shells = [1.1, 1.25, 1.5, 2, 2.5, 3, 3.5, 3.9].map(radius => {
    const values: number[] = [], fields: number[] = [];
    for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const r = Math.hypot(-halfUnits + (i + 0.5) * step, -halfUnits + (j + 0.5) * step, -halfUnits + (k + 0.5) * step), o = (k * size + j) * size + i;
      if (Math.abs(r - radius) < step && Number.isFinite(density[o]!)) { values.push(density[o]! / M_P); fields.push(field[o]!); }
    }
    values.sort((a, b) => a - b); fields.sort((a, b) => a - b);
    const at = (list: number[], share: number) => list[Math.min(list.length - 1, Math.floor(share * list.length))] ?? NaN;
    return { radius, voxels: values.length, electronsPerCm3: { mean: values.reduce((sum, value) => sum + value, 0) / values.length, p05: at(values, 0.05), median: at(values, 0.5), p95: at(values, 0.95) },
      gauss: { median: at(fields, 0.5), p95: at(fields, 0.95) } };
  });
  return { density, field, measured: { version: file.version, title: file.title, solutionTime: file.zones[0]?.solutionTime, cube: { ...NATIVE }, cellsTotal, cellsInside, cellsSmallerThanAVoxel: cellsSmall,
    coveredShare: covered / outsideStar, shells } };
}

const direct = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (direct) {
  const [command, path] = process.argv.slice(2);
  if (command !== 'inspect' || !path) throw new TypeError('Usage: simulation.mts inspect <file.plt>');
  console.log(JSON.stringify(await inspect(path), null, 1));
}
