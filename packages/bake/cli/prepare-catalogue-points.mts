/**
 * Prepare a published point catalogue beside an object as a bank of fixed 3D points. `source/<id>/points.json` names
 * the table, its columns, the rows the authors' own selection keeps, an optional colour column and the citation;
 * Astropy converts each kept row's Galactic longitude, latitude and distance to Sun-centred ICRS Cartesian
 * coordinates (kpc, or Mpc when `frame.unit` says so), and the bank is written to `prepared/<id>.json` and inventoried.
 * Rows without a distance are counted and left out; no value is filled.
 *
 * `appearance.colorByClass` colours each row by the class its column's value falls in (below each class's `below`, the
 * last class above all of them): the colour of that class's published template spectrum, through the CIE 1931 observer
 * into sRGB as the app colours stars (packages/bake/src/objects/stellar/stellar-photometric-color.ts). A row without a
 * value takes `missing`, a named colour.
 *
 * Usage: node packages/bake/cli/prepare-catalogue-points.mts <object-directory> <id>
 */
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { readFitsHdus, binaryTable, tableColumn, numbers } from '@cssearth/bake/objects/raster';
import { parseCieTable, linearToSrgb } from '@cssearth/bake/objects/color';
import { spectrumLinearSrgb } from '@cssearth/bake/objects/stellar';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';

