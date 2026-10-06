/** A star's magnetic maps, reduced by this repository from archived spectra, as datasets of the star's page.
 *
 * `archives/espadons/reduce.mts` writes a map as a table and a receipt. This module turns a spec entry and those two into
 * the records the page needs: the table under the star's `source/science/espadons/`, its manifest input, one surface of
 * the raster recipe, one dataset of the star's descriptor, one dataset control with its step, and the reader's text. It
 * is pure: maps.mts reads and writes.
 *
 * Every sentence written here says the map is this project's reduction and not a published map, names the telescope and
 * the codes, and sets the map's mean field beside the published one of the same run where the program records one. All
 * maps of a star share one color scale, so stepping through them shows the field change; a star with one map has no steps. */
import { inclinedPoleOrientation } from '@cssearth/bake/objects/stellar';
import { isRecord, requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { DISPLAY_ORIENTATION_SCHEMA } from '@cssearth/objects';

export const MAP_GENERATOR = 'packages/telescope-cli/src/archives/espadons/reduce.mts', MAP_CONSUMER = 'espadons-zdi', MAP_DIRECTORY = 'science/espadons';
/** Where the spectra are kept, and the terms the archive states for them. */
export const SPECTRA_ARCHIVE = Object.freeze({ url: 'https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/cfht/', terms: 'https://www.cadc-ccda.hia-iha.nrc-cnrc.gc.ca/en/about.html',
  acknowledgment: 'This research used the facilities of the Canadian Astronomy Data Centre operated by the National Research Council of Canada with the support of the Canadian Space Agency.' });
/** The radial-field palette the star pages already use: blue into the star, white none, red out of it. */
const COLORS = ['#0000ff', '#00ffff', '#ffffff', '#ff8000', '#ff0000'] as const, PALETTE = [[0, 0, 255], [0, 255, 255], [255, 255, 255], [255, 128, 0], [255, 0, 0]] as const;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u, STEP_GROUP = 'radial';
type Json = Record<string, unknown>;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
/** The two records of the source catalogue (`src/sources`) a map's manifest input is bound to: the archive the spectra come
 * from, and the paper of the code that makes the map. */
const SPECTRA_RECORD = 'cadc-cfht-espadons', METHOD_RECORD = 'arxiv-1711-08636', METHOD_URL = 'https://arxiv.org/abs/1711.08636';
export function mapSourceRecords(checkedOn: string): Map<string, string> { const credit = `Based on observations obtained at the Canada-France-Hawaii Telescope (CFHT). ${SPECTRA_ARCHIVE.acknowledgment}`;
  return new Map([[`src/sources/${SPECTRA_RECORD}.json`, json({ id: SPECTRA_RECORD, kind: 'data-product', identityLevel: 'work', title: 'CFHT ESPaDOnS spectra in the Canadian Astronomy Data Centre archive', identifiers: [],
    links: [{ role: 'landing', url: SPECTRA_ARCHIVE.url, label: 'CFHT archive at the CADC' }], evidence: [{ url: SPECTRA_ARCHIVE.terms, checkedOn, locator: 'Repository Licensing and Compliance: data held in the archive are made available under CC BY 4.0. Acknowledgements: the sentence a user of the archive includes.' }],
    relations: [], statements: [{ kind: 'credit', text: credit, scope: 'citation', evidence: SPECTRA_ARCHIVE.terms }], publisher: 'Canadian Astronomy Data Centre' })],
  [`src/sources/${METHOD_RECORD}.json`, json({ id: METHOD_RECORD, kind: 'publication', identityLevel: 'work', title: 'Folsom et al. (2018): The evolution of surface magnetic fields in young solar-type stars II: The early main sequence (250-650 Myr)',
    identifiers: [{ type: 'arXiv', value: '1711.08636' }, { type: 'DOI', value: '10.1093/mnras/stx3021' }], links: [{ role: 'archive', url: METHOD_URL, label: 'arXiv preprint' }, { role: 'landing', url: 'https://doi.org/10.1093/mnras/stx3021', label: 'Journal version' }],
    evidence: [{ url: METHOD_URL, checkedOn, locator: 'arXiv listing: title, authors, DOI. The paper describes ZDIpy, the code that fits the map.' }], relations: [], statements: [{ kind: 'credit', text: 'Folsom et al. (2018)', scope: 'citation', evidence: METHOD_URL }],
    creators: ['C. P. Folsom', 'J. Bouvier', 'et al.'], publicationDate: '2018' })]]); }

export interface MagneticMapChoice { /** The reduced program (archives/espadons/programs). */ readonly program: string; /** The dataset's id on the page. */ readonly id: string; /** The step's label: the run's month and year. */ readonly label: string }
export interface MagneticMapEntry { readonly host: string; readonly maps: readonly MagneticMapChoice[] }
export function parseMagneticMaps(value: unknown): MagneticMapEntry[] {
  const entries = requireArray(requireRecord(value, 'magnetic map spec').magneticMaps, 'magneticMaps').map((item, i): MagneticMapEntry => { const record = requireRecord(item, `magneticMaps[${i}]`), host = requireString(record.host, `magneticMaps[${i}].host`);
    const maps = requireArray(record.maps, `${host} maps`).map((one, k): MagneticMapChoice => { const map = requireRecord(one, `${host} maps[${k}]`), choice = { program: requireString(map.program, `${host} maps[${k}].program`), id: requireString(map.id, `${host} maps[${k}].id`), label: requireString(map.label, `${host} maps[${k}].label`).trim() };
      if (!ID.test(choice.program) || !ID.test(choice.id) || !choice.label) throw new TypeError(`${host} maps[${k}]: program and id are lower-case ids, and the label is not empty.`); return choice; });
    if (!ID.test(host) || !maps.length) throw new TypeError(`magneticMaps[${i}] needs a host id and at least one map.`);
    if (new Set(maps.map(map => map.id)).size !== maps.length || new Set(maps.map(map => map.program)).size !== maps.length) throw new TypeError(`${host}: a map id or a program is listed twice.`);
    return { host, maps }; });
  if (new Set(entries.map(entry => entry.host)).size !== entries.length) throw new TypeError('A host is listed twice: give a star all its maps in one entry.');
  return entries;
}

/** What a map's receipt says of it, read once and checked. */
export interface ReducedMap { readonly choice: MagneticMapChoice; readonly table: string; readonly targetName: string; readonly spectra: number; readonly fromUtc: string; readonly toUtc: string; readonly proposals: readonly string[];
  readonly inclinationDegrees: number; /** Where the tilt and the period the map is fitted with are printed. */ readonly inclinationSource: string; readonly periodDays: number; readonly periodSource: string; readonly meanGauss: number; readonly radialGauss: readonly [number, number]; readonly chiSquare: number; readonly chiSquareNoField: number; readonly codes: readonly string[];
  /** The paper that maps the same run, and its mean field where the program records one. */ readonly published?: { readonly paper: string; readonly meanGauss?: number } }
export function reducedMap(choice: MagneticMapChoice, receipt: unknown, program: unknown, table: string): ReducedMap {
  const record = requireRecord(receipt, `${choice.program} receipt`), map = requireRecord(record.map, `${choice.program}: the receipt holds no map`), chosen = requireRecord(map.chosen, `${choice.program}: no step of the ladder was chosen`);
  const spectra = requireArray(requireRecord(record.profiles, 'receipt profiles').spectra, 'receipt spectra').map(one => requireRecord(one, 'receipt spectrum')).filter(one => one.used === true), radial = requireArray(chosen.radialGauss, 'radialGauss').map(value => requireFiniteNumber(value, 'radialGauss'));
  const programRecord = requireRecord(program, `${choice.program} program`), proposals = [...new Set(requireArray(programRecord.observations, 'observations').map(one => requireString(requireRecord(one, 'observation').proposal, 'proposal').toUpperCase()))].sort();
  const requirements = requireArray(requireRecord(requireRecord(record.inputs, 'receipt inputs').toolchain, 'receipt toolchain').requirements, 'toolchain requirements').map(value => requireString(value, 'requirement'));
  const version = (name: string) => requirements.find(requirement => requirement.startsWith(`${name}==`))?.replace('==', ' ') ?? name, korg = requireString(requireRecord(record.mask, 'receipt mask').korg, 'Korg version');
  const cited = (key: string) => requireRecord(requireRecord(map.star, 'map star')[key], `map star ${key}`);
  const published = isRecord(programRecord.published) ? { paper: requireString(programRecord.published.paper, 'published.paper'), ...(isRecord(programRecord.published.meanGauss) ? { meanGauss: requireFiniteNumber(programRecord.published.meanGauss.value, 'published.meanGauss') } : {}) } : undefined;
  if (spectra.length !== map.spectraUsed || radial.length !== 2 || !table.includes('ZONE I=')) throw new TypeError(`${choice.program}: the receipt and the table do not describe one map.`);
  return { choice, table, targetName: requireString(requireRecord(record.target, 'receipt target').name, 'target name'), spectra: spectra.length, fromUtc: requireString(spectra[0]!.utc, 'utc'), toUtc: requireString(spectra.at(-1)!.utc, 'utc'), proposals,
    inclinationDegrees: requireFiniteNumber(cited('inclinationDegrees').value, 'inclination'), inclinationSource: requireString(cited('inclinationDegrees').source, 'inclination source'), periodDays: requireFiniteNumber(cited('periodDays').value, 'period'), periodSource: requireString(cited('periodDays').source, 'period source'), meanGauss: requireFiniteNumber(chosen.meanGauss, 'meanGauss'), radialGauss: [radial[0]!, radial[1]!],
    chiSquare: requireFiniteNumber(chosen.chiSquare, 'chiSquare'), chiSquareNoField: requireFiniteNumber(chosen.chiSquareNoField, 'chiSquareNoField'), codes: [`Korg ${korg}`, version('LSDpy'), version('specpolFlow'), 'ZDIpy'], ...(published ? { published } : {}) };
}

/** True for a rotation record that draws a star's axis by convention alone, with no measured tilt. */
export const isConventionOnly = (rotation: Json) => rotation.schema === DISPLAY_ORIENTATION_SCHEMA && !/inclination/iu.test(String(rotation.source ?? ''));
/** A star's rotation record with the tilt its maps are fitted with: the pole tilted toward us, north on the sky by
 * convention, and the meridian that turns longitude 0 toward Earth (as the generator writes for a spec's `spin`). */
export function tiltedRotation(previous: Json, place: { readonly rightAscensionDegrees: number; readonly declinationDegrees: number }, map: Pick<ReducedMap, 'inclinationDegrees' | 'inclinationSource' | 'periodDays' | 'periodSource'>): Json {
  const pole = inclinedPoleOrientation(place, map.inclinationDegrees, 0), meridian = Number(((pole.displayMeridianDegrees % 360 + 360) % 360).toFixed(6));
  return { ...previous, schema: DISPLAY_ORIENTATION_SCHEMA, rightAscensionDegrees: pole.rightAscensionDegrees, declinationDegrees: pole.declinationDegrees, displayMeridianDegrees: meridian, phase: 'arbitrary-display-phase',
    source: `Spin inclination ${map.inclinationDegrees} degrees from the line of sight (${map.inclinationSource}) and rotation period ${map.periodDays} d at the equator (${map.periodSource}): the values the star's magnetic maps are fitted with, with the north pole tilted toward us. The direction of the axis on the sky is not measured; it is placed toward celestial north as a convention. Longitude 0 faces the Sun as a display convention.`,
    coordinateSystem: 'ICRF/J2000. +Z is the spin axis above; +X is the display meridian; east longitude. No spin is propagated.', qualification: 'The tilt of the spin axis is measured; its position angle on the sky and the rotation phase are display conventions.' }; }

/** The smallest of 1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8 times a power of ten that holds a value: the end of a color scale. */
export function scaleEnd(value: number) { if (!(value > 0)) throw new RangeError('A scale needs a positive value.'); const power = 10 ** Math.floor(Math.log10(value));
  return Number(([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find(step => step * power >= value * (1 - 1e-9))! * power).toPrecision(2)); }
const gauss = (value: number) => value >= 100 ? value.toFixed(0) : value >= 10 ? value.toFixed(0) : value.toFixed(1);
const day = (utc: string) => { const date = new Date(`${utc}Z`); return `${date.getUTCDate()} ${date.toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' })} ${date.getUTCFullYear()}`; };

export interface MapDatasetFiles { readonly files: Map<string, string>; readonly report: string }
/** The records of one star's maps. `host` holds the star's records as they are; maps written by an earlier run are replaced. */
export function magneticMapFiles(entry: MagneticMapEntry, star: { readonly id: string; readonly name: string }, maps: readonly ReducedMap[], host: { readonly content: Json; readonly text: Json; readonly manifest: Json; readonly raster: Json; readonly descriptor: Json }): MapDatasetFiles {
  if (maps.length !== entry.maps.length) throw new RangeError(`${star.id}: ${maps.length} reduced maps for ${entry.maps.length} entries.`);
  const at = `src/objects/${star.id}`, files = new Map<string, string>(), ids = new Set(entry.maps.map(map => map.id)), scale = scaleEnd(Math.max(...maps.flatMap(map => map.radialGauss.map(Math.abs)))), labels = [`-${scale}`, '0', `+${scale}`];
  const raster = structuredClone(host.raster), surfaces = requireArray(raster.surfaces, `${star.id} raster surfaces`).map(surface => requireRecord(surface, `${star.id} raster surface`)), first = surfaces[0];
  if (!first) throw new Error(`${star.id}: its raster recipe has no surface to take the file names from.`);
  const taken = surfaces.filter(surface => ids.has(requireString(surface.id, 'surface id')) && !(isRecord(surface.science) && surface.science.consumer === MAP_CONSUMER)).map(surface => surface.id);
  if (taken.length) throw new Error(`${star.id}: dataset ${taken.join(', ')} already exists and is not one of these maps.`);
  const manifest = structuredClone(host.manifest), inputs = requireArray(manifest.inputs, `${star.id} manifest inputs`).map(input => requireRecord(input, `${star.id} manifest input`));
  const content = structuredClone(host.content), shown = requireRecord(content.datasets, `${star.id} content datasets`), controls = requireArray(shown.controls, `${star.id} dataset controls`).map(control => requireRecord(control, `${star.id} dataset control`));
  const text = structuredClone(host.text), texts = requireRecord(text.datasets, `${star.id} text datasets`), count = maps.length, epochs = `${count} ${count === 1 ? 'epoch' : 'epochs'}`;
  const newSurfaces: Json[] = [], newInputs: Json[] = [], newControls: Json[] = [];
  for (const map of maps) { const { choice } = map, path = `${MAP_DIRECTORY}/${choice.program}.dat`, inputId = `${star.id}-espadons-map-${choice.id}`, tilt = Math.round(map.inclinationDegrees), outlined = tilt <= 85;
    const run = map.fromUtc.slice(0, 10) === map.toUtc.slice(0, 10) ? day(map.fromUtc) : `${day(map.fromUtc)} to ${day(map.toUtc)}`, programs = `CFHT program${map.proposals.length === 1 ? '' : 's'} ${map.proposals.join(', ')}`;
    const compared = map.published?.meanGauss === undefined ? '' : ` ${map.published.paper} map the same run with a mean field of ${gauss(map.published.meanGauss)} G; this map has ${gauss(map.meanGauss)} G.`;
    const outline = outlined ? ` Black line: ${tilt}° S; the star never shows us what lies below it.` : '';
    files.set(`${at}/source/${path}`, map.table);
    newInputs.push({ id: inputId, path, origin: SPECTRA_ARCHIVE.url, productId: `Magnetic map of ${map.targetName}, ${choice.label}, from ${map.spectra} ESPaDOnS spectra`,
      title: `Magnetic map of ${map.targetName} from ${map.spectra} polarised spectra of ${run}: radial, azimuthal and meridional field on a longitude-latitude grid`, sourceUrl: SPECTRA_ARCHIVE.url,
      credit: `CFHT ESPaDOnS, ${programs}, from the Canadian Astronomy Data Centre; reduced and mapped in this project with ${map.codes.join(', ')}. ${SPECTRA_ARCHIVE.acknowledgment}`, displayCredit: 'CFHT ESPaDOnS · mapped here',
      license: 'CC BY 4.0 for the archived spectra (Canadian Astronomy Data Centre); reduction by this project', licenseEvidence: [SPECTRA_ARCHIVE.terms, 'https://creativecommons.org/licenses/by/4.0/'],
      acquisition: `Written by ${MAP_GENERATOR} with the program ${choice.program}, which pins every archived spectrum by its size. The run's receipt (the line list, the codes and each step's result) is written again by that command under output/espadons and is not kept in git.`,
      redistribution: 'Archived spectra under CC BY 4.0, reduced here.', consumers: [MAP_CONSUMER],
      sourceBinding: { kind: 'catalogued', references: [{ catalogueId: SPECTRA_RECORD, role: 'material', evidence: SPECTRA_ARCHIVE.url }, { catalogueId: METHOD_RECORD, role: 'method', evidence: METHOD_URL }] } });
    newSurfaces.push({ id: choice.id, output: first.output, thumbnail: first.thumbnail, source: path, falseColor: true, science: { kind: 'terrestrial-scientific', id: choice.id, label: choice.label, format: 'tecplot-lonlat-map', path, variable: 'B<sub>R</sub> [G]',
      ...(outlined ? { outlineLatitudes: [-tilt] } : {}), consumer: MAP_CONSUMER, sampling: 'bilinear', displaySampling: 'bilinear', outputLongitudeOrigin: 0, units: 'G', minimum: -scale, maximum: scale, colors: [...COLORS], labels,
      description: `Radial component of the star's large-scale magnetic field, fitted with ZDIpy to ${map.spectra} ESPaDOnS spectra of ${run} (reduced chi-square ${map.chiSquare.toFixed(2)}, against ${map.chiSquareNoField.toFixed(1)} with no field); mean field ${gauss(map.meanGauss)} G. A reduction made in this project, not a published map.${outlined ? ` Black line: ${tilt} degrees south, below which the star never faces us.` : ''}`,
      title: `ESPaDOnS · magnetic map made here · ${choice.label}`, sourceUrl: SPECTRA_ARCHIVE.url } });
    newControls.push({ id: choice.id, label: 'Radial field', qualification: `Mapped in this project · CFHT ESPaDOnS spectra, ${choice.label}`, thumbnail: `${star.id}-dataset-${choice.id}.webp`, surface: `${star.id}-surface-${choice.id}@2x.webp`, poles: `${star.id}-poles-${choice.id}@2x.webp`,
      source: { id: inputId, path: '../manifest.json', url: SPECTRA_ARCHIVE.url }, falseColor: true, ...(count > 1 ? { step: { group: STEP_GROUP, label: choice.label } } : {}),
      legend: { kind: 'scale', title: 'Radial magnetic field', labels, recipe: { palette: PALETTE.map(color => [...color]), labels }, meta: 'G', sourceUrl: SPECTRA_ARCHIVE.url },
      notes: `The star's large-scale magnetic field in ${choice.label}, reconstructed in this project from ${map.spectra} archived ESPaDOnS spectra with the published codes LSDpy and ZDIpy. It is this project's reduction, not a published map.${compared}${count > 1 ? ` Step through the ${count} maps to see the field change.` : ''}`,
      legendNote: `Red: field pointing out of the star; blue: into it.${outline}` });
    texts[choice.id] = { title: `Radial field, ${choice.label}`, detail: `${epochs}, mapped here`, summary: 'The star\'s magnetic field, mapped in this project from archived spectra by how it polarises starlight.' };
  }
  const ours = (record: Json) => isRecord(record.science) && record.science.consumer === MAP_CONSUMER, oursInput = (input: Json) => Array.isArray(input.consumers) && input.consumers.includes(MAP_CONSUMER);
  const dropped = new Set(surfaces.filter(ours).map(surface => requireString(surface.id, 'surface id')).filter(id => !ids.has(id)));
  // The descriptor declares each surface dataset the page prepares, the way it declares the star's first one.
  const descriptor = structuredClone(host.descriptor), declared = requireArray(requireRecord(requireRecord(descriptor.properties, `${star.id} descriptor properties`).recipe, `${star.id} descriptor recipe`).surfaces, `${star.id} descriptor surfaces`).map(surface => requireRecord(surface, `${star.id} descriptor surface`));
  const body = declared.find(surface => Array.isArray(surface.datasets) && surface.datasets.some(dataset => isRecord(dataset) && dataset.id === first.id)), listed = body && requireArray(body.datasets, `${star.id} descriptor datasets`).map(dataset => requireRecord(dataset, `${star.id} descriptor dataset`)), like = listed?.find(dataset => dataset.id === first.id);
  if (!body || !listed || !like) throw new Error(`${star.id}: its descriptor does not declare the dataset ${String(first.id)} to take a new dataset's declaration from.`);
  body.datasets = [...listed.filter(dataset => !ids.has(requireString(dataset.id, 'declared dataset id')) && !dropped.has(requireString(dataset.id, 'declared dataset id'))), ...entry.maps.map(map => ({ ...like, id: map.id }))];
  files.set(`${at}/object.json`, json(descriptor));
  raster.surfaces = [...surfaces.filter(surface => !ours(surface)), ...newSurfaces];
  manifest.inputs = [...inputs.filter(input => !oursInput(input)), ...newInputs];
  shown.controls = [...controls.filter(control => !ids.has(requireString(control.id, 'control id')) && !dropped.has(requireString(control.id, 'control id'))), ...newControls];
  for (const id of dropped) delete texts[id];
  files.set(`${at}/source/preparation/raster.json`, json(raster)); files.set(`${at}/source/manifest.json`, json(manifest)); files.set(`${at}/source/content/object.json`, json(content)); files.set(`${at}/text.json`, json(text));
  return { files, report: `${count} radial-field ${count === 1 ? 'map' : 'maps'} on one scale of ±${scale} G (${maps.map(map => `${map.choice.label}: ${gauss(map.meanGauss)} G mean`).join('; ')})` };
}
