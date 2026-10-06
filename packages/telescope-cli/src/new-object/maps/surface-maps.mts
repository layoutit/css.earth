/** Maps of a star's surface that this repository reduces from archive data, as datasets of the star's page.
 *
 * A reduction writes a map as a table (longitude, latitude, values) and a receipt. Whatever was mapped, the page needs the
 * same records: the table under the star's `source/`, its manifest input, one surface of the raster recipe, one dataset of
 * the descriptor, one dataset control with its step, and the reader's text. This module writes them for any kind of map. A
 * kind (a magnetic field from polarised spectra, brightness from a light curve) supplies what is its own: where its table
 * goes, the column drawn and its units, the color scale, the archive and papers it is bound to, and every sentence.
 *
 * All maps of one kind on a star share one color scale, so stepping through them shows the change; a star with one map of
 * a kind has no steps. Maps of another kind on the same page are left as they are. It is pure: a route reads and writes. */
import { isRecord, requireArray, requireRecord, requireString } from '@cssearth/core';
import { DISPLAY_ORIENTATION_SCHEMA } from '@cssearth/objects';

type Json = Record<string, unknown>;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export interface SurfaceMapChoice { /** The reduction's own id of the map (a program, a star and sector). */ readonly program: string; /** The dataset's id on the page. */ readonly id: string; /** The step's label. */ readonly label: string }
export interface SurfaceMapEntry { readonly host: string; readonly maps: readonly SurfaceMapChoice[] }
/** What every kind of map says of itself: its table, and the tilt and period it was made with. */
export interface SurfaceMap { readonly choice: SurfaceMapChoice; readonly table: string; readonly targetName: string; readonly inclinationDegrees: number; readonly inclinationSource: string; readonly periodDays: number; readonly periodSource: string }
export interface MapScale { readonly minimum: number; readonly maximum: number; readonly labels: readonly string[] }
/** Every sentence of one map's records. */
export interface MapWords { readonly productId: string; readonly inputTitle: string; readonly credit: string; readonly displayCredit: string; readonly license: string; readonly licenseEvidence: readonly string[]; readonly acquisition: string; readonly redistribution: string;
  readonly description: string; readonly surfaceTitle: string; readonly qualification: string; readonly notes: string; readonly legendNote: string; readonly text: { readonly title: string; readonly detail: string; readonly summary: string } }
/** A map drawn again in the star's own color, as the dataset the page opens on: the same table, a palette that runs from the
 * color dimmed to the color itself, the limb of the star's first dataset, and no legend. */
export interface NaturalView { readonly id: string; readonly label: string; readonly minimum: number; readonly maximum: number; readonly colors: readonly string[];
  readonly description: string; readonly surfaceTitle: string; readonly qualification: string; readonly notes: string; readonly text: { readonly title: string; readonly detail: string; readonly summary: string } }
export interface MapKind<M extends SurfaceMap> {
  /** The name the kind's surfaces and inputs carry, by which a later run finds and replaces them. */ readonly consumer: string;
  /** Where its tables go under the star's `source/`, and the middle of its manifest input ids. */ readonly directory: string; readonly inputTag: string; readonly stepGroup: string;
  /** The table's column that is drawn, its units, and the names the page shows. */ readonly variable: string; readonly units: string; readonly controlLabel: string; readonly legendTitle: string;
  /** The command that builds the kind's tables, when they are kept out of git and restored from the source cache (CONTRIBUTING.md). */ readonly generator?: string;
  readonly archiveUrl: string; readonly references: readonly { readonly catalogueId: string; readonly role: string; readonly evidence: string }[];
  readonly colors: readonly string[]; readonly palette: readonly (readonly number[])[];
  scale(maps: readonly M[]): MapScale;
  words(map: M, context: { readonly star: { readonly id: string; readonly name: string }; readonly count: number; readonly epochs: string; /** The tilt in whole degrees, and whether the latitude the star never shows is outlined. */ readonly tilt: number; readonly outlined: boolean }): MapWords;
  report(maps: readonly M[], scale: MapScale): string;
  /** Whether a map's page draws the star at the map's tilt, so the latitude the star never shows may be outlined. Left out: it does. */
  outlines?(map: M): boolean;
  /** The newest map in the star's own color, when the kind's maps are how the star looks: the page then opens on it. */
  natural?(map: M, star: { readonly id: string; readonly name: string; readonly colorHex: string }): NaturalView;
}

