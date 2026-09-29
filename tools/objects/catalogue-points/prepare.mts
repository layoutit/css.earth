/**
 * Prepare a published point catalogue beside an object as a bank of fixed 3D points. `source/<id>/points.json` names
 * the table, its columns, the rows the authors' own selection keeps, an optional colour column and the citation;
 * Astropy converts each kept row's Galactic longitude, latitude and distance to Sun-centred ICRS Cartesian
 * coordinates (kpc), and the bank is written to `prepared/<id>.json` and inventoried. Rows without a distance are
 * counted and left out; no value is filled.
 *
 * Usage: node tools/objects/catalogue-points/prepare.mts <object-directory> <id>
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const [objectDirectoryArgument, id] = process.argv.slice(2);
if (!objectDirectoryArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare.mts <object-directory> <id>');
const objectDirectory = resolve(objectDirectoryArgument), sourceDirectory = resolve(objectDirectory, 'source', id);
const recipePath = resolve(sourceDirectory, 'points.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as Record<string, unknown>;
const at = (key: string) => `${recipePath}: ${key}`;
if (recipe.schema !== 'cssearth-catalogue-points-source@1' || recipe.id !== id) throw new TypeError(`${at('schema')} must be cssearth-catalogue-points-source@1 for ${id}.`);
/** A column is a 1-based whitespace field, or a 1-based inclusive byte range of a fixed-width table. */
type Column = number | [number, number];
/** Galactic coordinates come from columns, or from a `G<l><±b>` identifier in the name column (as in G305.20+00.01).
 * A distance is a column in pc or kpc, or a trigonometric parallax in mas taken as 1/parallax. `distanceByFlag` reads
 * it from the column the authors' own flag names, as a near/far kinematic distance resolved by the catalogue;
 * `distanceFirstOf` takes the first filled column, as a measured distance before the catalogue's kinematic one. */
const table = recipe.table as { path: string; bytes: number; format: 'whitespace' | 'fixed-width'; gzip?: boolean;
  columns: { name: Column; lDeg?: Column; bDeg?: Column; distance?: Column } & Record<string, Column>; galacticFromName?: boolean;
  distanceByFlag?: { flag: Column; columns: Record<string, Column> }; distanceFirstOf?: Column[];
  distanceUnit: 'pc' | 'kpc' | 'parallax-mas'; missingDistance?: number;
  /** Several rows per object (one per observation): keep the first row with a distance for each name. */
  onePerName?: boolean };
if ([table.columns.distance, table.distanceByFlag, table.distanceFirstOf].filter(value => value !== undefined).length !== 1) {
  throw new TypeError(`${at('table')} needs exactly one of columns.distance, distanceByFlag and distanceFirstOf.`);
}
const filters = (recipe.filters ?? []) as { column: Column; op: '==' | '!=' | '>'; value: string | number }[];
if (!table.galacticFromName && (table.columns.lDeg === undefined || table.columns.bDeg === undefined)) throw new TypeError(`${at('table.columns')} needs lDeg and bDeg, or galacticFromName.`);
if (!filters.every(filter => ['==', '!=', '>'].includes(filter.op))) throw new TypeError(`${at('filters')} ops are ==, != or >.`);
/** A map weight per point, by Hou & Han (2014, Sect. 2.4): a weight for the kind of tracer, times 0.5/σ in each disc
 * axis (capped at 1) for a kinematic distance, with σ from a ±σv velocity uncertainty through a flat rotation curve. */
/** A weight column may be chosen by the same kind of flag as distanceByFlag (a near or far mass). */
type WeightColumn = Column | { flag: Column; columns: Record<string, Column> };
type WeightKind = { constant: number } | { column: WeightColumn; scale: number; missing: number } | { column: WeightColumn; log10Of: number };
const mapWeight = recipe.mapWeight as undefined | { kind: WeightKind; kinematic: 'always' | 'never' | { column: Column; empty?: true; contains?: string };
  rotation: { r0Kpc: number; theta0KmS: number; sigmaVKmS: number }; basis: string };
if (mapWeight && (typeof mapWeight.basis !== 'string' || !mapWeight.basis || !(mapWeight.rotation?.r0Kpc > 0) || !(mapWeight.rotation.theta0KmS > 0) ||
    !(mapWeight.rotation.sigmaVKmS > 0) || !['kpc', 'parallax-mas'].includes(table.distanceUnit))) throw new TypeError(`${at('mapWeight')} needs a kind, a kinematic rule, the rotation curve and a basis.`);
const frame = recipe.frame as { input: string; output: string; epochJdTt: number };
const appearance = recipe.appearance as { colorCss: string; radiusPx: number; opacity: number;
  colorBy?: { column: Column; stops: [number, string][]; steps: number } };
