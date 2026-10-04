/**
 * Prepare a published point catalogue beside an object as a bank of fixed 3D points. `source/<id>/points.json` names
 * the table, its columns, the rows the authors' own selection keeps, an optional color column and the citation;
 * Astropy converts each kept row's Galactic longitude, latitude and distance to Sun-centred ICRS Cartesian
 * coordinates (kpc, or Mpc when `frame.unit` says so). The bank is written where the recipe says: `published: true` for a
 * bank the app fetches (`prepared/<id>.json`, inventoried), otherwise a bake input for merge-catalogue-points or
 * stack-catalogue-points in the ignored `output/catalogue-points/<object>/` (packages/bake/src/volume/node/catalogue-banks.ts).
 * Rows without a distance are counted and left out; no value is filled.
 *
 * `frame.placement: 'image-layer-disc'` places ICRS rows without a distance: each lies where its sight line crosses the
 * midplane of the inclined disc the object's image layers are baked on (`source/recipe.json`, through the image-layer
 * bake's own intersection), so a galaxy's catalogued objects sit on its photograph; `frame.discThickness` spreads them
 * along their sight lines through the disc's published thickness. Right ascension and declination may
 * also be sexagesimal columns (`raH`, `raM`, `raS`, `decSign`, `decD`, `decM`, `decS`).
 *
 * `frame.placement: 'spheroid'` draws each ICRS row's depth from a published spheroid's density along its sight line.
 * With `frame.around` (an object id and a basis) the bank is written around that object's world origin in parsecs
 * (`frame.unit: 'pc'`, to 1e-4 pc) instead of around the Sun in kpc: a cluster a few parsecs across, 8 kpc away, whose
 * stars would otherwise fall on a 0.1 pc grid. The spheroid's centre must be that origin.
 *
 * `appearance.colorByClass` colors each row by the class its column's value falls in (below each class's `below`, the
 * last class above all of them): the color of that class's published template spectrum, through the CIE 1931 observer
 * into sRGB as the app colors stars (packages/bake/src/objects/stellar/stellar-photometric-color.ts). A row without a
 * value takes `missing`, a named color.
 *
 * `appearance.toneBy` darkens each dot's color with the object's measured brightness: its absolute magnitude (the
 * column's apparent magnitude at the row's distance) sets a tone from 1 at `brightMagnitude` and brighter, linearly in
 * magnitude down to `faintTone` at `faintMagnitude`, in `steps`; a row without a magnitude takes the faintest. The bank
 * carries each palette color's tone (`paletteTone`); merge-catalogue-points.mts scales the final color by it. Only the
 * color changes, never the opacity.
 *
 * Usage: node packages/bake/cli/prepare-catalogue-points.mts <object-directory> <id>
 */