const [objectDirectoryArgument, id] = process.argv.slice(2);
if (!objectDirectoryArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-catalogue-points.mts <object-directory> <id>');
const objectDirectory = resolve(objectDirectoryArgument), sourceDirectory = resolve(objectDirectory, 'source', id);
const recipePath = resolve(sourceDirectory, 'points.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as Record<string, unknown>;
const at = (key: string) => `${recipePath}: ${key}`;
if (recipe.schema !== 'cssearth-catalogue-points-source@1' || recipe.id !== id) throw new TypeError(`${at('schema')} must be cssearth-catalogue-points-source@1 for ${id}.`);
/** A column is a 1-based whitespace or comma-separated field, or a 1-based inclusive byte range of a fixed-width table. */
type Column = number | [number, number];
/** Galactic coordinates come from columns, or from a `G<l><±b>` identifier in the name column (as in G305.20+00.01).
 * A distance is a column in pc or kpc, a trigonometric parallax in mas taken as 1/parallax, or a distance modulus
 * (10^(m - M)/5 + 1 pc). `distanceByFlag` reads
 * it from the column the authors' own flag names, as a near/far kinematic distance resolved by the catalogue;
 * `distanceFirstOf` takes the first filled column, as a measured distance before the catalogue's kinematic one. */
const table = recipe.table as { path: string; bytes: number; format: 'whitespace' | 'fixed-width' | 'csv'; gzip?: boolean;
  columns: { name: Column; lDeg?: Column; bDeg?: Column; raDeg?: Column; decDeg?: Column; distance?: Column } & Record<string, Column>; galacticFromName?: boolean;
  distanceByFlag?: { flag: Column; columns: Record<string, Column> }; distanceFirstOf?: Column[];
  distanceUnit: 'pc' | 'kpc' | 'parallax-mas' | 'distance-modulus'; missingDistance?: number;
  /** Several rows per object (one per observation): keep the first row with a distance for each name. */
  onePerName?: boolean };
if ([table.columns.distance, table.distanceByFlag, table.distanceFirstOf].filter(value => value !== undefined).length !== 1) {
  throw new TypeError(`${at('table')} needs exactly one of columns.distance, distanceByFlag and distanceFirstOf.`);
}
const filters = (recipe.filters ?? []) as { column: Column; op: '==' | '!=' | '>' | '<'; value: string | number }[];
const icrsInput = (recipe.frame as { input?: unknown } | undefined)?.input === 'icrs';
if (icrsInput ? table.columns.raDeg === undefined || table.columns.decDeg === undefined
  : !table.galacticFromName && (table.columns.lDeg === undefined || table.columns.bDeg === undefined)) {
  throw new TypeError(`${at('table.columns')} needs raDeg and decDeg for ICRS input, or lDeg and bDeg (or galacticFromName) for Galactic input.`);
}
if (!filters.every(filter => ['==', '!=', '>', '<'].includes(filter.op))) throw new TypeError(`${at('filters')} ops are ==, !=, > or <.`);
/** A kinematic distance's uncertainty, by Hou & Han (2014, Sect. 2.4): a ±σv velocity uncertainty carried through a flat
 * rotation curve, σ = σv / |dv/dd|. It is null for a measured distance. Where the line of sight meets the rotation curve
 * at a tangent point, or looks toward the Galactic centre or anticentre, the velocity barely changes with distance and σ
 * grows without bound: a kinematic distance cannot place the source. */
const kinematicUncertainty = recipe.kinematicUncertainty as undefined | { kinematic: 'always' | 'never' | { column: Column; empty?: true; contains?: string };
  rotation: { r0Kpc: number; theta0KmS: number; sigmaVKmS: number }; basis: string };
if (kinematicUncertainty && (typeof kinematicUncertainty.basis !== 'string' || !kinematicUncertainty.basis || !(kinematicUncertainty.rotation?.r0Kpc > 0) ||
    !(kinematicUncertainty.rotation.theta0KmS > 0) || !(kinematicUncertainty.rotation.sigmaVKmS > 0) || table.distanceUnit !== 'kpc')) {
  throw new TypeError(`${at('kinematicUncertainty')} needs a kinematic rule, the rotation curve, a basis and kpc distances.`);
}
const frame = recipe.frame as { input: string; output: string; epochJdTt: number; unit?: 'kpc' | 'Mpc' };
type Spectrum = { path: string; bytes: number; wavelength: string; flux: string; wavelengthUnit: 'angstrom';
  /** A template that ends inside the visible range: no light is counted past its last sample, and `basis` says why that holds. */
  endsNm?: { value: number; basis: string } };
const appearance = recipe.appearance as { colorCss: string; radiusPx: number; opacity: number;
  colorBy?: { column: Column; stops: [number, string][]; steps: number };
  colorByClass?: { column: Column; classes: { label: string; below?: number; spectrum: Spectrum }[]; missing: { label: string; colorCss: string; basis: string } } };
if (!['whitespace', 'fixed-width', 'csv'].includes(table.format)) throw new TypeError(`${at('table.format')} must be whitespace, fixed-width or csv (with a header row).`);
if (!['pc', 'kpc', 'parallax-mas', 'distance-modulus'].includes(table.distanceUnit)) throw new TypeError(`${at('table.distanceUnit')} must be pc, kpc, parallax-mas or distance-modulus.`);
if (frame.unit !== undefined && frame.unit !== 'kpc' && frame.unit !== 'Mpc') throw new TypeError(`${at('frame.unit')} must be kpc or Mpc.`);
if (!['galactic', 'icrs'].includes(frame.input) || frame.output !== 'sun-icrf' || !Number.isFinite(frame.epochJdTt)) throw new TypeError(`${at('frame')} must convert galactic or icrs to sun-icrf at a finite epoch.`);
if (icrsInput && kinematicUncertainty) throw new TypeError(`${at('kinematicUncertainty')} needs Galactic input: its rotation curve reads Galactic longitude.`);
const hex = /^#[0-9a-f]{6}$/iu;
if (!hex.test(appearance.colorCss) || !(appearance.radiusPx > 0) || !(appearance.opacity > 0 && appearance.opacity <= 1)) throw new TypeError(`${at('appearance')} needs a hex colour, a positive radius and an opacity in (0, 1].`);
const colorBy = appearance.colorBy, colorByClass = appearance.colorByClass;
if (colorBy && colorByClass) throw new TypeError(`${at('appearance')} takes colorBy or colorByClass, not both.`);
if (colorByClass && (!Array.isArray(colorByClass.classes) || colorByClass.classes.length < 2 ||
    !colorByClass.classes.every((entry, index, all) => typeof entry.label === 'string' && entry.spectrum && typeof entry.spectrum.path === 'string' &&
      (index === all.length - 1 ? entry.below === undefined : Number.isFinite(entry.below) && (index === 0 || entry.below! > all[index - 1]!.below!))) ||
    !colorByClass.missing || !hex.test(colorByClass.missing.colorCss) || typeof colorByClass.missing.basis !== 'string')) {
  throw new TypeError(`${at('appearance.colorByClass')} needs two or more labelled classes with a spectrum each, increasing 'below' bounds on all but the last, and a missing colour with its basis.`);
}
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
  parts = line.rstrip('\n').split(',') if r['csv'] else line.split(); return parts[column - 1].strip() if column - 1 < len(parts) else ''
rows, kept, missing, named = 0, [], 0, set()
import math
def is_kinematic(line):
  rule = r['weight']['kinematic']
  if rule in ('always', 'never'): return rule == 'always'
  text = field(line, rule['column'])
  return (not text) if rule.get('empty') else (rule['contains'] in text)
def kinematic_sigma(line, l, b, d):
  if not is_kinematic(line): return None
  rot = r['weight']['rotation']; r0, t0 = rot['r0Kpc'], rot['theta0KmS']
  lr, br = math.radians(l), math.radians(b)
  def v(dist):
    radius = math.sqrt(r0 * r0 + (dist * math.cos(br)) ** 2 - 2 * r0 * dist * math.cos(br) * math.cos(lr))
    return t0 * (r0 / radius - 1) * math.sin(lr) * math.cos(br)
  lo, hi = max(1e-4, d - 0.005), d + 0.005
  slope = abs(v(hi) - v(lo)) / (hi - lo)
  return rot['sigmaVKmS'] / slope if slope > 0 else 1e9
with opener(r['table'], 'rt', encoding='utf8') as handle:
  for number, line in enumerate(handle):
    if not line.strip() or line.startswith('#') or (r['csv'] and number == 0): continue
    rows += 1
    def keep(f):
      value = field(line, f['column'])
      if f['op'] == '==': return value == str(f['value'])
      if f['op'] == '!=': return value != str(f['value'])
      if f['op'] == '<': return float(value or 'nan') < f['value']
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
    if not d > 0 and r['unit'] != 'distance-modulus': raise ValueError('non-positive distance %r for %s' % (d, name))
    if r['unit'] == 'parallax-mas': d = 1 / d
    if r['unit'] == 'distance-modulus': d = 10 ** (d / 5 + 1)
    if r['fromName']:
      m = re.match(r'^G(\d+\.\d+)([+-]\d+\.\d+)', name)
      if not m: raise ValueError('%s is not a G<l><+-b> identifier' % name)
      l, b = float(m.group(1)), float(m.group(2))
    elif r['icrs']: l, b = float(field(line, r['columns']['raDeg'])), float(field(line, r['columns']['decDeg']))
    else: l, b = float(field(line, r['columns']['lDeg'])), float(field(line, r['columns']['bDeg']))
    text = field(line, r['colorColumn']) if r['colorColumn'] is not None else ''
    color = float(text) if text else None
    kept.append((name, l, b, d, color, kinematic_sigma(line, l, b, d) if r['weight'] else None))
scale = u.pc if r['unit'] in ('pc', 'distance-modulus') else u.kpc
out = u.Mpc if r['outUnit'] == 'Mpc' else u.kpc
# In ICRS input, the l and b slots hold right ascension and declination.
if r['icrs']: xyz = SkyCoord(ra=[k[1] for k in kept] * u.deg, dec=[k[2] for k in kept] * u.deg, distance=[k[3] for k in kept] * scale, frame='icrs').cartesian.xyz.to(out).value.T
else: xyz = SkyCoord(l=[k[1] for k in kept] * u.deg, b=[k[2] for k in kept] * u.deg, distance=[k[3] for k in kept] * scale, frame='galactic').icrs.cartesian.xyz.to(out).value.T
json.dump({'rows': rows, 'selected': len(kept) + missing, 'missingDistance': missing, 'astropy': astropy.__version__,
  'points': [[round(float(v), 4) for v in p] for p in xyz], 'colors': [k[4] for k in kept], 'sigmas': [None if k[5] is None else round(min(k[5], 1e6), 4) for k in kept], 'maxDistanceKpc': max(k[3] for k in kept) * (.001 if r['unit'] in ('pc', 'distance-modulus') else 1)}, sys.stdout)`;
const { astroqueryToolchainSync } = await import('@cssearth/telescope/node');
const toolchain = astroqueryToolchainSync();
const run = spawnSync(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  input: JSON.stringify({ table: resolve(sourceDirectory, table.path), gzip: table.gzip === true, columns: table.columns, unit: table.distanceUnit,
    fromName: table.galacticFromName === true, byFlag: table.distanceByFlag ?? null, icrs: icrsInput, csv: table.format === 'csv', weight: kinematicUncertainty ?? null, firstOf: table.distanceFirstOf ?? null, onePerName: table.onePerName === true,
    filters, colorColumn: colorBy?.column ?? colorByClass?.column ?? null, outUnit: frame.unit ?? 'kpc', ...(table.missingDistance === undefined ? {} : { missing: table.missingDistance }) }) });
if (run.status !== 0) throw new Error(`Catalogue point conversion failed for ${table.path}: ${run.stderr.slice(-2000)}`);
const converted = JSON.parse(run.stdout) as { rows: number; selected: number; missingDistance: number; astropy: string; points: number[][]; colors: (number | null)[];
  sigmas: (number | null)[]; maxDistanceKpc: number };

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
// Class colours: each template spectrum, linearly interpolated to the observer's 1 nm grid from 380 to 780 nm, through
// the CIE 1931 2° observer into linear sRGB, brightest channel 1. A colour outside the sRGB gamut is refused.
const classColours = colorByClass ? await (async () => {
  const cie = parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3);
  return Promise.all(colorByClass.classes.map(async ({ label, spectrum }) => {
    const bytes = await readFile(resolve(sourceDirectory, spectrum.path));
    if (bytes.length !== spectrum.bytes) throw new TypeError(`${at('appearance.colorByClass')}: ${spectrum.path} has ${bytes.length} bytes, not ${spectrum.bytes}.`);
    const hdu = readFitsHdus(bytes).find(candidate => candidate.header.XTENSION === 'BINTABLE');
    if (!hdu || spectrum.wavelengthUnit !== 'angstrom') throw new TypeError(`${at('appearance.colorByClass')}: ${spectrum.path} needs a binary table in angstroms.`);
    const table = binaryTable(hdu), column = (name: string) => Array.from({ length: table.rows }, (_, row) => numbers(bytes, table, row, tableColumn(table, name))[0]!);
    const wavelengths = column(spectrum.wavelength).map(value => value / 10), flux = column(spectrum.flux);
    const last = wavelengths.at(-1)!;
    if (!(wavelengths[0]! <= 380) || (last < 780) !== (spectrum.endsNm !== undefined) || (spectrum.endsNm && Math.abs(spectrum.endsNm.value - last) > 0.5)) {
      throw new TypeError(`${at('appearance.colorByClass')}: ${spectrum.path} covers ${wavelengths[0]} to ${last} nm; a template ending before 780 nm must say so in endsNm, with its basis.`);
    }
    const power = (nm: number) => {
      if (nm > last) return 0;
      const upper = wavelengths.findIndex(value => value >= nm), lower = Math.max(0, upper - 1);
      const t = wavelengths[upper] === wavelengths[lower] ? 0 : (nm - wavelengths[lower]!) / (wavelengths[upper]! - wavelengths[lower]!);
      return flux[lower]! * (1 - t) + flux[upper]! * t;
    };
    const raw = spectrumLinearSrgb(Array.from({ length: 401 }, (_, i) => 380 + i), power, cie), peak = Math.max(...raw);
    if (raw.some(value => value < 0)) throw new TypeError(`${at('appearance.colorByClass')}: the ${label} template falls outside the sRGB gamut.`);
    return '#' + raw.map(value => Math.round(255 * linearToSrgb(value / peak)).toString(16).padStart(2, '0')).join('');
  }));
})() : null;
const classIndex = (value: number | null) => value === null || !Number.isFinite(value) ? colorByClass!.classes.length
  : Math.max(0, colorByClass!.classes.findIndex(entry => entry.below === undefined || value < entry.below));
const reachKpc = Math.ceil(converted.maxDistanceKpc);
const outputMpc = frame.unit === 'Mpc', reach = outputMpc ? Math.ceil(converted.maxDistanceKpc / 1000) : reachKpc;
const classPalette = classColours ? [...classColours, colorByClass!.missing.colorCss] : null;
const bank = { schema: 'cssearth-catalogue-points@1', id, source, meaning: recipe.meaning,
  frame: { referenceFrame: frame.output, epochJdTt: frame.epochJdTt, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: outputMpc ? 3.0856775814913673e22 : 3.0856775814913673e19, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
  appearance: { colorCss: appearance.colorCss, radiusPx: appearance.radiusPx, opacity: appearance.opacity, ...(palette ?? classPalette ? { palette: palette ?? classPalette } : {}) },
  ...(colorByClass ? { classes: [...colorByClass.classes.map(({ label, below, spectrum }, index) => ({ label, ...(below === undefined ? {} : { below }),
    spectrum: spectrum.path, ...(spectrum.endsNm ? { endsNm: spectrum.endsNm } : {}), colorCss: classColours![index],
    points: converted.colors.filter(value => classIndex(value) === index).length })),
    { label: colorByClass.missing.label, colorCss: colorByClass.missing.colorCss, basis: colorByClass.missing.basis, points: converted.colors.filter(value => classIndex(value) === colorByClass.classes.length).length }] } : {}),
  counts: { rows: converted.rows, selected: converted.selected, points: converted.points.length, missingDistance: converted.missingDistance },
  conversion: `Astropy ${converted.astropy} SkyCoord: ${icrsInput ? 'right ascension, declination' : 'Galactic longitude, latitude'} and distance to heliocentric ICRS Cartesian, ${outputMpc ? 'Mpc, rounded to 0.1 kpc' : 'kpc, rounded to 0.1 pc'}.`,
  ...(kinematicUncertainty ? { kinematicUncertainty: { basis: kinematicUncertainty.basis, rotation: kinematicUncertainty.rotation },
    kinematicSigmaKpc: converted.sigmas } : {}),
  points: colorByClass ? converted.points.map((point, index) => [...point, classIndex(converted.colors[index] ?? null)])
    : palette ? converted.points.map((point, index) => [...point, paletteIndex(converted.colors[index] ?? null)]) : converted.points };
const outputPath = resolve(objectDirectory, 'prepared', `${id}.json`);
await writeFile(outputPath, JSON.stringify(bank) + '\n');
const { inventoryPreparedAssets } = await import('@cssearth/objects/node');
await inventoryPreparedAssets({ objectId: basename(objectDirectory), objectDirectory });
console.log(`Prepared ${converted.points.length} of ${converted.selected} selected rows of ${converted.rows} (${converted.missingDistance} without a distance) into ${outputPath}.`);