if (table.format !== 'whitespace' && table.format !== 'fixed-width') throw new TypeError(`${at('table.format')} must be whitespace or fixed-width.`);
if (!['pc', 'kpc', 'parallax-mas'].includes(table.distanceUnit)) throw new TypeError(`${at('table.distanceUnit')} must be pc, kpc or parallax-mas.`);
if (frame.input !== 'galactic' || frame.output !== 'sun-icrf' || !Number.isFinite(frame.epochJdTt)) throw new TypeError(`${at('frame')} must convert galactic to sun-icrf at a finite epoch.`);
const hex = /^#[0-9a-f]{6}$/iu;
if (!hex.test(appearance.colorCss) || !(appearance.radiusPx > 0) || !(appearance.opacity > 0 && appearance.opacity <= 1)) throw new TypeError(`${at('appearance')} needs a hex colour, a positive radius and an opacity in (0, 1].`);
const colorBy = appearance.colorBy;
if (colorBy && (colorBy.stops.length < 2 || !colorBy.stops.every(([value, color], index) => Number.isFinite(value) && hex.test(color) &&
    (index === 0 || value > colorBy.stops[index - 1]![0])) || !Number.isInteger(colorBy.steps) || colorBy.steps < 2 || colorBy.steps > 64)) {
  throw new TypeError(`${at('appearance.colorBy')} needs increasing numeric stops with hex colours and 2 to 64 steps.`);
}
const source = String(recipe.source);
await readFile(resolve(objectDirectory, '../../sources', `${source}.json`)).catch(() => { throw new TypeError(`${at('source')} ${source} has no record in src/sources.`); });
const tableBytes = await readFile(resolve(sourceDirectory, table.path));
if (tableBytes.length !== table.bytes) throw new TypeError(`${at('table.bytes')} expects ${table.bytes} bytes; ${table.path} has ${tableBytes.length}.`);

const python = String.raw`import gzip, json, re, sys, astropy
import astropy.units as u
from astropy.coordinates import SkyCoord
r = json.load(sys.stdin)
opener = gzip.open if r['gzip'] else open
def field(line, column):
  if isinstance(column, list): return line[column[0] - 1:column[1]].strip()
  parts = line.split(); return parts[column - 1] if column - 1 < len(parts) else ''
rows, kept, missing, named = 0, [], 0, set()
import math
def kind_weight(line):
  k = r['weight']['kind']
  if 'constant' in k: return k['constant']
  column = k['column']
  if isinstance(column, dict): column = column['columns'][field(line, column['flag'])]
  text = field(line, column)
  if 'log10Of' in k: return max(0.0, math.log10(float(text) * k['log10Of'])) if text and float(text) > 0 else 0.0
  return float(text) * k['scale'] if text else k['missing']
def is_kinematic(line):
  rule = r['weight']['kinematic']
  if rule in ('always', 'never'): return rule == 'always'
  text = field(line, rule['column'])
  return (not text) if rule.get('empty') else (rule['contains'] in text)
def map_weight(line, l, b, d):
  w = kind_weight(line)
  if not w or not is_kinematic(line): return w
  rot = r['weight']['rotation']; r0, t0 = rot['r0Kpc'], rot['theta0KmS']
  lr, br = math.radians(l), math.radians(b)
  def v(dist):
    radius = math.sqrt(r0 * r0 + (dist * math.cos(br)) ** 2 - 2 * r0 * dist * math.cos(br) * math.cos(lr))
    return t0 * (r0 / radius - 1) * math.sin(lr) * math.cos(br)
  slope = abs(v(d + 0.005) - v(max(1e-4, d - 0.005))) / (d + 0.005 - max(1e-4, d - 0.005))
  sigma = rot['sigmaVKmS'] / slope if slope > 0 else float('inf')
  sx, sy = sigma * math.cos(br) * abs(math.sin(lr)), sigma * math.cos(br) * abs(math.cos(lr))
  return w * min(1.0, 0.5 / sx if sx > 0 else 1.0) * min(1.0, 0.5 / sy if sy > 0 else 1.0)
with opener(r['table'], 'rt', encoding='utf8') as handle:
  for line in handle:
    if not line.strip() or line.startswith('#'): continue
    rows += 1
    def keep(f):
      value = field(line, f['column'])
      if f['op'] == '==': return value == str(f['value'])
      if f['op'] == '!=': return value != str(f['value'])
      return float(value or 'nan') > f['value']
    if not all(keep(f) for f in r['filters']): continue
    if r['firstOf']:
      text = next((value for value in (field(line, column) for column in r['firstOf']) if value), '')
    elif r['byFlag']:
      flag = field(line, r['byFlag']['flag'])
      if flag not in r['byFlag']['columns']: raise ValueError('flag %r names no distance column' % flag)
      text = field(line, r['byFlag']['columns'][flag])
    else: text = field(line, r['columns']['distance'])
    d = float(text) if text else float('nan')
    name = field(line, r['columns']['name'])
    if r['onePerName'] and name in named: continue
    if not d == d or ('missing' in r and d == r['missing']): missing += 1; continue
    named.add(name)
    if not d > 0: raise ValueError('non-positive distance %r for %s' % (d, name))
    if r['unit'] == 'parallax-mas': d = 1 / d
    if r['fromName']:
      m = re.match(r'^G(\d+\.\d+)([+-]\d+\.\d+)', name)
      if not m: raise ValueError('%s is not a G<l><+-b> identifier' % name)
      l, b = float(m.group(1)), float(m.group(2))
    else: l, b = float(field(line, r['columns']['lDeg'])), float(field(line, r['columns']['bDeg']))
    color = float(field(line, r['colorColumn'])) if r['colorColumn'] is not None else None
    kept.append((name, l, b, d, color, map_weight(line, l, b, d) if r['weight'] else None))
scale = u.pc if r['unit'] == 'pc' else u.kpc
xyz = SkyCoord(l=[k[1] for k in kept] * u.deg, b=[k[2] for k in kept] * u.deg, distance=[k[3] for k in kept] * scale, frame='galactic').icrs.cartesian.xyz.to(u.kpc).value.T
json.dump({'rows': rows, 'selected': len(kept) + missing, 'missingDistance': missing, 'astropy': astropy.__version__,
  'points': [[round(float(v), 4) for v in p] for p in xyz], 'colors': [k[4] for k in kept], 'weights': [None if k[5] is None else round(k[5], 5) for k in kept], 'maxDistanceKpc': max(k[3] for k in kept) * (.001 if r['unit'] == 'pc' else 1)}, sys.stdout)`;