import { CATALOGUE_POINTS_SCHEMA } from '@cssearth/objects';
import { spawnSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { readFitsHdus, binaryTable, tableColumn, numbers } from '@cssearth/bake/objects/raster';
import { parseCieTable, linearToSrgb } from '@cssearth/bake/objects/color';
import { spectrumLinearSrgb } from '@cssearth/bake/objects/stellar';
import { readCie1931ColorMatching } from '@cssearth/bake/objects/sources';
import { GAIA_BP_RP_DISPLAY_DOMAIN, gaiaBpRpDisplayColor } from '@cssearth/bake/nebula';
import { type CatalogueSizeBy, checkCatalogueSizeBy, checkCatalogueToneBy, parseCatalogueSpheroid, placeGroupMembers, placeMeasuredRows, placeSpheroidRows, recipePublished, toneCataloguePalette, writeCatalogueBank } from '@cssearth/bake/volume/node';

const [objectDirectoryArgument, id] = process.argv.slice(2);
if (!objectDirectoryArgument || !id || !/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Usage: prepare-catalogue-points.mts <object-directory> <id>');
const objectDirectory = resolve(objectDirectoryArgument), sourceDirectory = resolve(objectDirectory, 'source', id);
const recipePath = resolve(sourceDirectory, 'points.json');
const recipe = JSON.parse(await readFile(recipePath, 'utf8')) as Record<string, unknown>;
const at = (key: string) => `${recipePath}: ${key}`;
if (recipe.schema !== 'cssearth-catalogue-points-source@1' || recipe.id !== id) throw new TypeError(`${at('schema')} must be cssearth-catalogue-points-source@1 for ${id}.`);
const published = recipePublished(recipe, recipePath);
/** A column is a 1-based whitespace or comma-separated field, or a 1-based inclusive byte range of a fixed-width table. */
type Column = number | [number, number];
type MeasuredColor = { column: Column; range: [number, number]; steps: number; basis: string };
/** Galactic coordinates come from columns, or from a `G<l><±b>` identifier in the name column (as in G305.20+00.01).
 * A distance is a column in pc or kpc, a trigonometric parallax in mas taken as 1/parallax, a distance modulus
 * (10^(m - M)/5 + 1 pc), or a redshift: the comoving distance in the Planck 2018 cosmology (Astropy's Planck18,
 * Planck Collaboration 2020, A&A 641, A6), and for a tone the luminosity distance in the same cosmology. `distanceByFlag` reads
 * it from the column the authors' own flag names, as a near/far kinematic distance resolved by the catalogue;
 * `distanceFirstOf` takes the first filled column, as a measured distance before the catalogue's kinematic one. */
const table = recipe.table as { path: string; bytes: number; format: 'whitespace' | 'fixed-width' | 'csv'; gzip?: boolean;
  columns: { name: Column; lDeg?: Column; bDeg?: Column; raDeg?: Column; decDeg?: Column; distance?: Column;
    raH?: Column; raM?: Column; raS?: Column; decSign?: Column; decD?: Column; decM?: Column; decS?: Column } & Record<string, Column>; galacticFromName?: boolean;
  distanceByFlag?: { flag: Column; columns: Record<string, Column> }; distanceFirstOf?: Column[];
  distanceUnit?: 'pc' | 'kpc' | 'parallax-mas' | 'distance-modulus' | 'redshift-planck18'; missingDistance?: number;
  /** Several rows per object (one per observation): keep the first row with a distance for each name. */
  onePerName?: boolean;
  /** Leave out every ICRS row within `withinArcsec` of a position listed in another table (a CSV with a header), such as
   * the foreground stars a published criterion identifies; `source` and `basis` say whose list and radius they are. */
  exclude?: { path: string; raDegColumn: string; decDegColumn: string; withinArcsec: number; source: string; basis: string };
  /** Members of one group (a column naming each row's group) at the group's own measured distance (a column in the table's
   * distance unit), spread along the line of sight as widely as the group spreads across the sky: `depth: 'isotropic'`
   * gives each member the sky-plane offset of the member half the group away in table order. A row's own distance is kept
   * where its group has one member here or no distance. `source` and `basis` say whose groups and why. */
  groupDistance?: { group: Column; distance: Column; depth: 'isotropic'; source: string; basis: string };
  /** Rows a paper measures one by one: a CSV with a header, `name` (this table's name column) and `distance` in `unit`. Such a
   * row sits at that distance on its own sight line, whatever its column, its redshift or its group says: a galaxy whose
   * Cepheids Hubble measured is where they put it, not at its group's average. `source` and `basis` say whose measurements. */
  measuredDistance?: { path: string; unit: 'distance-modulus'; source: string; basis: string } };
const discPlacement = (recipe.frame as { placement?: unknown } | undefined)?.placement === 'image-layer-disc';
// A galaxy with no disc (M87): each ICRS row at a depth drawn from a published spheroid's density along its sight line.
const spheroidPlacement = (recipe.frame as { placement?: unknown } | undefined)?.placement === 'spheroid';
const skyPlacement = discPlacement || spheroidPlacement;
if ([table.columns.distance, table.distanceByFlag, table.distanceFirstOf].filter(value => value !== undefined).length !== (skyPlacement ? 0 : 1) ||
    (skyPlacement ? table.distanceUnit !== undefined : table.distanceUnit === undefined)) {
  throw new TypeError(`${at('table')} needs exactly one of columns.distance, distanceByFlag and distanceFirstOf with a distanceUnit, or none with frame.placement image-layer-disc or spheroid.`);
}
const groupDistance = table.groupDistance;
if (groupDistance !== undefined && (discPlacement || groupDistance.depth !== 'isotropic' || groupDistance.group === undefined || groupDistance.distance === undefined
    || typeof groupDistance.source !== 'string' || !groupDistance.source || typeof groupDistance.basis !== 'string' || !groupDistance.basis)) {
  throw new TypeError(`${at('table.groupDistance')} needs a group and a distance column, depth isotropic, a source and a basis, and no disc placement; got ${JSON.stringify(groupDistance)}.`);
}
const filters = (recipe.filters ?? []) as { column: Column; op: '==' | '!=' | '>' | '<'; value: string | number }[];
const icrsInput = (recipe.frame as { input?: unknown } | undefined)?.input === 'icrs';
const sexagesimal = ['raH', 'raM', 'raS', 'decSign', 'decD', 'decM', 'decS'] as const;
if (icrsInput ? (table.columns.raDeg === undefined || table.columns.decDeg === undefined) && !sexagesimal.every(key => table.columns[key] !== undefined)
  : !table.galacticFromName && (table.columns.lDeg === undefined || table.columns.bDeg === undefined)) {
  throw new TypeError(`${at('table.columns')} needs raDeg and decDeg (or all of ${sexagesimal.join(', ')}) for ICRS input, or lDeg and bDeg (or galacticFromName) for Galactic input.`);
}
if (table.exclude !== undefined && (!icrsInput || typeof table.exclude.path !== 'string' || !table.exclude.path || typeof table.exclude.raDegColumn !== 'string'
    || typeof table.exclude.decDegColumn !== 'string' || !(table.exclude.withinArcsec > 0) || typeof table.exclude.source !== 'string' || !table.exclude.source
    || typeof table.exclude.basis !== 'string' || !table.exclude.basis)) {
  throw new TypeError(`${at('table.exclude')} needs ICRS input, a CSV path, its RA and Dec column names, a positive withinArcsec, a source and a basis; got ${JSON.stringify(table.exclude)}.`);
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
const frame = recipe.frame as { input: string; output: string; epochJdTt: number; unit?: 'pc' | 'kpc' | 'Mpc'; placement?: 'image-layer-disc' | 'spheroid';
  around?: { object: string; basis: string } };
type Spectrum = { path: string; bytes: number; wavelength: string; flux: string; wavelengthUnit: 'angstrom';
  /** A template that ends inside the visible range: no light is counted past its last sample, and `basis` says why that holds. */
  endsNm?: { value: number; basis: string } };
const appearance = recipe.appearance as { colorCss: string; radiusPx: number; opacity: number;
  colorBy?: { column: Column; stops: [number, string][]; steps: number };
  /** Each row's measured B-V through the app's own catalogue star color (@cssearth/engine catalogueColor), or its Gaia BP-RP
   * through Cardiel et al.'s (2021) RGB fit (gaiaBpRpDisplayColor, as the nebula star fields color Gaia stars; the range stays
   * inside the fit's domain), quantised to `steps` colors across `range`; a color outside the range takes its end. */
  colorByBv?: MeasuredColor; colorByBpRp?: MeasuredColor;
  colorByClass?: { column: Column; classes: { label: string; below?: number; spectrum: Spectrum }[]; missing: { label: string; colorCss: string; basis: string } };
  toneBy?: { magnitudeColumn: Column; band: string; brightMagnitude: number; faintMagnitude: number; faintTone: number; steps: number; basis: string;
    /** The column holds a flux in nanomaggies (m = 22.5 - 2.5 log10 f, the Legacy Surveys' zero point), not a magnitude. */
    nanomaggies?: true };
  /** Each dot's size from its rank by the tone's magnitude among the dots at about its distance (catalogue-tones.ts). */
  sizeBy?: CatalogueSizeBy;
  /** Each row's color from three flux columns, one per display channel, each times its scale, the brightest channel full:
   * the color an image made with those scales gives the object. */
  colorByBands?: { red: { column: Column; scale: number }; green: { column: Column; scale: number }; blue: { column: Column; scale: number };
    levels: number; basis: string };
  /** Each row colored by a template spectrum stretched to the row's redshift (a redshift-planck18 distance), rounded
   * to `step`: the color its light arrives with. */
  colorBySpectrumAtRedshift?: { spectrum: Spectrum; step: number; basis: string } };
if (!['whitespace', 'fixed-width', 'csv'].includes(table.format)) throw new TypeError(`${at('table.format')} must be whitespace, fixed-width or csv (with a header row).`);
if (!skyPlacement && !['pc', 'kpc', 'parallax-mas', 'distance-modulus', 'redshift-planck18'].includes(table.distanceUnit!)) {
  throw new TypeError(`${at('table.distanceUnit')} must be pc, kpc, parallax-mas, distance-modulus or redshift-planck18.`);
}
if (frame.unit !== undefined && frame.unit !== 'pc' && frame.unit !== 'kpc' && frame.unit !== 'Mpc') throw new TypeError(`${at('frame.unit')} must be pc, kpc or Mpc.`);
if ((frame.unit === 'pc') !== (frame.around !== undefined) || (frame.around !== undefined && (!spheroidPlacement || typeof frame.around.object !== 'string'
    || !/^[a-z0-9][a-z0-9-]*$/u.test(frame.around.object) || typeof frame.around.basis !== 'string' || !frame.around.basis))) {
  throw new TypeError(`${at('frame.around')} is { object, basis } on a spheroid placement with frame.unit pc, and pc is its only unit; got ${JSON.stringify(frame.around)} with unit ${String(frame.unit)}.`);
}
if (!['galactic', 'icrs'].includes(frame.input) || frame.output !== 'sun-icrf' || !Number.isFinite(frame.epochJdTt)) throw new TypeError(`${at('frame')} must convert galactic or icrs to sun-icrf at a finite epoch.`);
if (skyPlacement && (!icrsInput || frame.unit === 'Mpc' || kinematicUncertainty)) throw new TypeError(`${at('frame.placement')} ${String(frame.placement)} places ICRS rows in kpc, without kinematic distances.`);
if (icrsInput && kinematicUncertainty) throw new TypeError(`${at('kinematicUncertainty')} needs Galactic input: its rotation curve reads Galactic longitude.`);
const hex = /^#[0-9a-f]{6}$/iu;
if (!hex.test(appearance.colorCss) || !(appearance.radiusPx > 0) || !(appearance.opacity > 0 && appearance.opacity <= 1)) throw new TypeError(`${at('appearance')} needs a hex color, a positive radius and an opacity in (0, 1].`);
const colorBy = appearance.colorBy, colorByClass = appearance.colorByClass, colorByBv = appearance.colorByBv, toneBy = appearance.toneBy,
  colorByBands = appearance.colorByBands, colorBySpectrumAtRedshift = appearance.colorBySpectrumAtRedshift, colorByBpRp = appearance.colorByBpRp, sizeBy = appearance.sizeBy;
if ([colorBy, colorByClass, colorByBv, colorByBpRp, colorByBands, colorBySpectrumAtRedshift].filter(Boolean).length > 1) {
  throw new TypeError(`${at('appearance')} takes one of colorBy, colorByClass, colorByBv, colorByBpRp, colorByBands and colorBySpectrumAtRedshift.`);
}
const measured = colorByBv ?? colorByBpRp, measuredKey = colorByBv ? 'colorByBv' : 'colorByBpRp', [lowest, highest] = colorByBpRp ? GAIA_BP_RP_DISPLAY_DOMAIN : [-Infinity, Infinity];
if (measured && (!Array.isArray(measured.range) || !(lowest <= measured.range[0] && measured.range[0] < measured.range[1] && measured.range[1] <= highest) || !Number.isInteger(measured.steps)
    || measured.steps < 2 || measured.steps > 64 || typeof measured.basis !== 'string' || !measured.basis)) {
  throw new TypeError(`${at(`appearance.${measuredKey}`)} takes a rising [low, high] range${colorByBpRp ? ' inside the fit\'s -0.5 to 2' : ''}, 2-64 steps and a basis; got ${JSON.stringify(measured)}.`);
}
// A spheroid's rows take their tone at the spheroid's own distance: their drawn depths barely change it.
if (discPlacement && toneBy) throw new TypeError(`${at('appearance.toneBy')} needs each row's own distance; a ${String(frame.placement)} placement has none.`);
if (colorBySpectrumAtRedshift && (table.distanceUnit !== 'redshift-planck18' || !colorBySpectrumAtRedshift.spectrum || !(colorBySpectrumAtRedshift.step > 0) ||
    typeof colorBySpectrumAtRedshift.basis !== 'string')) {
  throw new TypeError(`${at('appearance.colorBySpectrumAtRedshift')} needs a redshift-planck18 distance, a spectrum, a positive step and a basis.`);
}
if (colorByBands && (!(['red', 'green', 'blue'] as const).every(channel => colorByBands[channel] && colorByBands[channel].scale > 0) ||
    !Number.isInteger(colorByBands.levels) || colorByBands.levels < 2 || colorByBands.levels > 16 || typeof colorByBands.basis !== 'string')) {
  throw new TypeError(`${at('appearance.colorByBands')} needs a flux column and a positive scale for red, green and blue, 2 to 16 levels and a basis.`);
}
if (toneBy) checkCatalogueToneBy(toneBy, at('appearance.toneBy'));
if (sizeBy) checkCatalogueSizeBy(sizeBy, toneBy, at('appearance.sizeBy'));
if (colorBy && colorByClass) throw new TypeError(`${at('appearance')} takes colorBy or colorByClass, not both.`);
if (colorByClass && (!Array.isArray(colorByClass.classes) || colorByClass.classes.length < 2 ||
    !colorByClass.classes.every((entry, index, all) => typeof entry.label === 'string' && entry.spectrum && typeof entry.spectrum.path === 'string' &&
      (index === all.length - 1 ? entry.below === undefined : Number.isFinite(entry.below) && (index === 0 || entry.below! > all[index - 1]!.below!))) ||
    !colorByClass.missing || !hex.test(colorByClass.missing.colorCss) || typeof colorByClass.missing.basis !== 'string')) {
  throw new TypeError(`${at('appearance.colorByClass')} needs two or more labelled classes with a spectrum each, increasing 'below' bounds on all but the last, and a missing color with its basis.`);
}
if (colorBy && (colorBy.stops.length < 2 || !colorBy.stops.every(([value, color], index) => Number.isFinite(value) && hex.test(color) &&
    (index === 0 || value > colorBy.stops[index - 1]![0])) || !Number.isInteger(colorBy.steps) || colorBy.steps < 2 || colorBy.steps > 64)) {
  throw new TypeError(`${at('appearance.colorBy')} needs increasing numeric stops with hex colors and 2 to 64 steps.`);
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
rows, kept, missing, named, excluded, grouped = 0, [], 0, set(), 0, []
import math, csv
# Rows within the exclusion radius of a listed position (another catalogue's sources) are left out; a grid of
# cells as wide as the radius finds the candidates.
exclusion = None
if r['exclude']:
  radius = r['exclude']['withinArcsec'] / 3600
  exclusion = {}
  with open(r['exclude']['path'], newline='', encoding='utf8') as listed:
    for row in csv.DictReader(listed):
      ra, dec = float(row[r['exclude']['raDegColumn']]), float(row[r['exclude']['decDegColumn']])
      exclusion.setdefault((math.floor(dec / radius), math.floor(ra * math.cos(math.radians(dec)) / radius)), []).append((ra, dec))
def excluded_at(ra, dec):
  cy, cx = math.floor(dec / radius), math.floor(ra * math.cos(math.radians(dec)) / radius)
  for y in (cy - 1, cy, cy + 1):
    for x in (cx - 1, cx, cx + 1):
      for lra, ldec in exclusion.get((y, x), ()):
        if math.hypot((ra - lra) * math.cos(math.radians(dec)), dec - ldec) <= radius: return True
  return False
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
    if r['disc']: text = None
    elif r['firstOf']:
      text = next((value for value in (field(line, column) for column in r['firstOf']) if value), '')
    elif r['byFlag']:
      flag = field(line, r['byFlag']['flag'])
      if flag not in r['byFlag']['columns']: raise ValueError('flag %r names no distance column' % flag)
      text = field(line, r['byFlag']['columns'][flag])
    else: text = field(line, r['columns']['distance'])
    d = None if r['disc'] else float(text) if text else float('nan')
    name = field(line, r['columns']['name'])
    if r['onePerName'] and name in named: continue
    if d is not None and (not d == d or ('missing' in r and d == r['missing'])): missing += 1; continue
    named.add(name)
    if d is not None:
      if not d > 0 and r['unit'] not in ('distance-modulus', 'redshift-planck18'): raise ValueError('non-positive distance %r for %s' % (d, name))
      if r['unit'] == 'parallax-mas': d = 1 / d
      if r['unit'] == 'distance-modulus': d = 10 ** (d / 5 + 1)
    if r['fromName']:
      m = re.match(r'^G(\d+\.\d+)([+-]\d+\.\d+)', name)
      if not m: raise ValueError('%s is not a G<l><+-b> identifier' % name)
      l, b = float(m.group(1)), float(m.group(2))
    elif r['icrs'] and 'raH' in r['columns']:
      c = r['columns']; sign = -1 if field(line, c['decSign']) == '-' else 1
      l = 15 * (float(field(line, c['raH'])) + float(field(line, c['raM'])) / 60 + float(field(line, c['raS'])) / 3600)
      b = sign * (float(field(line, c['decD'])) + float(field(line, c['decM'])) / 60 + float(field(line, c['decS'])) / 3600)
    elif r['icrs']: l, b = float(field(line, r['columns']['raDeg'])), float(field(line, r['columns']['decDeg']))
    else: l, b = float(field(line, r['columns']['lDeg'])), float(field(line, r['columns']['bDeg']))
    if exclusion is not None and excluded_at(l, b): excluded += 1; continue
    text = field(line, r['colorColumn']) if r['colorColumn'] is not None else ''
    color = float(text) if text else None
    magnitude = None
    if r['toneColumn'] is not None:
      mtext = field(line, r['toneColumn'])
      if mtext and r['nanomaggies']: magnitude = 22.5 - 2.5 * math.log10(float(mtext)) if float(mtext) > 0 else None
      elif mtext: magnitude = float(mtext)
      if magnitude is not None and r['unit'] != 'redshift-planck18':
        # A row placed without a distance of its own takes its tone at the distance of what it is placed in.
        if d is None and r['placementPc'] is None: raise ValueError('a tone needs a distance: %s has none' % name)
        parsecs = r['placementPc'] if d is None else d if r['unit'] in ('pc', 'distance-modulus') else d * 1000
        magnitude -= 5 * math.log10(parsecs / 10)
    bands = [max(0.0, float(field(line, c['column']) or 0) * c['scale']) for c in r['bands']] if r['bands'] else None
    kept.append((name, l, b, d, color, kinematic_sigma(line, l, b, d) if r['weight'] else None, magnitude, bands))
    if r['group']: grouped.append((field(line, r['group']['group']), field(line, r['group']['distance'])))
if r['unit'] == 'redshift-planck18':
  # A redshift becomes the comoving distance for the position and the luminosity distance for a tone, both in Planck18.
  from astropy.cosmology import Planck18
  import numpy as np
  zs = np.array([k[3] for k in kept])
  comoving = Planck18.comoving_distance(zs).to(u.pc).value
  luminosity = Planck18.luminosity_distance(zs).to(u.pc).value
  redshifts = [float(z) for z in zs]
  kept = [(k[0], k[1], k[2], float(dc), k[4], k[5], None if k[6] is None else k[6] - 5 * math.log10(dl / 10), k[7]) for k, dc, dl in zip(kept, comoving, luminosity)]
else: redshifts = None
scale = u.pc if r['unit'] in ('pc', 'distance-modulus', 'redshift-planck18') else u.kpc
out = u.Mpc if r['outUnit'] == 'Mpc' else u.kpc
# In ICRS input, the l and b slots hold right ascension and declination. A disc placement is made by the caller.
if r['disc']: xyz = []
elif r['icrs']: xyz = SkyCoord(ra=[k[1] for k in kept] * u.deg, dec=[k[2] for k in kept] * u.deg, distance=[k[3] for k in kept] * scale, frame='icrs').cartesian.xyz.to(out).value.T
else: xyz = SkyCoord(l=[k[1] for k in kept] * u.deg, b=[k[2] for k in kept] * u.deg, distance=[k[3] for k in kept] * scale, frame='galactic').icrs.cartesian.xyz.to(out).value.T
json.dump({'rows': rows, 'selected': len(kept) + missing, 'missingDistance': missing, 'excluded': excluded, 'astropy': astropy.__version__,
  'points': [[round(float(v), 4) for v in p] for p in xyz], 'names': [k[0] for k in kept], 'groups': grouped if r['group'] else None, 'colors': [k[4] for k in kept], 'magnitudes': [k[6] for k in kept], 'bands': [k[7] for k in kept], 'redshifts': redshifts,
  'sigmas': [None if k[5] is None else round(min(k[5], 1e6), 4) for k in kept], 'sky': [[k[1], k[2]] for k in kept] if r['disc'] else None,
  'maxDistanceKpc': 0 if r['disc'] else max(k[3] for k in kept) * (.001 if r['unit'] in ('pc', 'distance-modulus', 'redshift-planck18') else 1)}, sys.stdout)`;
const { astroqueryToolchainSync } = await import('@cssearth/telescope/node');
const toolchain = astroqueryToolchainSync();
const run = spawnSync(toolchain.python, ['-c', python], { env: { ...process.env, ...toolchain.env }, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  input: JSON.stringify({ table: resolve(sourceDirectory, table.path), gzip: table.gzip === true, columns: table.columns, unit: table.distanceUnit ?? null,
    fromName: table.galacticFromName === true, byFlag: table.distanceByFlag ?? null, icrs: icrsInput, csv: table.format === 'csv', weight: kinematicUncertainty ?? null, firstOf: table.distanceFirstOf ?? null, onePerName: table.onePerName === true,
    exclude: table.exclude ? { ...table.exclude, path: resolve(sourceDirectory, table.exclude.path) } : null, group: groupDistance ?? null,
    disc: skyPlacement, filters, colorColumn: colorBy?.column ?? colorByClass?.column ?? measured?.column ?? null, toneColumn: toneBy?.magnitudeColumn ?? null, nanomaggies: toneBy?.nanomaggies === true,
    bands: colorByBands ? [colorByBands.red, colorByBands.green, colorByBands.blue] : null, outUnit: frame.unit ?? 'kpc',
    placementPc: spheroidPlacement ? (recipe.frame as { spheroid?: { distancePc?: unknown } }).spheroid?.distancePc ?? null : null, ...(table.missingDistance === undefined ? {} : { missing: table.missingDistance }) }) });
if (run.status !== 0) throw new Error(`Catalogue point conversion failed for ${table.path}: ${run.stderr.slice(-2000)}`);
const converted = JSON.parse(run.stdout) as { rows: number; selected: number; missingDistance: number; excluded: number; astropy: string; points: number[][]; names: string[]; colors: (number | null)[];
  magnitudes: (number | null)[]; bands: (number[] | null)[]; redshifts: number[] | null;
  sigmas: (number | null)[]; sky: [number, number][] | null; maxDistanceKpc: number; groups: [string, string][] | null };
/** A disc placement may spread the rows through the disc's published thickness: each row keeps its place in the disc (the
 * midplane point under its catalogue position) and moves along the disc's normal to a height drawn from the source's vertical
 * profile: an isothermal sheet, sech²(z / z0), or an exponential, exp(-|z| / h). A scale height that grows with disc
 * radius (a flaring layer) is given as its value at the centre plus a linear rise per kpc. The draw is seeded by the bank
 * and the row's order, so a bake repeats it exactly. Only the spread is published; no row's own height is measured. */
let groupPlaced = 0;
if (groupDistance) {
  if (!['distance-modulus', 'pc', 'kpc'].includes(table.distanceUnit!)) throw new TypeError(`${at('table.groupDistance')} needs a distance-modulus, pc or kpc table.`);
  const perPc = (frame.unit === 'Mpc' ? 1e-6 : 1e-3) * (table.distanceUnit === 'kpc' ? 1000 : 1);
  const toFrame = (text: string) => table.distanceUnit === 'distance-modulus' ? 10 ** (Number(text) / 5 + 1) * perPc : Number(text) * perPc;
  // Every member of a group names the same group distance; a group without one keeps its members' own.
  const groupDistances = new Map<string, number | null>();
  for (const [group, distance] of converted.groups!) {
    const value = distance ? toFrame(distance) : null, known = groupDistances.get(group);
    if (known !== undefined && known !== value) throw new TypeError(`${at('table.groupDistance')}: group ${group}'s members name different distances.`);
    groupDistances.set(group, value);
  }
  groupPlaced = placeGroupMembers(converted.points, converted.groups!.map(([group]) => group), group => groupDistances.get(group) ?? null);
}
const measuredDistance = table.measuredDistance;
if (measuredDistance && (skyPlacement || measuredDistance.unit !== 'distance-modulus' || !measuredDistance.source || !measuredDistance.basis)) throw new TypeError(`${at('table.measuredDistance')} needs a path, unit distance-modulus, a source and a basis, and a table placed by distance.`);
if (measuredDistance) await readFile(resolve(objectDirectory, '../../sources', `${measuredDistance.source}.json`)).catch(() => { throw new TypeError(`${at('table.measuredDistance.source')} ${measuredDistance.source} has no record in src/sources.`); });
const measuredPlaced = measuredDistance ? placeMeasuredRows(converted.points, converted.names, await readFile(resolve(sourceDirectory, measuredDistance.path)), measuredDistance.path, frame.unit === 'Mpc' ? 1e-6 : 1e-3) : 0;
const discThickness = (recipe.frame as { discThickness?: unknown } | undefined)?.discThickness as undefined | {
  profile: 'sech2' | 'exponential'; scaleHeightPc: number | { atCentrePc: number; perKpcPc: number }; source: string; basis: string };
const flare = typeof discThickness?.scaleHeightPc === 'object' && discThickness.scaleHeightPc !== null ? discThickness.scaleHeightPc : null;
if (discThickness !== undefined && (!discPlacement || !['sech2', 'exponential'].includes(discThickness.profile)
    || (flare ? !(flare.atCentrePc > 0) || !(flare.perKpcPc >= 0) : !(typeof discThickness.scaleHeightPc === 'number' && discThickness.scaleHeightPc > 0))
    || typeof discThickness.source !== 'string' || !discThickness.source || typeof discThickness.basis !== 'string' || !discThickness.basis)) {
  throw new TypeError(`${at('frame.discThickness')} needs frame.placement image-layer-disc, profile sech2 or exponential, a positive scaleHeightPc (or { atCentrePc > 0, perKpcPc >= 0 }), a source and a basis; got ${JSON.stringify(discThickness)}.`);
}
/** A disc placement may also put rows in the galaxy's bulge (the image layers' `geometry.bulge` fit): a row is a bulge
 * member with the bulge's share of the fitted light at its sky position, and sits along its sight line at a depth drawn
 * from the bulge's density there. Both draws are seeded like the height, so a bake repeats them. */
const bulgePlacement = (recipe.frame as { bulge?: unknown } | undefined)?.bulge as undefined | { source: string; basis: string };
if (bulgePlacement !== undefined && (!discPlacement || typeof bulgePlacement.source !== 'string' || !bulgePlacement.source || typeof bulgePlacement.basis !== 'string' || !bulgePlacement.basis)) {
  throw new TypeError(`${at('frame.bulge')} needs frame.placement image-layer-disc, a source and a basis; got ${JSON.stringify(bulgePlacement)}.`);
}
let bulgeMembers = 0;
if (discPlacement) {
  // Each row on the image layers' disc midplane: its sight line's unit vector times the distance to the midplane, in kpc.
  const { parseImageLayerRecipe, imageLayerDisc, imageLayerDiscDistanceKpc, imageLayerBulgeModel } = await import('@cssearth/bake/image-layers');
  const layerRecipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(objectDirectory, 'source', 'recipe.json'), 'utf8')));
  const disc = imageLayerDisc(layerRecipe);
  const bulgeModel = bulgePlacement ? imageLayerBulgeModel(layerRecipe) : null;
  if (bulgeModel && bulgePlacement!.source !== bulgeModel.bulge.source) {
    throw new TypeError(`${at('frame.bulge.source')} is ${JSON.stringify(bulgePlacement!.source)}, but the image layers' bulge fit is ${JSON.stringify(bulgeModel.bulge.source)} (source/recipe.json geometry.bulge).`);
  }
  // The disc normal in Sun-centred ICRS, from its components along the target's east, north and sight-line axes.
  const normal = [0, 1, 2].map(axis => disc.diskNormal[0] * disc.east[axis]! + disc.diskNormal[1] * disc.north[axis]! + disc.diskNormal[2] * disc.target[axis]!);
  const centre = disc.target.map(value => value * disc.distanceKpc);
  const { createHash } = await import('node:crypto');
  // A uniform draw in (0, 1) from the row's seed (and a salt for draws after the first).
  const draw = (index: number, salt = '') => (Number(createHash('sha256').update(`${id}:${index}${salt}`).digest().readBigUInt64BE(0) >> 11n) + 0.5) / 2 ** 53;
  const height = (index: number, radiusKpc: number) => {
    // Through the profile's inverse cumulative distribution.
    const u = draw(index);
    const scaleKpc = (flare ? flare.atCentrePc + flare.perKpcPc * radiusKpc : discThickness!.scaleHeightPc as number) / 1000;
    return discThickness!.profile === 'sech2' ? scaleKpc * Math.atanh(2 * u - 1) : -Math.sign(2 * u - 1) * scaleKpc * Math.log(1 - Math.abs(2 * u - 1));
  };
  converted.points = converted.sky!.map(([ra, dec], index) => {
    const r = ra * Math.PI / 180, d = dec * Math.PI / 180, ray = [Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d)];
    const midplane = imageLayerDiscDistanceKpc(disc, ra, dec), radiusKpc = Math.hypot(...ray.map((value, axis) => value * midplane - centre[axis]!));
    if (bulgeModel) {
      // The sight line in the galaxy's local frame (east, north, away from the Sun), and the row's sky offset in kpc.
      const local = [disc.east, disc.north, disc.target].map(axis => ray[0]! * axis[0] + ray[1]! * axis[1] + ray[2]! * axis[2]) as [number, number, number];
      const [east, north] = [local[0] / local[2] * disc.distanceKpc, local[1] / local[2] * disc.distanceKpc];
      if (draw(index, ':bulge') < bulgeModel.share(east, north)) {
        // Depth from the density along the line, within the bulge's reach either side of where it crosses the midplane.
        const reach = bulgeModel.bulge.extentKpc.radius, samples = 400, weights: number[] = [];
        for (let k = 0; k < samples; k++) {
          const t = midplane - reach + (k + 0.5) / samples * 2 * reach;
          weights.push(bulgeModel.density([local[0] * t, local[1] * t, local[2] * t - disc.distanceKpc]));
        }
        const total = weights.reduce((a, b) => a + b, 0), target = draw(index, ':depth') * total;
        let k = 0, running = weights[0]!;
        while (running < target && k < samples - 1) running += weights[++k]!;
        const distance = midplane - reach + (k + 0.5) / samples * 2 * reach;
        bulgeMembers++;
        converted.maxDistanceKpc = Math.max(converted.maxDistanceKpc, distance);
        return ray.map(value => Math.round(value * distance * 1e4) / 1e4);
      }
    }
    // The height is taken along the disc's normal from the midplane point under the row, so seen face-on every row keeps
    // its place in the disc. Along the sight line instead, a height z would move it z tan(i) across the disc (3.5 z for
    // M31), scattering the arms. Seen from the Sun a row then sits z sin(i) from its catalogue position.
    const h = discThickness ? height(index, radiusKpc) : 0, position = ray.map((value, axis) => value * midplane + h * normal[axis]!);
    converted.maxDistanceKpc = Math.max(converted.maxDistanceKpc, Math.hypot(...position));
    return position.map(value => Math.round(value * 1e4) / 1e4);
  });
}

