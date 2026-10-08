#!/usr/bin/env node
/**
 * Author a sphere package for an asteroid that has a measured size and no published shape model.
 *
 *   node packages/bake/authoring/asteroid-spheres/author.mts [--object=<id>,<id>]
 *
 * `inputs.json` names the bodies. Everything else is read from the JPL Small-Body Database record the tool downloads and
 * pins (`source/reference/sbdb.json`: diameter, rotation period, discovery, orbit class, each with JPL's stated reference)
 * and from JPL Horizons. The package has the layout of the centaur spheres (Pholus): a sphere at the listed diameter with
 * the no-data grid. `packages/bake/authoring/asteroid-colors/author.mts` then paints it with its measured color. The
 * astronomy record is written without elements; run `node packages/astronomy/cli/generate-asteroids.mts --object=<ids>`
 * next, then `node packages/bake/cli/prepare-object.mts <id>`.
 */
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { INVESTIGATION_LEDGER_SCHEMA, NEUTRAL_CATALOGUE_COLOR, OBJECT_TEXT_SCHEMA } from '@cssearth/objects';
import { elementsUrl, vectorsUrl } from '../../../../packages/astronomy/cli/lib/horizons.mts';

const ROOT = checkoutProjectRoot(import.meta.url), TEMPLATE = 'pholus', GENERATOR = 'packages/bake/authoring/asteroid-spheres/author.mts';
const EPOCH_JD = 2461286.5, AU_KM = 149597870.7, SBDB = 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html';
type Json = Record<string, unknown>;
const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const read = async (path: string): Promise<Json> => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const records = (value: unknown) => requireArray(value).map(item => requireRecord(item));
const write = async (path: string, value: string | Buffer) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };

const inputs = await read(resolve(import.meta.dirname, 'inputs.json')), checked = requireString(inputs.checked);
const only = process.argv.find(argument => argument.startsWith('--object='))?.slice(9).split(',');
const cache = resolve(ROOT, 'output/asteroid-spheres/downloads');
async function download(url: string, name: string) {
  const cached = resolve(cache, name), existing = await readFile(cached).catch(() => null);
  if (existing) return existing;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  await write(cached, bytes);
  return bytes;
}

const MONTHS: Record<string, string> = { Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June', Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December' };
/** JPL prints "1899-Dec-04" and "Charlois, A."; one discoverer reads "A. Charlois", and a list is left out of the sentence. */
function discoverySentence(name: string, discovery: Json) {
  const [year, month, day] = requireString(discovery.date).split('-'), who = requireString(discovery.who), location = requireString(discovery.location);
  if (!year || !MONTHS[month ?? ''] || !day) throw new TypeError(`${name}: unexpected discovery date ${String(discovery.date)}.`);
  const on = `${Number(day)} ${MONTHS[month!]} ${year}`, person = /^([^,]+), ((?:[A-Z]\. ?)+)$/u.exec(who);
  return { year, sentence: person ? `${person[2]!.trim()} ${person[1]} found ${name} at ${location} on ${on}.` : `${name} was found at ${location} on ${on}.` };
}
const POPULATIONS: Record<string, string> = { 'Main-belt Asteroid': 'Main-belt asteroid', 'Outer Main-belt Asteroid': 'Outer main-belt asteroid', 'Inner Main-belt Asteroid': 'Inner main-belt asteroid', 'Jupiter Trojan': 'Jupiter trojan' };