const { astroqueryToolchainSync } = await import('@cssearth/telescope/node');
const toolchain = astroqueryToolchainSync();
const run = spawnSync(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  input: JSON.stringify({ table: resolve(sourceDirectory, table.path), gzip: table.gzip === true, columns: table.columns, unit: table.distanceUnit,
    fromName: table.galacticFromName === true, byFlag: table.distanceByFlag ?? null, weight: mapWeight ?? null, firstOf: table.distanceFirstOf ?? null, onePerName: table.onePerName === true,
    filters, colorColumn: colorBy?.column ?? null, ...(table.missingDistance === undefined ? {} : { missing: table.missingDistance }) }) });
if (run.status !== 0) throw new Error(`Catalogue point conversion failed for ${table.path}: ${run.stderr.slice(-2000)}`);
const converted = JSON.parse(run.stdout) as { rows: number; selected: number; missingDistance: number; astropy: string; points: number[][]; colors: (number | null)[];
  weights: (number | null)[]; maxDistanceKpc: number };

// A colour column maps onto the stops' piecewise-linear sRGB ramp, quantised to a small palette the bank carries.
const mix = (a: string, b: string, t: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
  .toString(16).padStart(2, '0')).join('');
const ramp = (value: number) => {
  const stops = colorBy!.stops, clamped = Math.max(stops[0]![0], Math.min(stops.at(-1)![0], value));
  const upper = stops.findIndex(([stop]) => stop >= clamped), lower = Math.max(0, upper - 1);
  const [v0, c0] = stops[lower]!, [v1, c1] = stops[upper]!;
  return mix(c0, c1, v1 === v0 ? 0 : (clamped - v0) / (v1 - v0));
};
const palette = colorBy ? Array.from({ length: colorBy.steps }, (_, step) => ramp(colorBy.stops[0]![0] + (colorBy.stops.at(-1)![0] - colorBy.stops[0]![0]) * step / (colorBy.steps - 1))) : null;
const paletteIndex = (value: number | null) => {
  if (!colorBy || value === null || !Number.isFinite(value)) throw new TypeError(`${at('appearance.colorBy')}: a kept row has no ${JSON.stringify(colorBy?.column)} value.`);
  const [low, high] = [colorBy.stops[0]![0], colorBy.stops.at(-1)![0]];
  return Math.round((Math.max(low, Math.min(high, value)) - low) / (high - low) * (colorBy.steps - 1));
};
const reachKpc = Math.ceil(converted.maxDistanceKpc);
const bank = { schema: 'cssearth-catalogue-points@1', id, source, meaning: recipe.meaning,
  frame: { referenceFrame: frame.output, epochJdTt: frame.epochJdTt, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: 3.0856775814913673e19, boundsUnits: { min: [-reachKpc, -reachKpc, -reachKpc], max: [reachKpc, reachKpc, reachKpc] } },
  appearance: { colorCss: appearance.colorCss, radiusPx: appearance.radiusPx, opacity: appearance.opacity, ...(palette ? { palette } : {}) },
  counts: { rows: converted.rows, selected: converted.selected, points: converted.points.length, missingDistance: converted.missingDistance },
  conversion: `Astropy ${converted.astropy} SkyCoord: Galactic longitude, latitude and distance to heliocentric ICRS Cartesian, kpc, rounded to 0.1 pc.`,
  ...(mapWeight ? { mapWeight: { basis: mapWeight.basis, rotation: mapWeight.rotation }, weights: converted.weights } : {}),
  points: palette ? converted.points.map((point, index) => [...point, paletteIndex(converted.colors[index] ?? null)]) : converted.points };
const outputPath = resolve(objectDirectory, 'prepared', `${id}.json`);
await writeFile(outputPath, JSON.stringify(bank) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Prepared ${converted.points.length} of ${converted.selected} selected rows of ${converted.rows} (${converted.missingDistance} without a distance) into ${outputPath}.`);