// A spheroid placement (`frame.spheroid`, catalogue-spheroid.ts): each row's depth drawn along its sight line; with
// `frame.around`, around that object's world origin in pc.
let aroundOriginM: number[] | null = null;
if (spheroidPlacement) {
  if (frame.around) {
    const descriptorPath = resolve(objectDirectory, '..', frame.around.object, 'object.json');
    const worldFrame = (JSON.parse(await readFile(descriptorPath, 'utf8')) as { properties?: { worldFrame?: { referenceFrame?: unknown; epochJdTt?: unknown; originM?: unknown } } }).properties?.worldFrame;
    const origin = worldFrame?.originM;
    if (worldFrame?.referenceFrame !== frame.output || worldFrame.epochJdTt !== frame.epochJdTt || !Array.isArray(origin) || origin.length !== 3 || !origin.every(Number.isFinite)) {
      throw new TypeError(`${descriptorPath}: properties.worldFrame must be a ${frame.output} frame at epoch ${frame.epochJdTt} with an originM, got ${JSON.stringify(worldFrame)}.`);
    }
    aroundOriginM = origin as number[];
  }
  const placed = placeSpheroidRows({ sky: converted.sky!, spheroid: parseCatalogueSpheroid((recipe.frame as { spheroid?: unknown }).spheroid, at('frame.spheroid')), id,
    ...(aroundOriginM ? { aroundOriginM } : {}), at: at('frame.spheroid') });
  converted.points = placed.points; converted.maxDistanceKpc = Math.max(converted.maxDistanceKpc, placed.maxDistanceKpc);
}

