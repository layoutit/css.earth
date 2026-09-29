/** A heat-map lens from a paper's published phase-curve fit, added beside a planet's default lens: the paper's table transcribed as
 * `cssearth-published-phase-curve@1` and drawn by the `published-phase-curve-map` format (published-phase-curve-map.ts) without
 * refitting. The entry holds the record and the words only a person can check (who fitted what, observed when); the range, the
 * hottest longitude and the reader text come from the map itself.
 *
 *   new-object --phase-curve entries.json      a list of { id, lens, label, path, url, credit, observed, record }
 *
 * or `phaseCurves` on a planet in a spec (spec.mts), the same entries without `id`. */
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { parsePublishedPhaseCurve, publishedPhaseCurveMap } from '@cssearth/bake/objects/raster';
import { bindInputs, json, type PackageFiles } from './lens.mts';

export interface PhaseCurveEntry {
  /** Lens id, and the dataset key of its reader text. */
  readonly lens: string; readonly label: string;
  /** The record's path inside the package's source directory. */
  readonly path: string; readonly url: string;
  /** Who fitted it ("Knutson et al. (2012)") and what they fitted ("a Spitzer IRAC phase curve of 2009"). */
  readonly credit: string; readonly observed: string;
  readonly record: Readonly<Record<string, unknown>>;
}

/** The false-colour palette every published-fit map uses (plasma). */
const PLASMA = ['#0d0887', '#7e03a8', '#cc4778', '#f89540', '#f0f921'];

export function phaseCurveEntry(value: unknown, label: string): PhaseCurveEntry {
  const input = requireRecord(value, label), text = (key: string) => requireString(input[key], `${label}.${key}`);
  const known = new Set(['id', 'lens', 'label', 'path', 'url', 'credit', 'observed', 'record']), unknown = Object.keys(input).filter(key => !known.has(key));
  if (unknown.length) throw new TypeError(`${label}: unknown fields ${unknown.join(', ')}.`);
  const lens = text('lens'), path = text('path');
  if (!/^[a-z][a-z0-9-]*$/u.test(lens)) throw new TypeError(`${label}.lens ${lens}: a lens id is lowercase letters, digits and hyphens.`);
  if (!/^science\/[a-z0-9-]+\/[a-z0-9.-]+\.json$/u.test(path)) throw new TypeError(`${label}.path ${path}: a record lives at science/<paper>/<name>.json.`);
  const record = requireRecord(input.record, `${label}.record`);
  if (requireRecord(record.model, `${label}.record.model`).kind === 'starry') throw new TypeError(`${label}: a starry fit converts through the authors' deposited spectra; author it by hand.`);
  parsePublishedPhaseCurve(record);
  return { lens, label: text('label'), path, url: text('url'), credit: text('credit'), observed: text('observed'), record };
}

/** `--phase-curve entries.json`: the entries for planets already in the tree, by planet id. */
export function parsePhaseCurveEntries(value: unknown): Map<string, PhaseCurveEntry[]> {
  const out = new Map<string, PhaseCurveEntry[]>();
  requireArray(value, 'phase-curve entries').forEach((entry, i) => {
    const id = requireString(requireRecord(entry, `entry ${i}`).id, `entry ${i}.id`);
    out.set(id, [...out.get(id) ?? [], phaseCurveEntry(entry, `${id}.phaseCurves[${out.get(id)?.length ?? 0}]`)]);
  });
  return out;
}