async function authorBody(body: Json) {
  const id = requireString(body.id), name = requireString(body.name), number = requireFiniteNumber(body.number);
  const pkg = resolve(ROOT, 'src/objects', id), src = resolve(pkg, 'source'), template = resolve(ROOT, 'src/objects', TEMPLATE);
  const lookup = `${SBDB}#/?sstr=${number}`, api = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${number}&discovery=1&phys-par=1`;

  // The pinned JPL record and what it states.
  const sbdbBytes = await download(api, `${id}-sbdb.json`);
  await write(resolve(src, 'reference/sbdb.json'), sbdbBytes);
  const sbdb = requireRecord(JSON.parse(sbdbBytes.toString('utf8'))), object = requireRecord(sbdb.object);
  const parameter = (key: string) => { const entry = records(sbdb.phys_par).find(item => item.name === key); if (!entry) throw new Error(`${id}: JPL lists no ${key}.`); return entry; };
  const diameter = parameter('diameter'), rotation = parameter('rot_per');
  const diameterKm = Number(requireString(diameter.value)), sigmaKm = diameter.sigma === null ? null : Number(requireString(diameter.sigma)), periodHours = Number(requireString(rotation.value));
  if (!(diameterKm > 0) || !(periodHours > 0)) throw new TypeError(`${id}: JPL's diameter or rotation period is not a positive number.`);
  const radiusKm = diameterKm / 2, radiusMeters = radiusKm * 1000, size = `${diameterKm}${sigmaKm === null ? '' : ` ± ${sigmaKm}`} km`;
  const className = requireString(requireRecord(object.orbit_class).name), population = POPULATIONS[className];
  if (!population) throw new Error(`${id}: no reader wording for the orbit class ${className}.`);
  const found = discoverySentence(name, requireRecord(sbdb.discovery));
  const credit = `JPL Small-Body Database, physical parameters for ${number} ${name}: diameter ${size}; JPL's stated reference: ${requireString(diameter.ref)}`;
  const shapeMeaning = `Illustrative sphere at the ${diameterKm} km diameter the JPL Small-Body Database lists for ${name}. No shape model is published.`;
  const orientationMeaning = 'Illustrative ICRF north pole, arbitrary prime meridian and phase; no spin pole is published.';
  const coverage = `${shapeMeaning} ${orientationMeaning} The grid marks unmapped terrain.`;
  const card = `${population} found in ${found.year}.`;

  // Horizons: the orbit facts and a first world frame; preparation replaces the frame.
  const command = `${number};`, horizons: Record<string, string> = {};
  for (const [file, url] of [['horizons-elements.txt', elementsUrl({ command, center: '500@10', startJd: EPOCH_JD, stopJd: EPOCH_JD + 1, stepDays: 1 })],
    ['horizons-vectors.txt', vectorsUrl({ command, center: '500@10', epochsJdTdb: [EPOCH_JD - 30, EPOCH_JD, EPOCH_JD + 30], outUnits: 'KM-D' })]] as const) {
    horizons[file] = `# ${url}\n${(await download(url, `${id}-${file}`)).toString('utf8')}`;
    await write(resolve(src, 'reference', file), horizons[file]!);
  }
  const elements = horizons['horizons-elements.txt']!, header = elements.slice(0, elements.indexOf('$$SOE')).split('\n').reverse().find(line => line.includes('JDTDB') && line.includes(','));
  const row = elements.slice(elements.indexOf('$$SOE'), elements.indexOf('$$EOE')).split('\n').find(line => line.includes(','));
  if (!header || !row) throw new TypeError(`${id}: Horizons elements are missing.`);
  const semiMajorAxisAu = Number(row.split(',')[header.split(',').map(value => value.trim()).indexOf('A')]) / AU_KM;
  const epochRow = horizons['horizons-vectors.txt']!.slice(horizons['horizons-vectors.txt']!.indexOf('$$SOE')).split('\n').find(line => line.startsWith(`${EPOCH_JD.toFixed(9)},`));
  if (!epochRow || !(semiMajorAxisAu > 0)) throw new TypeError(`${id}: Horizons lacks the ${EPOCH_JD} epoch.`);
  const originM = epochRow.split(',').slice(2, 5).map(value => Number(value) * 1000);

  // Shape: the sphere on the 5-degree grid the terrestrial recipe reads.
  const lines: string[] = [];
  for (let latitude = -90; latitude <= 90; latitude += 5) for (let longitude = 0; longitude <= 360; longitude += 5) lines.push(`${longitude} ${latitude} ${radiusKm.toFixed(12)}`);
  await write(resolve(src, 'shape/ellipsoid.tab'), `${lines.join('\n')}\n`);
  for (const file of ['material/neutral.png', 'presentation/context.png', 'presentation/minimap.json', 'preparation/acquisition.json']) {
    await mkdir(dirname(resolve(src, file)), { recursive: true });
    await copyFile(resolve(template, 'source', file), resolve(src, file));
  }
  const measurements = { schema: 'cssearth-distant-world-model@1', checkedOn: checked, id, name, titleLabel: name, horizons: command, aliases: [`${number} ${name}`], classification: 'asteroid', population,
    fullAxesKm: [diameterKm, diameterKm, diameterKm], radiusKm, axesStatus: 'Illustrative equal axes at the diameter JPL lists; not three measured axes.', poleIcrfDegrees: [0, 90],
    periodHours, periodText: `${periodHours} h`, periodSource: lookup, periodReference: requireString(rotation.ref), rotationFact: true, shapeLabel: 'Sphere at the JPL diameter', source: lookup, credit, papers: [lookup],
    shapeMeaning, orientationMeaning, surfaceMeaning: 'Unmapped surface: the standard grid is a coordinate aid, not observed color or terrain.', introduction: found.sentence, card,
    datasetSummary: `A sphere at the ${diameterKm} km diameter JPL lists. Its shape and pole are not measured.`, distanceAu: Number(semiMajorAxisAu.toFixed(3)) };
  await write(resolve(src, 'measurements.json'), json(measurements));

  // Preparation records, from the template's.
  const terrestrial = await read(resolve(template, 'source/preparation/terrestrial.json')), raster = requireRecord(terrestrial.raster), geometry = requireRecord(terrestrial.geometry);
  const observation = records(raster.observations)[0]!, radial = requireRecord(geometry.radialTerrain);
  await write(resolve(src, 'preparation/terrestrial.json'), json({ ...terrestrial, namespace: id, displayName: name, publicBase: `/scenes/${id}/`,
    raster: { ...raster, observations: [{ ...observation, metadata: { ...requireRecord(observation.metadata), coverage } }] },
    geometry: { ...geometry, radiusKm, camera: { framingScale: 1 }, mapUrl: `/scenes/${id}/${id}-model-surface@2x.webp`, polesUrl: `/scenes/${id}/${id}-model-poles@2x.webp`,
      radialTerrain: { ...radial, simplification: { ...requireRecord(radial.simplification), maximumErrorMeters: radiusKm * 25 } } },
    celestial: { sunSource: `JPL Horizons fixed 2026-09-03 epoch. ${orientationMeaning}` } }));
  await write(resolve(src, 'preparation/rotation.json'), json({ schema: 'cssearth-display-orientation@1', rightAscensionDegrees: 0, declinationDegrees: 90, displayMeridianDegrees: 0,
    phase: 'arbitrary-display-phase', source: lookup, qualification: orientationMeaning }));
  await write(resolve(src, 'preparation/navigation.json'), json({ ...await read(resolve(template, 'source/preparation/navigation.json')), objectId: id }));

  // Content and reader text.
  const factSource = (locator: string) => ({ url: lookup, label: credit, checked, path: 'source/measurements.json', catalogueId: 'jpl-small-body-database', locator });
  const content = await read(resolve(template, 'source/content/object.json')), control = records(requireRecord(content.datasets).controls)[0]!;
  await write(resolve(src, 'content/object.json'), json({ ...content, id, displayName: name,
    panel: { facts: [{ id: 'dimensions', label: 'Display model extents', value: `${diameterKm} × ${diameterKm} × ${diameterKm} km`, source: factSource('/fullAxesKm/0; /fullAxesKm/1; /fullAxesKm/2') },
      { id: 'rotation', label: 'Rotation', value: `${periodHours} h`, source: factSource('/periodText') }], moreFacts: [] },
    datasets: { ...requireRecord(content.datasets), controls: [{ ...control, thumbnail: `/scenes/${id}/${id}-model-thumbnail.webp`, surface: `${id}-model-surface@2x.webp`, poles: `${id}-model-poles@2x.webp`,
      source: { id: 'published-shape', path: '../manifest.json', url: lookup }, notes: coverage }] },
    resources: [{ label: 'Shape source', role: 'surface', description: credit, href: lookup }],
    provenance: { editorial: { url: lookup, credit }, physical: { path: '../measurements.json', credit } } }));
  const citation = { catalogueId: 'jpl-small-body-database', url: lookup, label: 'JPL Small-Body Database', checked, locator: 'Object, discovery circumstances, orbit and physical parameters',
    quote: `${requireString(object.fullname).trim()}; Discovered ${requireString(requireRecord(sbdb.discovery).date)} by ${requireString(requireRecord(sbdb.discovery).who)} at ${requireString(requireRecord(sbdb.discovery).location)}; orbit class: ${className}; diameter: ${diameterKm} km` };
  await write(resolve(pkg, 'text.json'), json({ schema: OBJECT_TEXT_SCHEMA, objectId: id, card: { text: card, sources: [citation] }, introduction: { text: found.sentence, sources: [citation] },
    datasets: { model: { title: 'Sphere at the JPL diameter', detail: 'Inferred shape', summary: measurements.datasetSummary, sources: [citation] } } }));

  // Descriptor and astronomy record.
  const descriptor = await read(resolve(template, 'object.json')), properties = requireRecord(descriptor.properties), recipe = requireRecord(properties.recipe);
  await write(resolve(pkg, 'object.json'), json({ ...descriptor, id, properties: { ...properties, preparation: { ...requireRecord(properties.preparation), label: name },
    recipe: { ...recipe, shape: { kind: 'radial-terrain', radiusKm } },
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: EPOCH_JD, originM, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 0, 1],
      metersPerUnit: radiusMeters / requireFiniteNumber(geometry.radius), bodyRadiusM: radiusMeters },
    catalog: { name, classification: 'asteroid', color: NEUTRAL_CATALOGUE_COLOR, distanceAu: semiMajorAxisAu, description: card, systemName: 'Solar System', context: {}, illustrationDatasets: ['model'] } } }));
  const astronomyPath = resolve(ROOT, 'packages/astronomy/data/bodies', `${id}.json`);
  if (!await readFile(astronomyPath).catch(() => null)) await write(astronomyPath, json({ id, classification: 'asteroid',
    physical: { name, horizonsCode: command, meanRadiusKm: radiusKm, gravitationalParameterKm3PerS2: 0, parent: 'sun' },
    physicalNotes: 'Sphere at the diameter the JPL Small-Body Database lists.', acquisition: { heliocentric: { target: command, model: 'asteroid' } } }));

  // Documentation.
  await write(resolve(pkg, 'NOTICE.md'), `# Credits

Identity, orbit class, discovery and physical parameters: NASA/JPL Small-Body Database, with the references JPL states for each value. Orbit: NASA/JPL Horizons.

Numerical extraction and sphere approximation: cssEarth, MIT. Retain the source citations and the approximate status; research papers are not relicensed or bundled. The missing-data grid is authored display content, not observed regolith.
`);
  await write(resolve(pkg, 'README.md'), `# (${number}) ${name}

${name} is a ${population.toLowerCase()} about ${Math.round(diameterKm)} km across. ${found.sentence}

## Sources

${shapeMeaning} ${credit}. The [pinned record](source/reference/sbdb.json) holds the values as JPL returned them on ${checked}.

- **Size:** ${size}, from ${requireString(diameter.ref)}.
- **Rotation:** ${periodHours} h, from ${requireString(rotation.ref)}. It is shown as a fact; the sphere's pole and phase are display conventions.
- **Orbit:** [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) osculating elements and vectors at the shared 2026-09-03 epoch.

## Evidence

Written on ${checked} by \`${GENERATOR}\` from its [inputs](../../../packages/bake/authoring/asteroid-spheres/inputs.json). No dated test report exists for this body yet.

## Known problems

The body is drawn as a sphere with the shared grid that marks unmapped terrain. Its true shape, pole, color and albedo pattern are not published, and none is shown. The pole and prime meridian are display conventions.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)

The [investigation ledger](investigations.json) records the source survey.
`);
  await write(resolve(pkg, 'investigations.json'), json({ schema: INVESTIGATION_LEDGER_SCHEMA, objectId: id, entries: [
    { id: 'sbdb-diameter', subject: 'Size: JPL Small-Body Database diameter', status: 'included',
      finding: `${number} ${name} is drawn as a sphere at the ${size} diameter the JPL Small-Body Database lists, with JPL's stated reference ${requireString(diameter.ref)}. DAMIT held no shape model for it on ${checked}, so the sphere is illustrative.`,
      evidence: [api, 'https://damit.cuni.cz/exports/table/asteroids'] }] }));

  // Manifest: the two inputs of the template, then every other source file as a document.
  const manifest = await read(resolve(template, 'source/manifest.json'));
  const note = `Read from the JPL Small-Body Database record pinned at reference/sbdb.json; reproduce with ${GENERATOR}.`;
  const projection = { type: 'equirectangular', longitudeDirection: 'east-positive', referenceRadiusMeters: radiusMeters };
  const inputsList: Json[] = records(manifest.inputs).map(input => input.id === 'published-shape'
    ? { ...input, origin: lookup, credit, licenseEvidence: [lookup], coverage, projection, acquisition: note }
    : { ...input, projection, acquisition: note });
  const intermediates: Json[] = records(manifest.generatedIntermediates).map(entry => ({ ...entry, origin: lookup, credit }));
  const declared = new Set([...inputsList, ...intermediates].map(entry => requireString(entry.path)));
  const walk = async (path: string): Promise<string[]> => (await Promise.all((await readdir(path, { withFileTypes: true }))
    .map(entry => entry.isDirectory() ? walk(resolve(path, entry.name)) : [resolve(path, entry.name)]))).flat();
  const documents = (await walk(src)).map(path => relative(src, path)).filter(path => path !== 'manifest.json' && !declared.has(path)).sort()
    .map(path => ({ path, ...(path === 'content/object.json' ? { sourceBinding: { kind: 'local', reason: 'Project-authored factsheet, dataset recipes and legends.' } } : {}) }));
  await write(resolve(src, 'manifest.json'), json({ ...manifest, inputs: inputsList, documents, generatedIntermediates: intermediates }));
  console.log(`${id.padEnd(16)} ${String(number).padStart(5)}  ${size}  ${periodHours} h  ${semiMajorAxisAu.toFixed(3)} au  ${card}`);
}

for (const body of records(inputs.bodies)) if (!only || only.includes(requireString(body.id))) await authorBody(body);