// A color column maps onto the stops' piecewise-linear sRGB ramp, quantised to a small palette the bank carries.
const mix = (a: string, b: string, t: number) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
  .toString(16).padStart(2, '0')).join('');
const ramp = (value: number) => {
  const stops = colorBy!.stops, clamped = Math.max(stops[0]![0], Math.min(stops.at(-1)![0], value));
  const upper = stops.findIndex(([stop]) => stop >= clamped), lower = Math.max(0, upper - 1);
  const [v0, c0] = stops[lower]!, [v1, c1] = stops[upper]!;
  return mix(c0, c1, v1 === v0 ? 0 : (clamped - v0) / (v1 - v0));
};
const { catalogueColor } = await import('@cssearth/engine');
const measuredColor = (value: number) => colorByBv ? '#' + catalogueColor(Number.NaN, value).map(channel => Math.round(channel).toString(16).padStart(2, '0')).join('') : gaiaBpRpDisplayColor(value).colorCss;
const palette = colorBy ? Array.from({ length: colorBy.steps }, (_, step) => ramp(colorBy.stops[0]![0] + (colorBy.stops.at(-1)![0] - colorBy.stops[0]![0]) * step / (colorBy.steps - 1)))
  : measured ? Array.from({ length: measured.steps }, (_, step) => measuredColor(measured.range[0] + (measured.range[1] - measured.range[0]) * step / (measured.steps - 1))) : null;
