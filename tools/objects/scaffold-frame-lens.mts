/**
 * A ground-based photograph lens for a body, from the survey's release to a measured recipe, in one command.
 *
 * Given the LAM VLT/SPHERE survey's directory for a body, its reconstruction and rotation record, and the column order
 * of that record, this pins the inputs, writes the acquisition steps, the manifest inputs, the derivation record, the
 * lens recipe on the mesh the record describes, the reader control and text, the README section with its report
 * markers and a ledger entry, derives every camera from the pinned inputs, and then measures the lens the way
 * preparation will. Nothing is fitted; the last line printed is the registration stage's verdict.
 *
 *   node tools/objects/scaffold-frame-lens.mts <object-id> --survey 130Elektra --stem 130_Elektra --order longitude-first [--from <dir>] [--frames cam1]
 *
 * `--from` takes a directory holding `frames/<survey>/`, `<stem>_adam.obj`, `<stem>_param.txt` and `hz-<survey>-observer.txt`
 * and `hz-<survey>-heliocentric.txt` already fetched; without it the survey site and JPL Horizons are asked.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { requireArray, requireRecord, requireString } from '../source-values.mts';
import { readFitsHdu } from '../fits.mts';
import { decodeCalibratedCamera, loadCameraShape } from './terrestrial-layers/shape-camera-mosaic.mts';
import { deriveObserverCameras, loadObserverCameraInputs, recipeFields, zimpolExposure, OBSERVER_CAMERAS_SCHEMA } from './terrestrial-layers/observer-cameras.mts';
import { radialTerrainForLens } from './terrestrial-layers/radial-models.mts';
import { measureBody } from './measure-lens.mts';
import { registrationBlock, withRegistrationBlock, REGISTRATION_BLOCK_BEGIN, REGISTRATION_BLOCK_END } from './report-registration.mts';

const ROOT = resolve(import.meta.dirname, '../..');
const LAM = 'https://observations.lam.fr/astero', COOKIE = { Cookie: 'CesAM_LAM_opens_the_door=1' };
const CREDIT = 'F. Marchis, L. Jorda, P. Vernazza et al.; ESO/VLT/SPHERE; LAM asteroid survey';
const LICENSE = 'Public scientific release from the source-author site accompanying CC-BY-4.0 research; retain credit and citations.';

const args = process.argv.slice(2), objectId = args[0];
const option = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const survey = option('survey'), stem = option('stem'), order = option('order'), from = option('from'), cameraFilter = option('frames') ?? 'cam1';
if (!objectId || !survey || !stem || (order !== 'latitude-first' && order !== 'longitude-first')) {
  console.error('usage: node tools/objects/scaffold-frame-lens.mts <object-id> --survey <N><Name> --stem <N>_<Name> --order latitude-first|longitude-first [--from <dir>] [--frames cam1]');
  process.exit(2);
}
const objectDirectory = resolve(ROOT, 'src/objects', objectId), sourceDirectory = resolve(objectDirectory, 'source');
if (!existsSync(resolve(sourceDirectory, 'preparation/terrestrial.json'))) throw new Error(`${objectId} has no terrestrial recipe to add a lens to.`);
// Everything the scaffold rewrites is kept as it was, so a lens that does not register can be unwired again and only the ledger keeps the numbers.
const rewritten = ['source/preparation/terrestrial.json', 'source/preparation/acquisition.json', 'source/manifest.json', 'source/content/object.json', 'object.json', 'text.json', 'README.md'];
const originals = new Map(await Promise.all(rewritten.map(async path => [path, await readFile(resolve(objectDirectory, path))] as const)));
const recordsBefore = new Set(await readdir(resolve(ROOT, 'src/sources')));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = async (path: string) => requireRecord(JSON.parse(await readFile(path, 'utf8')));
const write = (path: string, value: unknown) => writeFile(path, JSON.stringify(value, null, 2) + '\n');
const fetchBytes = async (url: string) => { const response = await fetch(url, { headers: COOKIE }); if (!response.ok) throw new Error(`${url}: ${response.status}`); return Buffer.from(await response.arrayBuffer()); };

// 1. Inputs: the frames, the reconstruction, the rotation record, and Horizons at the frames' epochs.
await Promise.all(['observations', 'shape', 'reference'].map(directory => mkdir(resolve(sourceDirectory, directory), { recursive: true })));
const meshName = `${stem}_adam.obj`, recordName = `${stem}_param.txt`;
let frameNames: string[];
if (from) {
  const local = resolve(from, 'frames', survey);
  frameNames = (await readdir(local)).filter(name => name.endsWith(`_${cameraFilter}.fits`)).sort();
  for (const name of frameNames) await copyFile(resolve(local, name), resolve(sourceDirectory, 'observations', name));
  await copyFile(resolve(from, meshName), resolve(sourceDirectory, 'shape', meshName));
  await copyFile(resolve(from, recordName), resolve(sourceDirectory, 'reference', recordName));
  for (const kind of ['observer', 'heliocentric']) await copyFile(resolve(from, `hz-${survey}-${kind}.txt`), resolve(sourceDirectory, 'reference', `horizons-sphere-${kind}.txt`));
} else {
  const listing = (await fetchBytes(`${LAM}/Data/${survey}/Deconv/`)).toString();
  frameNames = [...listing.matchAll(/href="([^"]*_(?:cam1|cam2)\.fits)"/g)].map(match => match[1]).filter(name => name.endsWith(`_${cameraFilter}.fits`)).sort();
  for (const name of frameNames) await writeFile(resolve(sourceDirectory, 'observations', name), await fetchBytes(`${LAM}/Data/${survey}/Deconv/${name}`));
  await writeFile(resolve(sourceDirectory, 'shape', meshName), await fetchBytes(`${LAM}/3Dshape/${meshName}`));
  await writeFile(resolve(sourceDirectory, 'reference', recordName), await fetchBytes(`${LAM}/3Dshape/${recordName}`));
}
if (!frameNames.length) throw new Error(`No ${cameraFilter} frames for ${survey}.`);

// The frames' own headers: exposure start, filter, plate scale, and the sky level the lens states as a fraction of the peak.
const frames = await Promise.all(frameNames.map(async name => {
  const bytes = await readFile(resolve(sourceDirectory, 'observations', name)), { header } = readFitsHdu(bytes), exposure = zimpolExposure(header);
  const image = decodeCalibratedCamera(bytes, 'fits-zimpol-intensity');
  let peak = -Infinity; for (const v of image.data) if (v > peak) peak = v;
  const stamp = exposure.start.replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  return { name, bytes, exposure, width: image.width, height: image.height, id: `zimpol-${stamp}`, backgroundMaximum: Number((peak * 0.001).toPrecision(5)) };
}));

const number = Number(survey.match(/^\d+/)?.[0]);
const horizonsUrl = (kind: 'observer' | 'heliocentric', jds: number[]) => {
  const base: Record<string, string> = { format: 'text', COMMAND: `'${number};'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", TLIST_TYPE: "'JD'", TLIST: jds.map(jd => jd.toFixed(9)).join(',') };
  const extra: Record<string, string> = kind === 'observer' ? { EPHEM_TYPE: "'OBSERVER'", CENTER: "'309'", QUANTITIES: "'1,13,20,43'", ANG_FORMAT: "'DEG'" } : { EPHEM_TYPE: "'VECTORS'", CENTER: "'500@10'", REF_PLANE: "'FRAME'", VEC_TABLE: "'1'", OUT_UNITS: "'AU-D'" };
  return 'https://ssd.jpl.nasa.gov/api/horizons.api?' + new URLSearchParams({ ...base, ...extra }).toString();
};
const startJds = frames.map(frame => frame.exposure.startJd);
if (!from) {
  const observer = (await fetchBytes(horizonsUrl('observer', startJds))).toString();
  await writeFile(resolve(sourceDirectory, 'reference/horizons-sphere-observer.txt'), observer);
  const rows = observer.slice(observer.indexOf('$$SOE'), observer.indexOf('$$EOE')).split('\n').slice(1).filter(line => line.trim());
  const deltas = rows.map(line => (line.slice(25).replace(/^\s*[a-zA-Z*]{1,2}\s+/, ' ').match(/-?\d+\.\d+(?:E[+-]\d+)?/g) ?? []).map(Number)[3]);
  await writeFile(resolve(sourceDirectory, 'reference/horizons-sphere-heliocentric.txt'), (await fetchBytes(horizonsUrl('heliocentric', startJds.map((jd, i) => jd - deltas[i] * 499.004784 / 86400)))).toString());
}
const observerRows = (await readFile(resolve(sourceDirectory, 'reference/horizons-sphere-observer.txt'), 'utf8'));
const deltas = observerRows.slice(observerRows.indexOf('$$SOE'), observerRows.indexOf('$$EOE')).split('\n').slice(1).filter(line => line.trim())
  .map(line => (line.slice(25).replace(/^\s*[a-zA-Z*]{1,2}\s+/, ' ').match(/-?\d+\.\d+(?:E[+-]\d+)?/g) ?? []).map(Number)[3]);

// 2. Acquisition: every input restorable, the Horizons tables refreshable.
const acquisitionPath = resolve(sourceDirectory, 'preparation/acquisition.json'), acquisition = await json(acquisitionPath), operations = requireArray(acquisition.operations).map(value => requireRecord(value));
const have = new Set(operations.map(operation => operation.path));
const add = (operation: Record<string, unknown>) => { if (!have.has(operation.path)) { operations.push(operation); have.add(operation.path as string); } };
add({ kind: 'download', groups: ['restore', 'refresh'], path: `shape/${meshName}`, url: `${LAM}/3Dshape/${meshName}`, headers: COOKIE });
add({ kind: 'download', groups: ['restore', 'refresh'], path: `reference/${recordName}`, url: `${LAM}/3Dshape/${recordName}`, headers: COOKIE });
for (const frame of frames) add({ kind: 'download', groups: ['restore', 'refresh'], path: `observations/${frame.name}`, url: `${LAM}/Data/${survey}/Deconv/${frame.name}`, headers: COOKIE });
add({ kind: 'download', groups: ['refresh'], path: 'reference/horizons-sphere-observer.txt', url: horizonsUrl('observer', startJds) });
add({ kind: 'download', groups: ['refresh'], path: 'reference/horizons-sphere-heliocentric.txt', url: horizonsUrl('heliocentric', startJds.map((jd, i) => jd - deltas[i] * 499.004784 / 86400)) });
acquisition.operations = operations; await write(acquisitionPath, acquisition);

// 3. The manifest: the mesh, the frames and the Horizons tables as inputs, the record and the derivation record as documents.
const recipePath = resolve(sourceDirectory, 'preparation/terrestrial.json'), recipe = await json(recipePath), geometry = requireRecord(recipe.geometry);
const manifestPath = resolve(sourceDirectory, 'manifest.json'), manifest = await json(manifestPath), inputs = requireArray(manifest.inputs).map(value => requireRecord(value));
const ids = new Set(inputs.map(input => input.id));
const capture = { attributions: [{ kind: 'machine', machineId: 'vlt-ut3', missionId: 'eso-sphere-asteroid-survey', evidence: `The preserved credit for this input reads: ${CREDIT}` }] };
const meshBytes = await readFile(resolve(sourceDirectory, 'shape', meshName)), meshLines = meshBytes.toString().split('\n');
const meshId = `${objectId}-adam-shape`, baseTerrain = requireRecord(geometry.radialTerrain), baseIsAdam = String(baseTerrain.path).endsWith('_adam.obj');
if (!ids.has(meshId) && !baseIsAdam) inputs.push({ id: meshId, path: `shape/${meshName}`, origin: `${LAM}/3Dshape/${meshName}`, credit: CREDIT, capture, license: LICENSE,
  acquisition: 'Restored through source/preparation/acquisition.json. Its ordinary public-site cookie is included in the request headers.', redistribution: 'Attributed scientific display derivatives; see NOTICE.md.',
  consumers: ['adam-terrain'], projection: { kind: 'body-fixed-cartesian-triangular-mesh', longitudeDirection: 'east', latitudeType: 'planetocentric', units: 'kilometers', referenceRadiusMeters: Number(geometry.radiusKm) * 1000 },
  coverage: "ADAM reconstruction from the same survey. The release's rotation parameters describe this frame, so the photographic lens is registered to this mesh rather than to the separately re-optimised MPCD model.",
  expectedBytes: meshBytes.length, expectedSha256: sha(meshBytes) });
for (const frame of frames) {
  const id = `${objectId}-sphere-${frame.exposure.start.replace(/[-:.]/g, '').replace('T', 't').toLowerCase()}`;
  if (ids.has(id)) continue;
  inputs.push({ id, path: `observations/${frame.name}`, origin: `${LAM}/Data/${survey}/Deconv/${frame.name}`, credit: CREDIT, capture, license: LICENSE,
    acquisition: 'Restored through source/preparation/acquisition.json. Its ordinary public-site cookie is included in the request headers.', redistribution: 'Attributed scientific display derivatives; see NOTICE.md.',
    consumers: ['sphere-photograph'], coverage: `Deconvolved VLT/SPHERE/ZIMPOL intensity frame, camera 1, ${frame.exposure.start.replace('T', ' ')} UT. Derived from the ESO pipeline product named in its own header; the deconvolution is the survey's and is not described in the file.`,
    expectedBytes: frame.bytes.length, expectedSha256: sha(frame.bytes), width: frame.width, height: frame.height, lensId: 'zimpol', label: 'Deconvolved ZIMPOL frame' });
}
for (const [kind, coverage] of [['observer', 'observer table: right ascension, declination, angular diameter, distance and phase angle for Paranal at each exposure'], ['heliocentric', 'heliocentric position vectors in the J2000 frame at each light-time-corrected exposure epoch, for the Sun direction']] as const) {
  const id = `${objectId}-horizons-sphere-${kind}`, bytes = await readFile(resolve(sourceDirectory, `reference/horizons-sphere-${kind}.txt`));
  if (ids.has(id)) continue;
  inputs.push({ id, path: `reference/horizons-sphere-${kind}.txt`, origin: 'https://ssd.jpl.nasa.gov/api/horizons.api', credit: 'NASA/JPL-Caltech, Solar System Dynamics: JPL Horizons', license: 'Public ephemeris service output; cite JPL Horizons.',
    acquisition: `Pinned response from the JPL Horizons API for target ${number} and observer code 309, Paranal, at the ${frames.length} ZIMPOL exposure epochs. The query is the refresh step in source/preparation/acquisition.json.`,
    redistribution: 'Public NASA/JPL output; retain the citation.', consumers: ['sphere-sighting-geometry'], coverage, expectedBytes: bytes.length, expectedSha256: sha(bytes) });
}
manifest.inputs = inputs;

// 4. The derivation record, and the lens recipe on the mesh the record describes.
const derivationPath = resolve(sourceDirectory, 'preparation/observer-cameras.json');
await write(derivationPath, { schema: OBSERVER_CAMERAS_SCHEMA, lensId: 'zimpol', rotation: { kind: 'spin-record', path: `reference/${recordName}`, columnOrder: order },
  ephemeris: { observer: 'reference/horizons-sphere-observer.txt', heliocentric: 'reference/horizons-sphere-heliocentric.txt' }, epoch: 'exposure-midpoint', centre: { method: 'limb', edgeFraction: 0.25 } });
if (!baseIsAdam) {
  const vertices = meshLines.filter(line => line.startsWith('v ')).length, faces = meshLines.filter(line => line.startsWith('f ')).length, simplification = requireRecord(baseTerrain.simplification);
  const alternatives = requireArray(geometry.radialTerrainAlternatives ?? []).map(value => requireRecord(value)).filter(entry => entry.lensId !== 'zimpol');
  alternatives.push({ lensId: 'zimpol', path: `shape/${meshName}`, format: 'wavefront-obj', grid: { metersPerUnit: 1000, expectedVertices: vertices, expectedFaces: faces },
    latitudeSegments: baseTerrain.latitudeSegments ?? 90, longitudeSegments: baseTerrain.longitudeSegments ?? 180, faceBudget: baseTerrain.faceBudget, tileSize: baseTerrain.tileSize, atlasColumns: baseTerrain.atlasColumns, primitive: baseTerrain.primitive ?? 'u',
    simplification: { method: 'source-meshoptimizer', targetFaces: simplification.targetFaces, maximumErrorMeters: simplification.maximumErrorMeters, regularize: true } });
  geometry.radialTerrainAlternatives = alternatives;
}
const dates = [...new Set(frames.map(frame => frame.exposure.start.slice(0, 10)))].sort(), span = dates.length > 1 ? `${dates[0]} to ${dates[dates.length - 1]}` : dates[0];
const meshNote = baseIsAdam ? 'cast onto the same mesh the Shape view uses, which is the one this body\'s rotation record describes' : 'cast onto the ADAM reconstruction from the same survey, the mesh its rotation record describes, while the Shape view keeps the MPCD model';
const lenses = requireArray(requireRecord(recipe.raster).surfaceObservations ?? []).map(value => requireRecord(value)).filter(lens => lens.id !== 'zimpol');
lenses.push({ id: 'zimpol', format: 'controlled-shape-camera', consumer: 'sphere-photograph',
  metadata: { label: 'SPHERE photograph', falseColor: false, coverage: `${frames.length} deconvolved VLT/SPHERE/ZIMPOL frames, ${span}, ${meshNote}. The camera's pointing and orientation are computed from that record, JPL Horizons geometry and each frame's header; the exposure epoch is the midpoint of each frame's stated exposure, the disc centre is fitted to the limb of the lens mesh, and the sky threshold is one stated fraction of the frame's peak. The registration stage measures the lens and its README states the numbers. Grayscale retains photographed illumination and matched relative frame brightness, not measured albedo. The grid marks unphotographed, grazing or rejected surface.` },
  frames: frames.map(frame => ({ id: frame.id, path: `observations/${frame.name}`, encoding: 'fits-zimpol-intensity', backgroundMaximum: frame.backgroundMaximum,
    observerLatitude: 0, observerWestLongitude: 0, sunLatitude: 0, sunWestLongitude: 0, rangeKm: 1, northAzimuthDegrees: 0, pixelAngleMicroradians: frame.exposure.pixelAngleMicroradians, center: [frame.width / 2, frame.height / 2] })),
  selection: 'finest-resolution', levelMatching: { samplesPerTriangle: 24, minimumPairs: 128, maximumGain: 4, maximumAngleDegrees: 60 },
  transfer: { maximumSeparationFootprints: 2, visibilityToleranceMeters: 0.5, maximumEmissionDegrees: 70, interpretation: 'Trial acceptance bounds, not estimates of source accuracy. A footprint is the pixel\'s range times its angular size, so a contributor lies within two of those of the closest source-mesh point, and that point must be visible from the stated camera in the full mesh.' },
  photometry: { model: 'retained-observation', referenceIncidenceDegrees: 0, referenceEmissionDegrees: 0, maximumIncidenceDegrees: 70, maximumEmissionDegrees: 70, maximumGain: 1 },
  display: { percentiles: [1, 99.5] }, refinement: { by: 'relief', tilt: 'silhouette' } });
requireRecord(recipe.raster).surfaceObservations = lenses;
await write(recipePath, recipe);

// 5. Every camera field and centre from the pinned inputs, written into the recipe.
{
  const { record, recipe: current, frames: stated } = await loadObserverCameraInputs(sourceDirectory);
  const mesh = await loadCameraShape(sourceDirectory, radialTerrainForLens(current as unknown as Parameters<typeof radialTerrainForLens>[0], record.lensId));
  const derived = await deriveObserverCameras(sourceDirectory, record, stated, mesh, ROOT);
  const document = await json(recipePath), target = requireArray(requireRecord(document.raster).surfaceObservations).map(value => requireRecord(value)).find(lens => lens.id === 'zimpol');
  if (!target) throw new Error('The lens vanished while being derived.');
  for (const [index, frame] of requireArray(target.frames).map(value => requireRecord(value)).entries()) Object.assign(frame, recipeFields(derived[index]));
  await write(recipePath, document);
}

// 6. The reader: the lens in the object descriptor, its control, its text.
const descriptorPath = resolve(objectDirectory, 'object.json'), descriptor = await json(descriptorPath);
const surfaceLenses = requireArray(requireRecord(requireArray(requireRecord(requireRecord(descriptor.properties).recipe).surfaces)[0]).lenses);
if (!surfaceLenses.some(lens => requireRecord(lens).id === 'zimpol')) surfaceLenses.push({ id: 'zimpol', source: 'content', material: 'lighting' });
const controlPath = resolve(sourceDirectory, 'content/object.json'), control = await json(controlPath), controls = requireArray(requireRecord(control.lenses).controls);
if (!controls.some(entry => requireRecord(entry).id === 'zimpol')) controls.push({ id: 'zimpol', label: 'SPHERE photograph', thumbnail: `/scenes/${objectId}/${objectId}-zimpol-thumbnail.webp`, surface: `${objectId}-zimpol-surface@2x.webp`, poles: `${objectId}-zimpol-surface@2x.webp`,
  source: { id: `${objectId}-sphere-${frames[0].exposure.start.replace(/[-:.]/g, '').replace('T', 't').toLowerCase()}`, path: '../manifest.json' }, falseColor: false, noData: true,
  notes: `${frames.length} deconvolved VLT/SPHERE/ZIMPOL frames, ${span}, ${meshNote}. Pointing and orientation are computed from the survey's rotation record, JPL Horizons geometry and each frame's header, at the midpoint of its exposure; the disc centre is fitted to the limb of the mesh. Grayscale is photographed illumination and matched relative frame brightness. The deconvolution carries no radiometric calibration, so this is not measured albedo or colour. The grid marks surface that was unphotographed, too grazing, or rejected.` });
await write(controlPath, control);
const textPath = resolve(objectDirectory, 'text.json'), text = await json(textPath);
(text.datasets ??= {}) as Record<string, unknown>;
(text.datasets as Record<string, unknown>).zimpol = { title: 'ZIMPOL deconvolved imaging', detail: `${frames.length} frames, ${dates[0].slice(0, 4)}`, summary: 'Telescope images of the lit surface, placed by the asteroid\'s own measured spin. Grey is photographed light, not colour.' };
await write(textPath, text);

// 7. The README section with the report markers, and the pins.
const readmePath = resolve(objectDirectory, 'README.md');
let readme = await readFile(readmePath, 'utf8');
if (!readme.includes('**SPHERE photograph**')) {
  const section = `\n**SPHERE photograph** casts ${frames.length} deconvolved VLT/SPHERE/ZIMPOL frames from ${span} onto ${baseIsAdam ? 'the same mesh the Shape view uses' : 'the ADAM reconstruction from the same survey, the mesh its rotation record describes'}. The camera's pointing and orientation are derived, not fitted: the pole, period and phase epoch come from the release's own parameter record (\`source/reference/${recordName}\`, read ${order}), the observing geometry from pinned JPL Horizons responses for Paranal, and the plate scale, exposure and filter from each frame's own header, at the midpoint of the exposure. The disc centre is fitted to the limb the mesh projects; the sky threshold is one stated fraction of each frame's peak. \`source/preparation/observer-cameras.json\` names every input, so \`tools/objects/observer-cameras.mts\` re-derives the recipe and its test refuses one that drifts. Grayscale is photographed illumination and matched relative frame brightness; the deconvolution carries no radiometric calibration, so it is not measured albedo, colour or composition.\n\n### Registration\n\n${REGISTRATION_BLOCK_BEGIN}\n${REGISTRATION_BLOCK_END}\n`;
  const anchor = ['\n## Known problems', '\n[Investigation ledger]', '\n## Coordinates'].find(marker => readme.includes(marker));
  readme = anchor ? readme.replace(anchor, section + anchor) : readme.trimEnd() + '\n' + section;
  await writeFile(readmePath, readme);
}
const pin = async () => {
  const current = await json(manifestPath), documents = requireArray(current.documents).map(value => requireRecord(value));
  for (const path of [`reference/${recordName}`, 'preparation/observer-cameras.json', 'preparation/terrestrial.json', 'preparation/acquisition.json', 'content/object.json']) {
    const bytes = await readFile(resolve(sourceDirectory, path)), entry = documents.find(document => document.path === path);
    if (entry) { entry.expectedBytes = bytes.length; entry.expectedSha256 = sha(bytes); } else documents.push({ path, expectedBytes: bytes.length, expectedSha256: sha(bytes) });
  }
  current.documents = documents; await write(manifestPath, current);
  const object = await json(descriptorPath);
  for (const entry of requireArray(requireRecord(requireRecord(object.properties).recipe).sources).map(value => requireRecord(value))) {
    const bytes = await readFile(resolve(objectDirectory, requireString(entry.path))); entry.sha256 = sha(bytes);
  }
  await write(descriptorPath, object);
};
await write(manifestPath, manifest); await write(descriptorPath, descriptor); await pin();
execFileSync(process.execPath, [resolve(ROOT, 'tools/author-source-records.mts'), objectId], { stdio: 'inherit' });

// 8. The verdict: the lens measured as preparation will measure it, and the ledger entry that states it. The alternative mesh
// keeps the base model's simplification budget unless the simplifier cannot reach the face target within it, in which case
// the budget is raised in halves, up to twice the base, and the recipe states the budget it needed.
let measured: Awaited<ReturnType<typeof measureBody>>[number] | undefined;
for (let factor = 1; factor <= 2 && !measured; factor += 0.5) {
  if (factor > 1) {
    const document = await json(recipePath), alternatives = requireArray(requireRecord(document.geometry).radialTerrainAlternatives ?? []).map(value => requireRecord(value));
    const alternative = alternatives.find(entry => entry.lensId === 'zimpol');
    if (!alternative) throw new Error('The lens mesh could not be simplified within the base budget and has no alternative to widen.');
    requireRecord(alternative.simplification).maximumErrorMeters = Math.round(Number(requireRecord(requireRecord(recipe.geometry).radialTerrain).simplification && requireRecord(requireRecord(requireRecord(recipe.geometry).radialTerrain).simplification).maximumErrorMeters) * factor);
    await write(recipePath, document);
    await pin();
  }
  try { measured = (await measureBody(ROOT, objectId)).find(lens => lens.id === 'zimpol'); }
  catch (error) { if (!/Source mesh reached/.test(String(error)) || factor >= 2) throw error; console.log(`the lens mesh needs a wider simplification budget: ${String((error as Error).message)}`); }
}
if (!measured) throw new Error('The lens was written but did not load.');
const block = registrationBlock({ surfaces: [{ id: 'zimpol', observation: measured.report }] });
console.log(block ?? 'no registration report');
if (block) await writeFile(readmePath, withRegistrationBlock(await readFile(readmePath, 'utf8'), block).readme);
const registration = requireRecord(measured.report.registration), silhouette = requireRecord(registration.silhouette), relief = requireRecord(registration.relief), reference = requireRecord(registration.reference);
const systematic = silhouette.systematicDegrees as number | null, scored = Number(silhouette.scored), reliefMedian = relief.medianOffsetDegrees as number | null, referenceMedian = reference.medianOffsetDegrees as number | null;
const registered = (scored >= 3 && systematic !== null && systematic <= 3) || (reliefMedian !== null && Math.abs(reliefMedian) <= 3) || (referenceMedian !== null && Math.abs(referenceMedian) <= 3);
const ledgerPath = resolve(objectDirectory, 'investigations.json'), ledger = await json(ledgerPath), entries = requireArray(ledger.entries).map(value => requireRecord(value)).filter(entry => entry.id !== 'sphere-photograph-lens');
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
entries.push({ id: 'sphere-photograph-lens', subject: 'VLT/SPHERE/ZIMPOL deconvolved frames as a computed-camera photograph lens', status: registered ? 'included' : 'unresolved',
  finding: `Scaffolded from the survey's ${survey} release: ${frames.length} camera-1 frames (${span}), the ADAM reconstruction and its rotation record read ${order}. Every camera is derived from those pinned inputs and the registration stage measured the lens: silhouette ${scored} scored, RMS ${(silhouette.rmsDegrees as number | null)?.toFixed(2) ?? '—'}°, floor ${(silhouette.noiseFloorDegrees as number | null)?.toFixed(2) ?? '—'}°, systematic ${systematic?.toFixed(2) ?? '—'}°; frames reference decisive on ${String(reference.decisive)} of ${requireArray(reference.frames).length}${referenceMedian !== null ? ` at ${referenceMedian}°` : ''}; relief decisive on ${String(relief.decisive)} of ${requireArray(relief.frames).length}${reliefMedian !== null ? ` at ${reliefMedian}°` : ''}. ${registered ? 'The lens registers within three degrees by at least one measurement and ships.' : 'No measurement places the lens within three degrees, so it is not shipped; the numbers are the README block\'s.'}`,
  ...(registered ? {} : { revisitWhen: 'A registration reference that places these frames within three degrees: a map, resolved markings, or a rotation record and mesh that the silhouette confirms.' }),
  evidence: [`${LAM}/Data/${survey}/Deconv/`, `${LAM}/3Dshape/`], checked: [{ date: new Date().toISOString().slice(0, 10), commit }] });
ledger.entries = entries; await write(ledgerPath, ledger);
if (!registered) {
  // Unwire the lens: every rewritten file goes back, the copied inputs and the derivation record go, and the source records the binding step made go with them.
  for (const [path, bytes] of originals) await writeFile(resolve(objectDirectory, path), bytes);
  const { rm } = await import('node:fs/promises');
  for (const frame of frames) await rm(resolve(sourceDirectory, 'observations', frame.name), { force: true });
  if (!baseIsAdam) await rm(resolve(sourceDirectory, 'shape', meshName), { force: true });
  for (const path of [`reference/${recordName}`, 'reference/horizons-sphere-observer.txt', 'reference/horizons-sphere-heliocentric.txt', 'preparation/observer-cameras.json']) await rm(resolve(sourceDirectory, path), { force: true });
  for (const name of await readdir(resolve(ROOT, 'src/sources'))) if (!recordsBefore.has(name)) await rm(resolve(ROOT, 'src/sources', name), { force: true });
}
console.log(`${objectId}: ${registered ? 'registers; prepare it to ship the lens' : 'does not register; unwired again, ledgered as unresolved'} (silhouette systematic ${systematic?.toFixed(2) ?? '—'}°, relief ${reliefMedian ?? '—'}°, frames ${referenceMedian ?? '—'}°).`);