/** True for a rotation record that draws a star's axis by convention alone, with no measured tilt. */
export const isConventionOnly = (rotation: Json) => rotation.schema === DISPLAY_ORIENTATION_SCHEMA && !/inclination/iu.test(String(rotation.source ?? ''));
/** The smallest of 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten that holds a value: the end of a color scale. */
export function scaleEnd(value: number) { if (!(value > 0)) throw new RangeError('A scale needs a positive value.'); const power = 10 ** Math.floor(Math.log10(value));
  return Number(([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(step => step * power >= value * (1 - 1e-9))! * power).toPrecision(2)); }

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
/** A spec's list of stars and their maps, under `key`: each star once, each map with the reduction's id, its dataset id and its label. */
export function parseSurfaceMaps(value: unknown, key: string, what: string): SurfaceMapEntry[] {
  const entries = requireArray(requireRecord(value, `${what} spec`)[key], key).map((item, i): SurfaceMapEntry => { const record = requireRecord(item, `${key}[${i}]`), host = requireString(record.host, `${key}[${i}].host`);
    const maps = requireArray(record.maps, `${host} maps`).map((one, k): SurfaceMapChoice => { const map = requireRecord(one, `${host} maps[${k}]`), choice = { program: requireString(map.program, `${host} maps[${k}].program`), id: requireString(map.id, `${host} maps[${k}].id`), label: requireString(map.label, `${host} maps[${k}].label`).trim() };
      if (!ID.test(choice.program) || !ID.test(choice.id) || !choice.label) throw new TypeError(`${host} maps[${k}]: program and id are lower-case ids, and the label is not empty.`); return choice; });
    if (!ID.test(host) || !maps.length) throw new TypeError(`${key}[${i}] needs a host id and at least one map.`);
    if (new Set(maps.map(map => map.id)).size !== maps.length || new Set(maps.map(map => map.program)).size !== maps.length) throw new TypeError(`${host}: a map id or a program is listed twice.`);
    return { host, maps }; });
  if (new Set(entries.map(entry => entry.host)).size !== entries.length) throw new TypeError('A host is listed twice: give a star all its maps in one entry.');
  return entries;
}

export interface MapDatasetFiles { readonly files: Map<string, string>; readonly report: string; /** The dataset the page now opens on, when the maps changed it. */ readonly opensOn?: string }
/** The records of one star's maps. `host` holds the star's records as they are; maps written by an earlier run are replaced. */
export function surfaceMapFiles<M extends SurfaceMap>(kind: MapKind<M>, entry: SurfaceMapEntry, star: { readonly id: string; readonly name: string; readonly colorHex?: string }, maps: readonly M[], host: { readonly content: Json; readonly text: Json; readonly manifest: Json; readonly raster: Json; readonly descriptor: Json }): MapDatasetFiles {
  if (maps.length !== entry.maps.length) throw new RangeError(`${star.id}: ${maps.length} reduced maps for ${entry.maps.length} entries.`);
  const at = `src/objects/${star.id}`, files = new Map<string, string>(), ids = new Set(entry.maps.map(map => map.id)), scale = kind.scale(maps), labels = [...scale.labels];
  const raster = structuredClone(host.raster), surfaces = requireArray(raster.surfaces, `${star.id} raster surfaces`).map(surface => requireRecord(surface, `${star.id} raster surface`)), first = surfaces[0];
  if (!first) throw new Error(`${star.id}: its raster recipe has no surface to take the file names from.`);
  const taken = surfaces.filter(surface => ids.has(requireString(surface.id, 'surface id')) && !(isRecord(surface.science) && surface.science.consumer === kind.consumer)).map(surface => surface.id);
  if (taken.length) throw new Error(`${star.id}: dataset ${taken.join(', ')} already exists and is not one of these maps.`);
  const manifest = structuredClone(host.manifest), inputs = requireArray(manifest.inputs, `${star.id} manifest inputs`).map(input => requireRecord(input, `${star.id} manifest input`));
  const content = structuredClone(host.content), shown = requireRecord(content.datasets, `${star.id} content datasets`), controls = requireArray(shown.controls, `${star.id} dataset controls`).map(control => requireRecord(control, `${star.id} dataset control`));
  const text = structuredClone(host.text), texts = requireRecord(text.datasets, `${star.id} text datasets`), count = maps.length, epochs = `${count} ${count === 1 ? 'epoch' : 'epochs'}`;
  const newSurfaces: Json[] = [], newInputs: Json[] = [], newControls: Json[] = [];
  for (const map of maps) { const { choice } = map, path = `${kind.directory}/${choice.program}.dat`, inputId = `${star.id}-${kind.inputTag}-${choice.id}`, tilt = Math.round(map.inclinationDegrees), outlined = tilt <= 85 && (kind.outlines?.(map) ?? true);
    const words = kind.words(map, { star, count, epochs, tilt, outlined });
    files.set(`${at}/source/${path}`, map.table);
    newInputs.push({ id: inputId, path, origin: kind.archiveUrl, productId: words.productId,
      title: words.inputTitle, sourceUrl: kind.archiveUrl,
      credit: words.credit, displayCredit: words.displayCredit,
      license: words.license, licenseEvidence: [...words.licenseEvidence],
      acquisition: words.acquisition, ...(kind.generator ? { generator: kind.generator } : {}),
      redistribution: words.redistribution, consumers: [kind.consumer],
      sourceBinding: { kind: 'catalogued', references: kind.references.map(reference => ({ ...reference })) } });
    newSurfaces.push({ id: choice.id, output: first.output, thumbnail: first.thumbnail, source: path, falseColor: true, science: { kind: 'terrestrial-scientific', id: choice.id, label: choice.label, format: 'tecplot-lonlat-map', path, variable: kind.variable,
      ...(outlined ? { outlineLatitudes: [-tilt] } : {}), consumer: kind.consumer, sampling: 'bilinear', displaySampling: 'bilinear', outputLongitudeOrigin: 0, units: kind.units, minimum: scale.minimum, maximum: scale.maximum, colors: [...kind.colors], labels,
      description: words.description,
      title: words.surfaceTitle, sourceUrl: kind.archiveUrl } });
    newControls.push({ id: choice.id, label: kind.controlLabel, qualification: words.qualification, thumbnail: `${star.id}-dataset-${choice.id}.webp`, surface: `${star.id}-surface-${choice.id}@2x.webp`, poles: `${star.id}-poles-${choice.id}@2x.webp`,
      source: { id: inputId, path: '../manifest.json', url: kind.archiveUrl }, falseColor: true, ...(count > 1 ? { step: { group: kind.stepGroup, label: choice.label } } : {}),
      legend: { kind: 'scale', title: kind.legendTitle, labels, recipe: { palette: kind.palette.map(color => [...color]), labels }, meta: kind.units, sourceUrl: kind.archiveUrl },
      notes: words.notes,
      legendNote: words.legendNote });
    texts[choice.id] = { ...words.text };
  }
  // The newest map again, in the star's color: one more surface of the same table, first in the list and the page's default.
  const newest = maps.at(-1), natural = newest && kind.natural && star.colorHex ? kind.natural(newest, { id: star.id, name: star.name, colorHex: star.colorHex }) : undefined;
  if (natural && newest) { const path = `${kind.directory}/${newest.choice.program}.dat`, inputId = `${star.id}-${kind.inputTag}-${newest.choice.id}`;
    if (ids.has(natural.id)) throw new Error(`${star.id}: a map is listed under the id ${natural.id}, which is the id of the star drawn in its own color.`);
    if (surfaces.some(surface => surface.id === natural.id && !(isRecord(surface.science) && surface.science.consumer === kind.consumer))) throw new Error(`${star.id}: dataset ${natural.id} already exists and is not one of these maps.`);
    ids.add(natural.id);
    newSurfaces.push({ id: natural.id, output: first.output, thumbnail: first.thumbnail, source: path, falseColor: false, science: { kind: 'terrestrial-scientific', id: natural.id, label: natural.label, format: 'tecplot-lonlat-map', path, variable: kind.variable,
      consumer: kind.consumer, sampling: 'bilinear', displaySampling: 'bilinear', outputLongitudeOrigin: 0, units: kind.units, minimum: natural.minimum, maximum: natural.maximum, colors: [...natural.colors], labels: [`${natural.minimum}${kind.units}`, `${natural.maximum}${kind.units}`],
      limbOf: first.id, description: natural.description, title: natural.surfaceTitle, sourceUrl: kind.archiveUrl } });
    newControls.unshift({ id: natural.id, label: natural.label, qualification: natural.qualification, thumbnail: `${star.id}-dataset-${natural.id}.webp`, surface: `${star.id}-surface-${natural.id}@2x.webp`, poles: `${star.id}-poles-${natural.id}@2x.webp`,
      source: { id: inputId, path: '../manifest.json', url: kind.archiveUrl }, falseColor: false, notes: natural.notes });
    texts[natural.id] = { ...natural.text }; }
  const ours = (record: Json) => isRecord(record.science) && record.science.consumer === kind.consumer, oursInput = (input: Json) => Array.isArray(input.consumers) && input.consumers.includes(kind.consumer);
  const dropped = new Set(surfaces.filter(ours).map(surface => requireString(surface.id, 'surface id')).filter(id => !ids.has(id)));
  // The descriptor declares each surface dataset the page prepares, the way it declares the star's first one.
  const descriptor = structuredClone(host.descriptor), declared = requireArray(requireRecord(requireRecord(descriptor.properties, `${star.id} descriptor properties`).recipe, `${star.id} descriptor recipe`).surfaces, `${star.id} descriptor surfaces`).map(surface => requireRecord(surface, `${star.id} descriptor surface`));
  const body = declared.find(surface => Array.isArray(surface.datasets) && surface.datasets.some(dataset => isRecord(dataset) && dataset.id === first.id)), listed = body && requireArray(body.datasets, `${star.id} descriptor datasets`).map(dataset => requireRecord(dataset, `${star.id} descriptor dataset`)), like = listed?.find(dataset => dataset.id === first.id);
  if (!body || !listed || !like) throw new Error(`${star.id}: its descriptor does not declare the dataset ${String(first.id)} to take a new dataset's declaration from.`);
  body.datasets = [...listed.filter(dataset => !ids.has(requireString(dataset.id, 'declared dataset id')) && !dropped.has(requireString(dataset.id, 'declared dataset id'))), ...entry.maps.map(map => ({ ...like, id: map.id })), ...(natural ? [{ ...like, id: natural.id }] : [])];
  files.set(`${at}/object.json`, json(descriptor));
  raster.surfaces = [...surfaces.filter(surface => !ours(surface)), ...newSurfaces];
  // A table this repository builds and keeps out of git is a generated intermediate of the manifest: the restorer reads it
  // from the source mirror, and the check that every declared file can be restored accepts it there (check-body-references.mts).
  const built = Array.isArray(manifest.generatedIntermediates) ? manifest.generatedIntermediates.map(one => requireRecord(one, `${star.id} generated intermediate`)) : [];
  manifest.inputs = [...inputs.filter(input => !oursInput(input)), ...(kind.generator ? [] : newInputs)];
  manifest.generatedIntermediates = [...built.filter(one => !oursInput(one)), ...(kind.generator ? newInputs : [])];
  // A kind with a natural view puts it and its maps before the star's other datasets; any other kind's maps follow them.
  const others = controls.filter(control => !ids.has(requireString(control.id, 'control id')) && !dropped.has(requireString(control.id, 'control id')));
  shown.controls = natural ? [...newControls, ...others] : [...others, ...newControls];
  const opened = shown.defaultDataset, opensOn = natural ? natural.id : typeof opened === 'string' && dropped.has(opened) ? requireString(first.id, 'surface id') : undefined;
  if (opensOn !== undefined) shown.defaultDataset = opensOn;
  for (const id of dropped) delete texts[id];
  files.set(`${at}/source/preparation/raster.json`, json(raster)); files.set(`${at}/source/manifest.json`, json(manifest)); files.set(`${at}/source/content/object.json`, json(content)); files.set(`${at}/text.json`, json(text));
  return { files, report: kind.report(maps, scale), ...(opensOn !== undefined && opensOn !== opened ? { opensOn } : {}) };
}
