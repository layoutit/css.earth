/**
 * A published model of nested shells as a grid of gas, for the image-layer bake's `geometry.densityGrid`.
 *
 * A morpho-kinematic paper fits long-slit spectra with simple bodies and prints their sizes: hollow ellipsoids along a
 * symmetry axis (the lobes) and tori about that axis (the waist). This reads those sizes from a transcribed record,
 * `source/shape-model.json`, and writes where the model has gas on a cube of cells: 1 inside any body's wall, 0 outside,
 * and the part of the cell that is inside where a wall's surface crosses it. The model says where gas is, not how much:
 * every wall has the same density, which is an assumption.
 *
 * A pair of lobes is one hollow ellipsoid, or, where the record gives the lobes' `outline` as read from the paper's
 * drawing (./lobe-outline.mts), two that overlap at the waist: each with its middle on the axis at `middleOverSemiMajor`
 * of the semi-major axis from the star, reaching the printed end, and `widthOverSemiMinor` times the semi-minor axis wide.
 *
 * A model's bodies end at sharp faces, and a picture laid on them comes apart there: beside a torus's flat face the gas a
 * sight line crosses steps from the torus to the lobe behind it. `soft edge` spreads the gas by a Gaussian of that many
 * arcseconds, so the step becomes a slope. It is a presentation choice; 0 keeps the faces sharp.
 *
 * The cube's first axis is the sight line; its second runs along the model's symmetry axis and its third across it, both
 * in the plane of the sky when the record's `axisFromSkyDeg` is 0. The bake's recipe turns the second axis to the
 * published position angle. Rows are "x y z gas" in arcseconds from the star, the first axis slowest.
 *
 * Usage: node packages/bake/authoring/m1-67/shell-grid.mts <object directory> <cells a side> <cell arcsec> <soft edge arcsec>
 */
import { isRecord } from '@cssearth/core';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

