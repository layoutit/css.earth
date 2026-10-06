// Entry script: node packages/bake/authoring/m76/lobe-surface.mts <bank directory>
/**
 * The Little Dumbbell's ring and two inner lobes as one closed surface, for the image-layer bake's `geometry.surface`.
 *
 * Bryce et al. (1996) find a bright ring with a lobe attached to each of its open ends, and print the ring's diameter
 * and how far the lobes reach along the bipolar axis. No file of that structure is published, so this writes one from
 * a transcribed record, `source/lobe-model.json`: a surface of revolution about the axis. Each lobe is half of an
 * ellipse turned about the axis: it reaches the published reach, and at the star, where the two lobes meet, it is as
 * wide as the published ring, so the ring is the surface's waist. The one number a lobe has left, where its middle lies
 * on the axis, is measured on the picture (./lobe-outline.mts); its half-width follows from the other three.
 *
 * The file's x axis is the bipolar axis, +x the receding lobe; its unit is an arcsecond and the star is its origin. The
 * bake parts a surface in two by the plane through the star across the file's z axis, and joins the two parts where
 * they meet. With the bipolar axis as z that plane would be the ring's, and the join would run through the brightest
 * part of the picture. So the recipe gives the file's z axis the direction across the bipolar axis that lies nearest
 * the sight line, turned a quarter about it: the plane then holds the bipolar axis and parts the surface into the half
 * toward the Sun and the half away from it, which meet at the surface's outline.
 *
 * Input: `<bank directory>/source/lobe-model.json`.
 * Output: `<bank directory>/source/lobes.stl`, a binary STL file.
 */
import { isRecord } from '@cssearth/core';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [directory = ''] = process.argv.slice(2);
if (!directory) throw new TypeError('Usage: lobe-surface.mts <bank directory>');
const root = checkoutProjectRoot(import.meta.url), recordPath = resolve(root, directory, 'source/lobe-model.json'), record: unknown = JSON.parse(await readFile(recordPath, 'utf8'));
const positive = (value: unknown, name: string) => { if (typeof value !== 'number' || !(value > 0)) throw new TypeError(`${recordPath}: ${name} is a positive number, not ${JSON.stringify(value)}.`); return value; };
const whole = (value: unknown, name: string, least: number) => { if (typeof value !== 'number' || !Number.isInteger(value) || value < least) throw new TypeError(`${recordPath}: ${name} is a whole number of at least ${least}, not ${JSON.stringify(value)}.`); return value; };
if (!isRecord(record) || record.schema !== 'cssearth-lobe-surface-model@1' || !isRecord(record.receding) || !isRecord(record.approaching) || !isRecord(record.mesh)) throw new TypeError(`${recordPath} is not a cssearth-lobe-surface-model@1 record with a receding and an approaching lobe and a mesh.`);
const ring = positive(record.ringRadiusArcsec, 'ringRadiusArcsec'), reach = positive(record.reachArcsec, 'reachArcsec'), around = whole(record.mesh.around, 'mesh.around', 8), along = whole(record.mesh.along, 'mesh.along', 4);
/** A lobe's ellipse: its middle on the axis, its half-length along it and its half-width, the last from the ring's radius at the star. */
const lobe = (value: Record<string, unknown>, name: string) => { const middle = positive(value.middleArcsec, `${name}.middleArcsec`), half = reach - middle;
  if (!(middle < half)) throw new RangeError(`${recordPath}: ${name}.middleArcsec is under half the reach (${reach / 2}); a lobe whose middle is farther out does not come back to the ring.`);
  return { middle, half, wide: ring / Math.sqrt(1 - (middle / half) ** 2) }; };
const lobes = [{ ...lobe(record.receding, 'receding'), end: 1 }, { ...lobe(record.approaching, 'approaching'), end: -1 }];
const triangles: number[] = [];
for (const { middle, half, wide, end } of lobes) {
  // Circles about the axis from the ring to the lobe's end, evenly along the ellipse; the end itself is one point.
  const from = Math.asin(-middle / half), circle = (step: number) => { const turn = from + (Math.PI / 2 - from) * step / along; return { axis: end * (middle + half * Math.sin(turn)), radius: wide * Math.cos(turn) }; };
  const corner = (step: number, part: number) => { const { axis, radius } = circle(step), angle = 2 * Math.PI * (part % around) / around; return [axis, radius * Math.cos(angle), radius * Math.sin(angle)] as const; };
  for (let step = 0; step < along; step++) for (let part = 0; part < around; part++) {
    const a = corner(step, part), b = corner(step, part + 1), c = corner(step + 1, part + 1), d = corner(step + 1, part);
    if (step + 1 < along) triangles.push(...a, ...b, ...c, ...a, ...c, ...d); else triangles.push(...a, ...b, end * reach, 0, 0);
  }
}
const count = triangles.length / 9, bytes = Buffer.alloc(84 + 50 * count);
bytes.write('cssEarth lobe surface: arcseconds from the star, +x the receding lobe', 0, 'ascii'); bytes.writeUInt32LE(count, 80);
// An STL triangle: its normal (left zero, a reader takes it from the corners), nine corner numbers, two spare bytes.
for (let index = 0; index < count; index++) for (let value = 0; value < 9; value++) bytes.writeFloatLE(triangles[9 * index + value]!, 84 + 50 * index + 12 + 4 * value);
const output = resolve(root, directory, 'source/lobes.stl');
await writeFile(output, bytes);
console.log(`Wrote ${count} triangles to ${output}: a ring of ${ring} arcsec with lobes reaching ${reach}; ${lobes.map(({ middle, wide, end }) => `the ${end > 0 ? 'receding' : 'approaching'} one's middle ${middle} arcsec out, ${wide.toFixed(1)} arcsec in half-width`).join('; ')}.`);
