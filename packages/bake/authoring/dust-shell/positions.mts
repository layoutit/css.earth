/**
 * Dots through a round shell of dust about a star, their spread taken from a published model of the shell.
 *
 * Nobody has measured where single grains are. What a paper fits to the star's infrared light is a shell: an inner and an
 * outer radius, and a density that follows a power of the distance, rho(r) ∝ r^exponent. This draws a fixed number of
 * dots whose distances from the star follow that density: the share of dots inside a radius grows as r^(exponent + 3)
 * between the two radii. Each dot's direction is uniform over the sphere, because the model is round. Distances and
 * directions come from a seeded generator, so no dot is a measurement; nothing else is authored.
 *
 * Usage: node packages/bake/authoring/dust-shell/positions.mts <bank id> <inner au> <outer au> <density exponent> <dots>
 */
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

/** The generator's seed: a display choice, not a measurement. */
const SEED = 20250401, AU_KM = 149597870.7;
const [bank = '', ...numbers] = process.argv.slice(2), [innerAu, outerAu, exponent, dots] = numbers.map(Number);
if (!/^[a-z][a-z0-9-]*$/u.test(bank) || numbers.length !== 4 || !(innerAu! > 0) || !(outerAu! > innerAu!) || !Number.isFinite(exponent) || !(exponent! > -3) || !Number.isInteger(dots) || dots! < 1) {
  throw new TypeError(`Usage: positions.mts <bank id> <inner au> <outer au> <density exponent above -3> <dots>; got ${JSON.stringify(process.argv.slice(2))}.`);
}
// mulberry32: a fixed, published 32-bit generator, so the same dots come out on every machine.
let state = SEED;
const random = () => {
  state = state + 0x6D2B79F5 | 0;
  let t = Math.imul(state ^ state >>> 15, 1 | state);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
// The share of the shell's dust inside r is (r^k - inner^k) / (outer^k - inner^k), with k = exponent + 3.
const k = exponent! + 3, low = innerAu! ** k, span = outerAu! ** k - low;
const rows: string[] = [], radii: number[] = [];
for (let dot = 1; dot <= dots!; dot++) {
  const radiusAu = (low + random() * span) ** (1 / k), z = 2 * random() - 1, longitude = 2 * Math.PI * random(), across = Math.sqrt(1 - z * z);
  radii.push(radiusAu);
  rows.push(`${dot},${[across * Math.cos(longitude), across * Math.sin(longitude), z].map(axis => (axis * radiusAu * AU_KM).toFixed(0)).join(',')}`);
}
const output = resolve(checkoutProjectRoot(import.meta.url), `src/objects/${bank}/source/dots/positions.csv.gz`);
await writeFile(output, gzipSync(`name,xKm,yKm,zKm\n${rows.join('\n')}\n`));
radii.sort((a, b) => a - b);
console.log(`Wrote ${rows.length} dots between ${innerAu} and ${outerAu} au with density as r^${exponent}: half of them beyond ${radii[radii.length >> 1]!.toFixed(0)} au, the nearest at ${radii[0]!.toFixed(0)} au, to ${output}.`);