/** How many places along each side of a cell are asked whether they are inside a wall. */
const SAMPLES = 3;
const [directory = '', cellsText = '', cellText = '', softText = ''] = process.argv.slice(2), cells = Number(cellsText), cellArcsec = Number(cellText), softArcsec = Number(softText);
if (!directory || !Number.isInteger(cells) || cells < 3 || cells % 2 === 0 || !(cellArcsec > 0) || softText === '' || !(softArcsec >= 0)) throw new TypeError(`Usage: shell-grid.mts <object directory> <odd cells a side> <cell arcsec> <soft edge arcsec>; got ${JSON.stringify(process.argv.slice(2))}.`);
const root = checkoutProjectRoot(import.meta.url), recordPath = resolve(root, directory, 'source/shape-model.json');
const record: unknown = JSON.parse(await readFile(recordPath, 'utf8'));
const positive = (value: unknown, name: string) => { if (typeof value !== 'number' || !(value > 0)) throw new TypeError(`${recordPath}: ${name} is a positive number, not ${JSON.stringify(value)}.`); return value; };
if (!isRecord(record) || record.schema !== 'cssearth-published-shell-model@1' || !Array.isArray(record.structures) || record.structures.length === 0) throw new TypeError(`${recordPath} is not a cssearth-published-shell-model@1 record with structures.`);
if (record.axisFromSkyDeg !== 0) throw new TypeError(`${recordPath}: axisFromSkyDeg is ${JSON.stringify(record.axisFromSkyDeg)}; this writes only models whose symmetry axis lies in the plane of the sky (0).`);
const structures = record.structures.map((structure: unknown, index: number) => {
  if (!isRecord(structure) || !isRecord(structure.lobes) || !isRecord(structure.torus)) throw new TypeError(`${recordPath}: structures[${index}] has lobes and a torus.`);
  const { lobes, torus } = structure, name = `structures[${index}]`;
  const body = { aOut: positive(lobes.semiMajorOuterArcsec, `${name}.lobes.semiMajorOuterArcsec`), aInn: positive(lobes.semiMajorInnerArcsec, `${name}.lobes.semiMajorInnerArcsec`),
    bOut: positive(lobes.semiMinorOuterArcsec, `${name}.lobes.semiMinorOuterArcsec`), bInn: positive(lobes.semiMinorInnerArcsec, `${name}.lobes.semiMinorInnerArcsec`),
    rOut: positive(torus.outerRadiusArcsec, `${name}.torus.outerRadiusArcsec`), rInn: positive(torus.innerRadiusArcsec, `${name}.torus.innerRadiusArcsec`), thick: positive(torus.thicknessArcsec, `${name}.torus.thicknessArcsec`) };
  if (!(body.aInn < body.aOut && body.bInn < body.bOut && body.rInn < body.rOut)) throw new RangeError(`${recordPath}: ${name} has an inner size at or beyond its outer one.`);
  if (lobes.outline === undefined) return { ...body, middle: 0, wide: 1 };
  if (!isRecord(lobes.outline)) throw new TypeError(`${recordPath}: ${name}.lobes.outline is a record.`);
  const middle = positive(lobes.outline.middleOverSemiMajor, `${name}.lobes.outline.middleOverSemiMajor`), wide = positive(lobes.outline.widthOverSemiMinor, `${name}.lobes.outline.widthOverSemiMinor`);
  if (!(middle < 1)) throw new RangeError(`${recordPath}: ${name}.lobes.outline.middleOverSemiMajor is under 1.`);
  return { ...body, middle, wide };
});
const reach = Math.max(...structures.flatMap(body => [body.aOut, body.bOut * body.wide, body.rOut])), half = (cells - 1) / 2 * cellArcsec;
if (half + cellArcsec / 2 < reach + 2 * softArcsec) throw new RangeError(`A cube of ${cells} cells of ${cellArcsec} arcsec reaches ${(half + cellArcsec / 2).toFixed(2)} arcsec from the star; the model reaches ${reach}, and its soft edge twice ${softArcsec} beyond.`);
/** Whether a place is inside a wall: `along` the symmetry axis and `from` it, in arcseconds. */
const inWall = (along: number, from: number) => structures.some(body => {
  // A lobe of semi-axes a and b: its middle at `middle` of a from the star, on the side the place is on.
  const inLobe = (a: number, b: number) => ((Math.abs(along) - body.middle * a) / ((1 - body.middle) * a)) ** 2 + (from / (body.wide * b)) ** 2 <= 1;
  return inLobe(body.aOut, body.bOut) && !inLobe(body.aInn, body.bInn) || Math.abs(along) <= body.thick / 2 && from >= body.rInn && from <= body.rOut;
});
const offsets = Array.from({ length: SAMPLES }, (_, sample) => ((sample + 0.5) / SAMPLES - 0.5) * cellArcsec), place = (index: number) => (index - (cells - 1) / 2) * cellArcsec;
let gas = new Float32Array(cells ** 3);
for (let first = 0; first < cells; first++) for (let second = 0; second < cells; second++) for (let third = 0; third < cells; third++) {
  let inside = 0;
  for (const ds of offsets) for (const da of offsets) for (const dc of offsets) if (inWall(place(second) + da, Math.hypot(place(third) + dc, place(first) + ds))) inside++;
  gas[(first * cells + second) * cells + third] = inside / SAMPLES ** 3;
}
if (softArcsec > 0) {
  // One pass along each axis of the cube; a place beyond the cube holds no gas.
  const sigma = softArcsec / cellArcsec, radius = Math.ceil(3 * sigma), kernel = Array.from({ length: 2 * radius + 1 }, (_, tap) => Math.exp(-((tap - radius) ** 2) / (2 * sigma * sigma))), sum = kernel.reduce((total, weight) => total + weight, 0);
  for (const stride of [cells * cells, cells, 1]) {
    const spread = new Float32Array(gas.length);
    for (let at = 0; at < gas.length; at++) { const along = Math.floor(at / stride) % cells; let value = 0;
      for (let tap = -radius; tap <= radius; tap++) if (along + tap >= 0 && along + tap < cells) value += kernel[tap + radius]! * gas[at + tap * stride]!;
      spread[at] = value / sum; }
    gas = spread;
  }
}
const rows: string[] = [];
let filled = 0;
for (let first = 0; first < cells; first++) for (let second = 0; second < cells; second++) for (let third = 0; third < cells; third++) {
  const value = gas[(first * cells + second) * cells + third]!, held = value >= 0.0005;
  if (held) filled++;
  rows.push(`${place(first)} ${place(second)} ${place(third)} ${held ? (value > 0.9995 ? '1' : value.toFixed(3)) : '0'}`);
}
const output = resolve(root, directory, 'source/shell-grid.dat');
await writeFile(output, `${rows.join('\n')}\n`);
console.log(`Wrote ${rows.length} cells of ${cellArcsec} arcsec (${cells} a side, to ${half} arcsec from the star), ${filled} of them holding gas, from ${structures.length} structures reaching ${reach} arcsec, edges softened by ${softArcsec} arcsec, to ${output}.`);