const paletteIndex = (value: number | null) => {
  if (measured) {
    if (value === null || !Number.isFinite(value)) throw new TypeError(`${at(`appearance.${measuredKey}`)}: a kept row has no ${JSON.stringify(measured.column)} value.`);
    return Math.round((Math.max(measured.range[0], Math.min(measured.range[1], value)) - measured.range[0]) / (measured.range[1] - measured.range[0]) * (measured.steps - 1));
  }
  if (!colorBy || value === null || !Number.isFinite(value)) throw new TypeError(`${at('appearance.colorBy')}: a kept row has no ${JSON.stringify(colorBy?.column)} value.`);
  const [low, high] = [colorBy.stops[0]![0], colorBy.stops.at(-1)![0]];
  return Math.round((Math.max(low, Math.min(high, value)) - low) / (high - low) * (colorBy.steps - 1));
};
// Template colors: a template spectrum, linearly interpolated to the observer's 1 nm grid from 380 to 780 nm, through
// the CIE 1931 2° observer into linear sRGB, brightest channel 1. A color outside the sRGB gamut is refused. With a
// redshift the spectrum is first stretched by 1 + z: the color its light arrives with.
const cie = colorByClass || colorBySpectrumAtRedshift ? parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3) : null;
const readSpectrum = async (spectrum: Spectrum, where: string) => {
  const bytes = await readFile(resolve(sourceDirectory, spectrum.path));
  if (bytes.length !== spectrum.bytes) throw new TypeError(`${at(where)}: ${spectrum.path} has ${bytes.length} bytes, not ${spectrum.bytes}.`);
  const hdu = readFitsHdus(bytes).find(candidate => candidate.header.XTENSION === 'BINTABLE');
  if (!hdu || spectrum.wavelengthUnit !== 'angstrom') throw new TypeError(`${at(where)}: ${spectrum.path} needs a binary table in angstroms.`);
  const table = binaryTable(hdu), column = (name: string) => Array.from({ length: table.rows }, (_, row) => numbers(bytes, table, row, tableColumn(table, name))[0]!);
  return { wavelengths: column(spectrum.wavelength).map(value => value / 10), flux: column(spectrum.flux) };
};
const templateColor = ({ wavelengths, flux }: { wavelengths: number[]; flux: number[] }, spectrum: Spectrum, label: string, where: string, redshift = 0) => {
  const stretch = 1 + redshift, first = wavelengths[0]! * stretch, last = wavelengths.at(-1)! * stretch;
  if (!(first <= 380) || (last < 780) !== (spectrum.endsNm !== undefined) || (spectrum.endsNm && Math.abs(spectrum.endsNm.value - last) > 0.5)) {
    throw new TypeError(`${at(where)}: ${spectrum.path} covers ${first} to ${last} nm${redshift ? ` at z = ${redshift}` : ''}; a template ending before 780 nm must say so in endsNm, with its basis.`);
  }
  const power = (nm: number) => {
    if (nm > last) return 0;
    const rest = nm / stretch, upper = wavelengths.findIndex(value => value >= rest), lower = Math.max(0, upper - 1);
    const t = wavelengths[upper] === wavelengths[lower] ? 0 : (rest - wavelengths[lower]!) / (wavelengths[upper]! - wavelengths[lower]!);
    return flux[lower]! * (1 - t) + flux[upper]! * t;
  };
  const raw = spectrumLinearSrgb(Array.from({ length: 401 }, (_, i) => 380 + i), power, cie!), peak = Math.max(...raw);
  if (raw.some(value => value < 0)) throw new TypeError(`${at(where)}: the ${label} template falls outside the sRGB gamut.`);
  return '#' + raw.map(value => Math.round(255 * linearToSrgb(value / peak)).toString(16).padStart(2, '0')).join('');
};
const classColors = colorByClass ? await Promise.all(colorByClass.classes.map(async ({ label, spectrum }) =>
  templateColor(await readSpectrum(spectrum, 'appearance.colorByClass'), spectrum, label, 'appearance.colorByClass'))) : null;
