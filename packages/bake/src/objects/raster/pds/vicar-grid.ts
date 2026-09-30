/**
 * A VICAR image of one measured quantity on a global latitude/longitude grid: 32-bit reals, one band, IEEE big-endian
 * (REALFMT IEEE) or little-endian (RIEEE), no binary prefixes or end-of-file label. VICAR labels carry no map
 * projection, so the recipe states the grid's west and north edges with the evidence for them (a catalogue record, or
 * published values the placement reproduces). Values the producer uses as fill are listed with their evidence and read
 * as missing. Sampling takes the cell a point falls in; nothing is interpolated.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

/** The system label's KEY=value items, from the start of the file to LBLSIZE bytes. */
export function vicarLabel(bytes: Buffer, where: string) {
  const head = bytes.subarray(0, Math.min(bytes.length, 4096)).toString('latin1');
  const size = /^LBLSIZE=\s*(\d+)/u.exec(head);
  if (!size) throw new Error(`${where}: not a VICAR file (no LBLSIZE).`);
  const labelSize = Number(size[1]);
  const text = bytes.subarray(0, labelSize).toString('latin1');
  const items = new Map<string, string>();
  for (const match of text.matchAll(/([A-Z0-9_]+)=\s*('(?:[^']|'')*'|[^\s']+)/gu)) {
    if (!items.has(match[1]!)) items.set(match[1]!, match[2]!.replace(/^'|'$/gu, '').replace(/''/gu, "'"));
  }
  return { labelSize, items };
}

export async function loadVicarGrid(root: string, value: unknown) {
  const dataset = requireRecord(value, 'vicar-grid dataset');
  // The scientific block has no id of its own; its file names it in every error.
  const id = requireString(dataset.path, 'vicar-grid dataset path');
  const grid = requireRecord(dataset.grid, `${id}.grid`);
  const integer = (key: string) => {
    const n = requireFiniteNumber(grid[key], `${id}.grid.${key}`);
    if (!Number.isSafeInteger(n) || n <= 0) throw new TypeError(`${id}.grid.${key} must be a positive integer.`);
    return n;
  };
  const width = integer('width'), height = integer('height');
  const ppd = requireFiniteNumber(grid.pixelsPerDegree, `${id}.grid.pixelsPerDegree`);
  const west = requireFiniteNumber(grid.westEdgeLongitude, `${id}.grid.westEdgeLongitude`);
  const north = requireFiniteNumber(grid.northEdgeLatitude, `${id}.grid.northEdgeLatitude`);
  requireString(grid.georeferenceEvidence, `${id}.grid.georeferenceEvidence`);
  const fills = grid.noData === undefined ? [] : grid.noData;
  if (!Array.isArray(fills) || !fills.every(Number.isFinite)) throw new TypeError(`${id}.grid.noData must list numbers.`);
  if (fills.length) requireString(grid.noDataEvidence, `${id}.grid.noDataEvidence`);
  if (dataset.sampling !== undefined && dataset.sampling !== 'nearest') throw new TypeError(`${id}: VICAR grid cells require nearest sampling.`);
  if (Math.abs(width / ppd - 360) > 1e-9 || north - height / ppd < -90 - 1e-9 || north > 90 + 1e-9) {
    throw new TypeError(`${id}: the recipe grid must span 360 degrees of longitude inside -90..90 latitude.`);
  }
  const bytes = await readFile(resolve(root, id));
  const { labelSize, items } = vicarLabel(bytes, id);
  const item = (key: string) => items.get(key);
  const little = item('REALFMT') === 'RIEEE';
  const problems = [
    item('FORMAT') !== 'REAL' && `FORMAT ${item('FORMAT')}`,
    !['BSQ', 'BIP', 'BIL'].includes(item('ORG') ?? '') && `ORG ${item('ORG')}`,
    item('NB') !== '1' && `NB ${item('NB')}`,
    Number(item('NL')) !== height && `NL ${item('NL')}`,
    Number(item('NS')) !== width && `NS ${item('NS')}`,
    !['IEEE', 'RIEEE'].includes(item('REALFMT') ?? '') && `REALFMT ${item('REALFMT')}`,
    (item('NBB') ?? '0') !== '0' && `NBB ${item('NBB')}`,
    (item('NLB') ?? '0') !== '0' && `NLB ${item('NLB')}`,
    (item('EOL') ?? '0') !== '0' && `EOL ${item('EOL')}`,
    bytes.length !== labelSize + width * height * 4 && `file length ${bytes.length} for LBLSIZE ${labelSize} and ${width}x${height} reals`,
  ].filter(Boolean);
  if (problems.length) throw new Error(`${id}: VICAR grid differs from its recipe: ${problems.join('; ')}.`);
  const values = new Float32Array(width * height);
  let mapped = 0, lowest = Infinity, highest = -Infinity, filled = 0;
  for (let i = 0; i < values.length; i++) {
    const v = little ? bytes.readFloatLE(labelSize + i * 4) : bytes.readFloatBE(labelSize + i * 4);
    if (!Number.isFinite(v) || fills.includes(v) || fills.some(fill => Math.fround(fill) === v)) { values[i] = NaN; if (Number.isFinite(v)) filled += 1; continue; }
    values[i] = v; mapped += 1;
    if (v < lowest) lowest = v;
    if (v > highest) highest = v;
  }
  const transform = dataset.valueTransform === undefined ? null : requireRecord(dataset.valueTransform, `${id}.valueTransform`);
  const scale = transform ? requireFiniteNumber(transform.scale, `${id}.valueTransform.scale`) : 1;
  const offset = transform ? requireFiniteNumber(transform.offset, `${id}.valueTransform.offset`) : 0;
  return {
    report: { format: 'vicar-grid', width, height, byteOrder: little ? 'little-endian' : 'big-endian', mappedCells: mapped,
      fillCells: filled, missingCells: values.length - mapped, valueRange: mapped ? [lowest, highest] : null, sampling: 'cell' },
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      const x = ((Math.floor((longitude - west) * ppd) % width) + width) % width;
      const y = Math.floor((north - latitude) * ppd);
      if (y < 0 || y >= height) return null;
      const v = values[y * width + x]!;
      return Number.isFinite(v) ? v * scale + offset : null;
    },
  };
}
