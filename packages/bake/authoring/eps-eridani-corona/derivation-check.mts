#!/usr/bin/env node
/** The corona derived from a magnetic map (`@cssearth/bake/objects/stellar`, corona/) against the published simulation of
 * ε Eridani, map by map and shell by shell: the test the method's document quotes.
 *
 *   node packages/bake/authoring/eps-eridani-corona/derivation-check.mts
 *
 * The derivation is given what it is given for any star: the radial field at the surface (here the simulation's own inner
 * boundary, which is the observed map), the X-ray luminosity, the X-ray temperature and the mass loss. For every voxel of a
 * shell it prints the correlation of log density with the simulation, the model's geometric-mean density over the
 * simulation's, and the rms factor between them. It needs the three equator runs under .local/eps-eridani-corona and
 * reports a SKIP without them. */
import { projectRoot } from '@cssearth/core/node';
import { KELVIN_PER_KEV, PROTON_MASS_G, SECONDS_PER_YEAR, SHEET_CORONA, SOLAR_MASS_G, expandSurfaceField, hydrostaticCorona, neutralLine, openShare, parkerWind, sheetCoronaDensity,
  type SurfaceFieldMap } from '@cssearth/bake/objects/stellar';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SIMULATION, STAR, WIND, runPath } from './author.mts';
import { NATIVE, resample } from './simulation.mts';
import { openTecplot, readTecplotVariable } from './tecplot-binary.mts';

const repository = projectRoot(import.meta.url), LMAX = 15, SHELLS = [1.2, 1.5, 2, 2.4, 3, 3.9];
/** ROSAT, 0.1 to 2.4 keV: Schmitt & Liefke (2004), A&A 417, 651, the value ε Eridani's README cites. */
const LOG_XRAY_LUMINOSITY = 28.35;

/** The radial field at a run's inner boundary: its nodes within 2% of the surface, averaged on 5° cells. */
async function surfaceMapOf(path: string): Promise<SurfaceFieldMap> {
  const file = await openTecplot(path), name = (pattern: RegExp) => file.variables.find(variable => pattern.test(variable))!;
  const [x, y, z, bx, by, bz] = await Promise.all([/^X\b/, /^Y\b/, /^Z\b/, /^B_?x/, /^B_?y/, /^B_?z/].map(pattern => readTecplotVariable(file, 0, name(pattern))));
  const width = 72, height = 36, sum = new Float64Array(width * height), count = new Float64Array(width * height);
  for (let i = 0; i < x!.length; i++) {
    const r = Math.hypot(x![i]!, y![i]!, z![i]!);
    if (r > 1.02 || r < 0.99) continue;
    const theta = Math.acos(z![i]! / r), phi = (Math.atan2(y![i]!, x![i]!) + 2 * Math.PI) % (2 * Math.PI);
    const cell = Math.min(height - 1, Math.floor(theta / Math.PI * height)) * width + Math.min(width - 1, Math.floor(phi / (2 * Math.PI) * width));
    sum[cell] += (bx![i]! * x![i]! + by![i]! * y![i]! + bz![i]! * z![i]!) / r; count[cell] += 1;
  }
  if (count.some(value => value === 0)) throw new Error(`${path}: the surface map has empty cells.`);
  return { width, height, radial: sum.map((value, i) => value / count[i]!) };
}

const missing: string[] = [];
for (const map of SIMULATION.maps) await access(resolve(repository, runPath(map, 'equator'))).catch(() => { missing.push(runPath(map, 'equator')); });
if (missing.length) console.log(`SKIP derivation-check: requires ${missing.join(', ')}. Download ${SIMULATION.archive} from ${SIMULATION.landing}. Nothing compared.`);
else {
  const kelvin = STAR.coronalTemperatureKeV * KELVIN_PER_KEV, star = { massSolar: STAR.massSolar, radiusSolar: STAR.radiusSolar };
  const wind = parkerWind({ massLossGramsPerSecond: WIND.massLossSolar * WIND.solarMassLossSolarMassesPerYear * SOLAR_MASS_G / SECONDS_PER_YEAR, kelvin, ...star });
  const atRest = hydrostaticCorona({ xrayLuminosityErgS: 10 ** LOG_XRAY_LUMINOSITY, kelvin, ...star, outerRadii: 4 });
  const all = { correlation: [] as number[], bias: [] as number[], scatter: [] as number[] };
  for (const map of SIMULATION.maps) {
    const path = resolve(repository, runPath(map, 'equator')), harmonics = expandSurfaceField(await surfaceMapOf(path), LMAX);
    const line = neutralLine(harmonics), open = openShare(harmonics, SHEET_CORONA.sourceRadii);
    const { density } = sheetCoronaDensity({ neutralDistanceDegrees: line.distanceDegrees, atRest: atRest.density, wind: wind.density, openShare: open });
    const { density: cube } = await resample(path), { size, halfUnits } = NATIVE, step = 2 * halfUnits / size;
    console.log(`${map.label}: open share of the sphere ${open.shares.map(([radii, share]) => `${radii} R ${share.toFixed(2)}`).join(', ')}`);
    for (const shell of SHELLS) {
      const simulated: number[] = [], derived: number[] = [];
      for (let k = 0; k < size; k++) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
        const x = -halfUnits + (i + 0.5) * step, y = -halfUnits + (j + 0.5) * step, z = -halfUnits + (k + 0.5) * step, radii = Math.hypot(x, y, z), value = cube[(k * size + j) * size + i]!;
        if (Math.abs(radii - shell) > step || !Number.isFinite(value)) continue;
        simulated.push(Math.log10(value / PROTON_MASS_G));
        derived.push(Math.log10(density(radii, Math.acos(Math.max(-1, Math.min(1, z / radii))), (Math.atan2(y, x) + 2 * Math.PI) % (2 * Math.PI))));
      }
      const n = simulated.length, ma = simulated.reduce((s, v) => s + v, 0) / n, mb = derived.reduce((s, v) => s + v, 0) / n;
      let ab = 0, aa = 0, bb = 0, square = 0;
      for (let i = 0; i < n; i++) { ab += (simulated[i]! - ma) * (derived[i]! - mb); aa += (simulated[i]! - ma) ** 2; bb += (derived[i]! - mb) ** 2; square += (derived[i]! - simulated[i]!) ** 2; }
      const correlation = ab / Math.sqrt(aa * bb), bias = mb - ma, scatter = Math.sqrt(square / n);
      all.correlation.push(correlation); all.bias.push(Math.abs(bias)); all.scatter.push(scatter);
      console.log(`  ${shell.toFixed(1)} R (${n} voxels): correlation ${correlation.toFixed(2)}, derived / simulated ${(10 ** bias).toFixed(2)}, rms factor ${(10 ** scatter).toFixed(1)}`);
    }
  }
  const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;
  console.log(`Over ${all.correlation.length} shells: mean correlation ${mean(all.correlation).toFixed(2)} (${Math.min(...all.correlation).toFixed(2)} to ${Math.max(...all.correlation).toFixed(2)}), mean offset a factor ${(10 ** mean(all.bias)).toFixed(2)}, rms factor ${(10 ** mean(all.scatter)).toFixed(2)}`);
}