// Redshifted template colors, one per redshift step: each row's redshift rounded to the step.
const redshiftSpectrum = colorBySpectrumAtRedshift ? await readSpectrum(colorBySpectrumAtRedshift.spectrum, 'appearance.colorBySpectrumAtRedshift') : null;
const redshiftPalette: string[] = [], redshiftIndex = new Map<number, number>();
const redshiftColor = (index: number) => {
  const step = colorBySpectrumAtRedshift!.step, z = Math.round(converted.redshifts![index]! / step) * step, key = Number(z.toFixed(6));
  if (!redshiftIndex.has(key)) {
    redshiftIndex.set(key, redshiftPalette.length);
    redshiftPalette.push(templateColor(redshiftSpectrum!, colorBySpectrumAtRedshift!.spectrum, `z = ${key}`, 'appearance.colorBySpectrumAtRedshift', key));
  }
  return redshiftIndex.get(key)!;
};
const classIndex = (value: number | null) => value === null || !Number.isFinite(value) ? colorByClass!.classes.length
  : Math.max(0, colorByClass!.classes.findIndex(entry => entry.below === undefined || value < entry.below));
const reachKpc = Math.ceil(converted.maxDistanceKpc), outputMpc = frame.unit === 'Mpc';
const reach = aroundOriginM ? Math.ceil(Math.max(...converted.points.flat().map(Math.abs))) : outputMpc ? Math.ceil(converted.maxDistanceKpc / 1000) : reachKpc;
const classPalette = classColors ? [...classColors, colorByClass!.missing.colorCss] : null;
// Band colors: the three scaled fluxes, the brightest channel full, each channel in `levels` steps. A row with no
// positive flux in any band takes the bank's color.
const bandPalette: string[] = [], bandIndex = new Map<string, number>();
const bandColor = (index: number) => {
  const channels = converted.bands[index], peak = channels ? Math.max(...channels) : 0;
  const levels = colorByBands!.levels;
  const color = !channels || !(peak > 0) ? appearance.colorCss
    : '#' + channels.map(value => Math.round(Math.round(value / peak * (levels - 1)) / (levels - 1) * 255).toString(16).padStart(2, '0')).join('');
  if (!bandIndex.has(color)) { bandIndex.set(color, bandPalette.length); bandPalette.push(color); }
  return bandIndex.get(color)!;
};
const bandIndices = colorByBands ? converted.points.map((_, index) => bandColor(index)) : null;
// Each point's color before its tone, as an index into the base palette (one entry for a single-color bank).
const redshiftIndices = colorBySpectrumAtRedshift ? converted.points.map((_, index) => redshiftColor(index)) : null;
const basePalette = colorByBands ? bandPalette : colorBySpectrumAtRedshift ? redshiftPalette : classPalette ?? palette ?? [appearance.colorCss];
const baseIndex = (index: number) => bandIndices ? bandIndices[index]! : redshiftIndices ? redshiftIndices[index]! : colorByClass ? classIndex(converted.colors[index] ?? null) : palette ? paletteIndex(converted.colors[index] ?? null) : 0;
// With a tone, a palette entry is a (color, tone) pair, and with a size a (color, tone, size) triple (catalogue-tones.ts).
const toned = toneBy ? toneCataloguePalette({ basePalette, baseIndices: converted.points.map((_, index) => baseIndex(index)),
  magnitudes: converted.magnitudes, distances: converted.points.map(point => Math.hypot(point[0]!, point[1]!, point[2]!)), toneBy, ...(sizeBy ? { sizeBy } : {}) }) : null;