/** Add the lens to the package in `files`, keeping its default lens. Returns the drawn range and the hottest longitude east of noon. */
export async function installPhaseCurveLens(files: PackageFiles, id: string, name: string, entry: PhaseCurveEntry) {
  const o = `src/objects/${id}`, s = `${o}/source`, read = (path: string) => JSON.parse(String(files.get(path))) as Record<string, any>;
  const record = parsePublishedPhaseCurve(entry.record), map = await publishedPhaseCurveMap(record);
  let low = Infinity, high = -Infinity, hottest = 0, blank = false;
  for (let lon = -180; lon < 180; lon++) {
    const kelvin = map.sample(lon, 0);
    if (kelvin === null) { blank = true; continue; }
    if (kelvin > high) { high = kelvin; hottest = lon; }
    low = Math.min(low, kelvin);
  }
  // The observed range rounded out to 50 K, as the hand-made maps draw theirs.
  const minimum = Math.floor(low / 50) * 50, maximum = Math.ceil(high / 50) * 50, labels = [minimum, (minimum + maximum) / 2, maximum].map(String);
  const band = record.bandMicrons ? `across ${record.bandMicrons[0]}–${record.bandMicrons[1]} µm` : `at ${record.wavelengthMicrons} µm`;
  const where = hottest === 0 ? 'at noon' : `${Math.abs(hottest)}° ${hottest > 0 ? 'east' : 'west'} of noon`;
  const method = record.model.kind === 'spiderman-spherical' ? 'Their spherical-harmonic fit is evaluated by SPIDERMAN on the equator and drawn the same at every latitude'
    : 'Their Fourier series becomes a map of longitude through the Cowan & Agol (2008) inversion, so there is no north-south detail and every latitude is drawn alike';
  files.set(`${s}/${entry.path}`, json(entry.record));

  const raster = read(`${s}/preparation/raster.json`), lit = raster.emission === undefined, consumer = `${entry.lens}-phase-curve-map`;
  const science = { kind: 'terrestrial-scientific', id: entry.lens, label: entry.label, format: 'published-phase-curve-map', path: entry.path, consumer, sampling: 'bilinear', displaySampling: 'bilinear',
    outputLongitudeOrigin: 0, units: 'K', minimum, maximum, colors: PLASMA, labels,
    description: `Brightness temperature ${band} from the paper's phase-curve fit, turned into a map of longitude. It has no north-south information.`, title: `${entry.label} · published phase-curve fit`, sourceUrl: entry.url };
  raster.surfaces = [...raster.surfaces.filter((surface: { id: string }) => surface.id !== entry.lens),
    { id: entry.lens, output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-lens-{id}.webp`, source: entry.path, falseColor: true, science }];
  files.set(`${s}/preparation/raster.json`, json(raster));
  const descriptor = read(`${o}/object.json`), lenses = descriptor.properties.recipe.surfaces[0].lenses as { id: string }[];
  descriptor.properties.recipe.surfaces[0].lenses = [...lenses.filter(lens => lens.id !== entry.lens), { id: entry.lens, source: 'content', material: lit ? 'lighting' : 'emission' }];
  files.set(`${o}/object.json`, json(descriptor));

  const content = read(`${s}/content/object.json`), palette = PLASMA.map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));
  const control = { id: entry.lens, label: entry.label, qualification: `Published fit · ${entry.credit} · ${entry.observed} · longitude only`,
    thumbnail: `${id}-lens-${entry.lens}.webp`, surface: `${id}-surface-${entry.lens}@2x.webp`, poles: `${id}-poles-${entry.lens}@2x.webp`,
    source: { id: `${id}-${entry.lens}-phase-curve`, path: '../manifest.json', url: entry.url }, falseColor: true,
    legend: { kind: 'scale', title: 'Brightness temperature', labels, recipe: { palette, labels }, meta: 'K', sourceUrl: entry.url },
    notes: `Brightness temperature ${band} of ${name} from ${entry.credit}'s published fit to ${entry.observed}. ${method}. The hottest longitude is ${where}.${blank ? ' Longitudes where the fit gives no emission are left blank.' : ''} The false colour runs from ${minimum.toLocaleString('en-US')} to ${maximum.toLocaleString('en-US')} K.${lit ? " With shadows on, the star's light darkens the night half." : ''}` };
  content.lenses.controls = [...content.lenses.controls.filter((existing: { id: string }) => existing.id !== entry.lens), control];
  files.set(`${s}/content/object.json`, json(content));
  const text = read(`${o}/text.json`);
  text.datasets = { ...text.datasets, [entry.lens]: { title: `${entry.label} heat map`, detail: 'Published fit',
    summary: `Heat ${band} from the paper's phase-curve fit. It varies only with longitude: the data hold no north-south detail.` } };
  files.set(`${o}/text.json`, json(text));
  const manifest = read(`${s}/manifest.json`);
  manifest.inputs = [...manifest.inputs.filter((input: { id: string }) => input.id !== `${id}-${entry.lens}-phase-curve`), { id: `${id}-${entry.lens}-phase-curve`, path: entry.path, origin: entry.url,
    credit: `${entry.credit}; ${entry.observed}`, license: 'Factual numerical measurements; source attribution retained',
    acquisition: 'Transcribed from the paper, table cell by table cell, with each cell\'s location', redistribution: 'Factual parameter transcription only; no paper figures', consumers: [consumer] }];
  files.set(`${s}/manifest.json`, json(manifest));
  bindInputs(files, id);
  return { minimum, maximum, hottest };
}