const pointIndex = toned ? toned.indices : converted.points.map((_, index) => baseIndex(index));
const tonedPalette = toned?.palette ?? [], paletteTone = toned?.paletteTone ?? [], paletteRadiusPx = toned?.paletteRadiusPx ?? [];
/** Every disc bank of catalogued objects takes each dot's look from the photograph under it, so the dots read as part of the galaxy's light:
 * a dot's tone follows the photograph's brightness there, relative to the 90th percentile over the bank's dots on the
 * photograph and never below PHOTOGRAPH_TONE_FLOOR, and its color moves PHOTOGRAPH_COLOR_MIX of the way to the
 * photograph's local color, keeping a hint of its kind's. Positions stay the catalogue's. Tones come in eight steps and
 * colors in sixteen levels a channel, so the palette stays small. The photograph is the one the layers show
 * (prepareImageLayerFace): cleaned, levelled and color-tied. Both constants are presentation choices, picked by eye
 * from M81 rendered in the app at mixes 0, 0.5 and 0.8 against flat tints, which showed as dark specks on the bright
 * bulge. Star banks colored by their measured B-V (colorByBv) keep their look: their color is a measurement. */
const PHOTOGRAPH_TONE_FLOOR = 0.15, PHOTOGRAPH_COLOR_MIX = 0.5;
if (discPlacement && (toneBy || colorBy || colorByClass || colorByBands || colorBySpectrumAtRedshift)) {
  throw new TypeError(`${at('appearance')}: a disc bank takes its tone and color from the photograph, or colorByBv for stars; got ${Object.keys(appearance).join(', ')}.`);
}
const photographLook = discPlacement && !colorByBv ? await (async () => {
  const { parseImageLayerRecipe, imageLayerView, prepareImageLayerFace } = await import('@cssearth/bake/image-layers');
  const layerRecipe = parseImageLayerRecipe(JSON.parse(await readFile(resolve(objectDirectory, 'source', 'recipe.json'), 'utf8')));
  const view = imageLayerView(layerRecipe), { rgb: data, info } = await prepareImageLayerFace({ sourceDirectory: resolve(objectDirectory, 'source'), recipe: layerRecipe });
  // The mean over a square about 1/400 of the face wide: the light around the dot, not one noisy pixel.
  const window = Math.max(2, Math.round(info.width / 800));
  const samples = converted.sky!.map(([ra, dec]) => {
    const crop = view.crop(ra, dec); if (!crop) return { light: 0, rgb: [0, 0, 0], inside: false };
    const cx = Math.round((crop[0] + 1) / 2 * info.width - 0.5), cy = Math.round((1 - crop[1]) / 2 * info.height - 0.5), rgb = [0, 0, 0]; let n = 0;
    for (let dy = -window; dy <= window; dy++) for (let dx = -window; dx <= window; dx++) { const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= info.width || y >= info.height) continue; const o = 3 * (y * info.width + x); for (let c = 0; c < 3; c++) rgb[c]! += data[o + c]!; n++; }
    const mean = rgb.map(v => n ? v / n : 0);
    return { light: 0.2126 * mean[0]! + 0.7152 * mean[1]! + 0.0722 * mean[2]!, rgb: mean, inside: cx >= 0 && cy >= 0 && cx < info.width && cy < info.height };
  });
  // The percentile counts only dots on the photograph: dots beyond it (halo clusters) have no light to share.
  const sorted = samples.filter(s => s.inside).map(s => s.light).sort((a, b) => a - b), reference = Math.max(1, sorted[Math.floor(0.9 * (sorted.length - 1))] ?? 255);
  const hexOf = (rgb: number[]) => '#' + rgb.map(v => Math.round(Math.max(0, Math.min(255, v)) / 17) * 17).map(v => v.toString(16).padStart(2, '0')).join('');
  const own = [1, 3, 5].map(i => parseInt(appearance.colorCss.slice(i, i + 2), 16));
  const entries = new Map<string, number>(), colors: string[] = [], tones: number[] = [];
  const indices = samples.map(sample => {
    const peak = Math.max(...sample.rgb, 1), local = sample.rgb.map(v => v * 255 / peak), base = own;
    const color = hexOf(base.map((v, c) => v * (1 - PHOTOGRAPH_COLOR_MIX) + local[c]! * PHOTOGRAPH_COLOR_MIX));
    const tone = Math.max(PHOTOGRAPH_TONE_FLOOR, Math.min(1, sample.light / reference)), step = Math.round(tone * 7) / 7;
    const key = `${color}:${step}`;
    if (!entries.has(key)) { entries.set(key, colors.length); colors.push(color); tones.push(Number(Math.max(PHOTOGRAPH_TONE_FLOOR, step).toFixed(4))); }
    return entries.get(key)!;
  });
  return { colors, tones, indices, reference: Number(reference.toFixed(1)) };
})() : null;
const magnitudes = converted.magnitudes.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
// A bank without levels may be whole within a camera distance of its origin other than the renderer's 10 kpc: a galaxy
// cluster's members, seen from across the Nearby Universe.
const fullDetail = (appearance as { fullDetail?: { units?: unknown; basis?: unknown } }).fullDetail;
if (fullDetail !== undefined && (typeof fullDetail.units !== 'number' || !(fullDetail.units > 0) || typeof fullDetail.basis !== 'string' || !fullDetail.basis)) {
  throw new TypeError(`${at('appearance.fullDetail')} needs positive units and a basis, got ${JSON.stringify(fullDetail)}.`);
}
const bank = { schema: CATALOGUE_POINTS_SCHEMA, id, source, meaning: recipe.meaning,
  frame: { referenceFrame: frame.output, epochJdTt: frame.epochJdTt, originM: aroundOriginM ?? [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: aroundOriginM ? 3.0856775814913673e16 : outputMpc ? 3.0856775814913673e22 : 3.0856775814913673e19, boundsUnits: { min: [-reach, -reach, -reach], max: [reach, reach, reach] } },
  appearance: photographLook ? { colorCss: appearance.colorCss, radiusPx: appearance.radiusPx, opacity: appearance.opacity, palette: photographLook.colors, paletteTone: photographLook.tones }
    : { colorCss: appearance.colorCss, radiusPx: appearance.radiusPx, opacity: appearance.opacity,
      ...(fullDetail ? { fullDetailUnits: fullDetail.units, fullDetailBasis: fullDetail.basis } : {}),
      ...(toneBy ? { palette: tonedPalette, paletteTone, ...(sizeBy ? { paletteRadiusPx, sizeBasis: sizeBy.basis } : {}) } : colorByBands ? { palette: bandPalette } : colorBySpectrumAtRedshift ? { palette: redshiftPalette } : palette ?? classPalette ? { palette: palette ?? classPalette } : {}) },
  ...(colorBySpectrumAtRedshift ? { spectrumColor: { spectrum: colorBySpectrumAtRedshift.spectrum.path, step: colorBySpectrumAtRedshift.step, basis: colorBySpectrumAtRedshift.basis,
    colors: Object.fromEntries([...redshiftIndex].map(([z, index]) => [z, redshiftPalette[index]])) } } : {}),
  ...(colorByBands ? { bandColor: { red: colorByBands.red, green: colorByBands.green, blue: colorByBands.blue, levels: colorByBands.levels, basis: colorByBands.basis } } : {}),
  ...(toneBy ? { tone: { band: toneBy.band, brightMagnitude: toneBy.brightMagnitude, faintMagnitude: toneBy.faintMagnitude, faintTone: toneBy.faintTone, basis: toneBy.basis,
    absoluteMagnitudePercentiles: Object.fromEntries([5, 25, 50, 75, 95].map(q => [q, Number(magnitudes[Math.floor(magnitudes.length * q / 100)]?.toFixed(2))])),
    withoutMagnitude: converted.magnitudes.length - magnitudes.length } } : {}),
  ...(colorByClass ? { classes: [...colorByClass.classes.map(({ label, below, spectrum }, index) => ({ label, ...(below === undefined ? {} : { below }),
    spectrum: spectrum.path, ...(spectrum.endsNm ? { endsNm: spectrum.endsNm } : {}), colorCss: classColors![index],
    points: converted.colors.filter(value => classIndex(value) === index).length })),
    { label: colorByClass.missing.label, colorCss: colorByClass.missing.colorCss, basis: colorByClass.missing.basis, points: converted.colors.filter(value => classIndex(value) === colorByClass.classes.length).length }] } : {}),
  counts: { rows: converted.rows, selected: converted.selected, points: converted.points.length, missingDistance: converted.missingDistance,
    ...(table.exclude ? { excluded: converted.excluded } : {}), ...(bulgePlacement ? { bulge: bulgeMembers } : {}) },
  ...(bulgePlacement ? { bulge: { source: bulgePlacement.source, basis: bulgePlacement.basis } } : {}),
  ...(measuredDistance ? { measuredDistance: { source: measuredDistance.source, basis: measuredDistance.basis, placed: measuredPlaced } } : {}),
  // Each point's group, which a merge that keeps groups first reads (merge-catalogue-points.mts).
  ...(groupDistance ? { groupDistance: { source: groupDistance.source, depth: groupDistance.depth, basis: groupDistance.basis, placed: groupPlaced },
    groups: converted.groups!.map(([group]) => group) } : {}),
  ...(table.exclude ? { exclusion: { path: table.exclude.path, withinArcsec: table.exclude.withinArcsec, source: table.exclude.source, basis: table.exclude.basis } } : {}),
  conversion: spheroidPlacement ? 'Right ascension and declination at a depth drawn from the spheroid\'s density along the sight line (frame.spheroid), ' + (frame.around ? `ICRS axes around ${frame.around.object}'s origin, pc, rounded to 0.0001 pc.` : 'heliocentric ICRS Cartesian, kpc, rounded to 0.1 pc.') : discPlacement ? 'Right ascension and declination onto the midplane of the image layers\' inclined disc (source/recipe.json, packages/bake/src/image-layers/disc.ts), heliocentric ICRS Cartesian, kpc, rounded to 0.1 pc.'
    : `Astropy ${converted.astropy} SkyCoord: ${icrsInput ? 'right ascension, declination' : 'Galactic longitude, latitude'} and distance to heliocentric ICRS Cartesian, ${outputMpc ? 'Mpc, rounded to 0.1 kpc' : 'kpc, rounded to 0.1 pc'}.`,
  ...(kinematicUncertainty ? { kinematicUncertainty: { basis: kinematicUncertainty.basis, rotation: kinematicUncertainty.rotation },
    kinematicSigmaKpc: converted.sigmas } : {}),
  ...(photographLook ? { photographLook: { toneFloor: PHOTOGRAPH_TONE_FLOOR, colorMix: PHOTOGRAPH_COLOR_MIX, referenceLight: photographLook.reference } } : {}),
  points: photographLook ? converted.points.map((point, index) => [...point, photographLook.indices[index]!])
    : toneBy || colorByClass || colorByBands || colorBySpectrumAtRedshift || palette ? converted.points.map((point, index) => [...point, pointIndex[index]!]) : converted.points };
const outputPath = await writeCatalogueBank({ objectDirectory, id, bank, published });
console.log(`Prepared ${converted.points.length} of ${converted.selected} selected rows of ${converted.rows} (${converted.missingDistance} without a distance${table.exclude ? `, ${converted.excluded} excluded` : ''}${bulgePlacement ? `, ${bulgeMembers} in the bulge` : ''}${groupDistance ? `, ${groupPlaced} at their group's distance` : ''}) into ${outputPath}.`);
