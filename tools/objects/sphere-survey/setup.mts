/**
 * Set up a VLT/SPHERE survey body's photograph lens and measure it against the survey's own comparison figure.
 *
 *   node tools/objects/sphere-survey/setup.mts <object-id>    build and measure the lens in output/sphere-survey/<id>/
 *   node tools/objects/sphere-survey/install.mts <object-id>  write a measured setup into the body's package
 *
 * The first form writes nothing in the package. It copies the package's source directory, finds the body's figure in
 * the pinned survey paper, reads the frame time printed over each column, lists the released frames, keeps one
 * apparition's camera-1 frames, fetches what is not already on this machine, decides the spin record's column order
 * from the published pole, writes both Horizons tables, derives every camera and measures the figure through them.
 * The result is `setup.json`, the evidence and its image. Decide on the image; `install.mts` then writes the same records
 * into the package with the lens control, reader text, ledger entries, README sections and credits.
 */
import { constants } from 'node:fs';
import { access, cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '../../../src/platform/sha256.mts';
import { readFitsHdu } from '../../fits/fits.mts';
import { readPdfImage } from '../../fits/pdf-image.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { measurePublishedComparison, writeComparisonEvidence } from '../published-comparison.mts';
import { horizonsCommand, horizonsTables, tableInput } from '../sphere-horizons.mts';
import { COMPARISON_SPEC_FILE, COMPARISON_SPEC_SCHEMA, figureBands, figureCells, parseComparisonSpec, type Raster } from '../surface-observations/published-comparison.mts';
import { OBSERVER_CAMERAS_FILE, OBSERVER_CAMERAS_SCHEMA, deriveObserverCameras, limbSettled, parseObserverCameras, recipeFields, zimpolExposure } from '../terrestrial-layers/observer-cameras.mts';
import { radialTerrainForLens } from '../terrestrial-layers/radial-models.mts';
import { loadCameraShape } from '../terrestrial-layers/shape-camera-mosaic.mts';
import { loadObjShape } from '../terrestrial-layers/obj-shape.mts';
import type { RadialSimplification } from '../terrestrial-layers/radial-meshoptimizer.mts';
import { requireTerrainMesh, simplifyRadialShape } from '../terrestrial-layers/radial-terrain.mts';
import { parseSpinState, spinOrientation } from '../terrestrial-layers/observer-camera.mts';
import { spinRecordReading } from '../terrestrial-layers/spin-record-reading.mts';
import { glyphTemplates, readLabel } from './figure-labels.mts';
import { apparitionLinks, listedViews, meshFaces, releasedFrames } from './apparitions.mts';
import { anchorApparition, apparitions, selectFrames } from './frames.mts';
import { LAM, SURVEY_PAPER_URL, framesUrl, lamBytes, lamText, shapeUrl, spinRecordName, type LamFrame } from './lam.mts';

const ROOT = resolve(import.meta.dirname, '../../..');
export const LENS_ID = 'zimpol';
export const SETUP_SCHEMA = 'cssearth-sphere-survey-setup@1';
const PAPER_PATH = 'reference/vernazza-2021.pdf', SPIN_RECORD_PATH = 'reference/release-parameters.txt', ADAM_METERS_PER_UNIT = 1000;
const HORIZONS = { observer: 'reference/horizons-sphere-observer.txt', heliocentric: 'reference/horizons-sphere-heliocentric.txt' } as const;
/** The survey figures print every panel 240 pixels square, and each photograph panel two lines of text at its top: the frame's time and its phase. */
const PANEL = 240, SURVEY_LABEL_LINES = 2;
/** The one figure whose labels were read by eye and confirmed against frame headers; its glyphs read every other figure. */
const REFERENCE_FIGURE = { objectId: 'iris', object: 1085 } as const;

/** The settings every shipped survey lens uses; `setup.test.mts` keeps them equal to the lenses in the repository. */
export const SURVEY_LENS_SETTINGS = {
  format: 'controlled-shape-camera', consumer: 'sphere-photograph', selection: 'edge-weighted-average',
  levelMatching: { samplesPerTriangle: 24, minimumPairs: 128, maximumGain: 4, maximumAngleDegrees: 60 },
  transfer: { maximumSeparationFootprints: 2, visibilityToleranceMeters: 0.5, maximumEmissionDegrees: 70,
    interpretation: 'Trial acceptance bounds, not estimates of source accuracy. A footprint is the pixel\'s range times its angular size, so a contributor lies within two of those of the closest source-mesh point, and that point must be visible from the stated camera in the full mesh.' },
  photometry: { model: 'retained-observation', referenceIncidenceDegrees: 0, referenceEmissionDegrees: 0, maximumIncidenceDegrees: 70, maximumEmissionDegrees: 70, maximumGain: 1 },
  display: { basis: 'authored', percentiles: [1, 99.5] },
} as const;

interface ReleasedModel { source: string; model: string; pole: [number, number]; spin?: string; shape?: string }
interface SurveyFigure { figure: string; number: number; name: string; page: number; object: number; width: number; height: number; pole: [number, number]; releasedModel?: ReleasedModel }
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8')) as unknown;
const exists = (path: string) => access(path).then(() => true, () => false);
const frameId = (frame: LamFrame) => `${LENS_ID}-${frame.second.slice(0, 10).replaceAll('-', '')}-${frame.second.slice(11).replaceAll(':', '')}`;

/** The survey's released model as an archive states it, where Table A.1 describes another solution than that model. */
function releasedModelOf(value: Record<string, unknown>): ReleasedModel {
  const pole = requireArray(value.pole).map(angle => requireFiniteNumber(angle));
  if (pole.length !== 2 || !(Math.abs(pole[1]) <= 90)) throw new TypeError('A released model states an ecliptic pole.');
  const file = (key: string) => value[key] === undefined ? {} : { [key]: requireString(value[key]) };
  return { source: requireString(value.source), model: requireString(value.model), pole: [pole[0], pole[1]], ...file('spin'), ...file('shape') };
}

export async function surveyFigures() {
  const table = requireRecord(await readJson(resolve(import.meta.dirname, 'vernazza-2021-figures.json')));
  const paper = requireRecord(table.paper);
  return { paper: { source: requireString(paper.source) },
    figures: requireArray(table.figures).map(value => {
      const f = requireRecord(value), pole = requireArray(f.pole).map(angle => requireFiniteNumber(angle));
      if (pole.length !== 2) throw new TypeError(`Figure ${String(f.figure)} states no Table A.1 pole pair.`);
      return { figure: requireString(f.figure), number: requireFiniteNumber(f.number), name: requireString(f.name),
        page: requireFiniteNumber(f.page), object: requireFiniteNumber(f.object), width: requireFiniteNumber(f.width), height: requireFiniteNumber(f.height), pole: [pole[0], pole[1]],
        ...(f.releasedModel === undefined ? {} : { releasedModel: releasedModelOf(requireRecord(f.releasedModel)) }) } satisfies SurveyFigure; }) };
}

/**
 * A file already on this machine: the package's own copy, then the same path in any sibling checkout's package or in the
 * survey downloads a checkout kept.
 */
export async function localCopy(objectId: string, path: string): Promise<Buffer | null> {
  const siblings = (await readdir(dirname(ROOT))).filter(name => name.startsWith('css.earth')).map(name => resolve(dirname(ROOT), name));
  const candidates = [resolve(ROOT, 'src/objects', objectId, 'source', path), ...siblings.flatMap(checkout =>
    [resolve(checkout, 'src/objects', objectId, 'source', path), resolve(checkout, 'output/sphere-survey', objectId, 'downloads', path)])];
  for (const candidate of candidates) {
    const size = await stat(candidate).then(entry => entry.size, () => -1);
    if (size <= 0) continue;
    return readFile(candidate);
  }
  return null;
}

/** The survey paper, from any package or checkout on this machine that holds it, downloaded only when none does. */
async function surveyPaper(objectId: string) {
  const own = await localCopy(objectId, PAPER_PATH);
  if (own) return own;
  for (const directory of await readdir(resolve(ROOT, 'src/objects'))) {
    const bytes = await localCopy(directory, PAPER_PATH);
    if (bytes) return bytes;
  }
  return lamBytes(SURVEY_PAPER_URL);
}

/** A file for the package, from this machine when present, else from its origin, kept in the run's download folder. */
async function fetchOnce(objectId: string, path: string, url: string, downloads: string) {
  const cached = resolve(downloads, path);
  if (await exists(cached)) return readFile(cached);
  const bytes = await localCopy(objectId, path) ?? await lamBytes(url);
  await mkdir(dirname(cached), { recursive: true });
  await writeFile(cached, bytes);
  return bytes;
}

function objCounts(text: string) {
  let vertices = 0, faces = 0;
  for (const line of text.split('\n')) { if (line.startsWith('v ')) vertices++; else if (line.startsWith('f ')) faces++; }
  return { vertices, faces };
}

export async function buildSetup(objectId: string, options: LeaveOuts = {}) {
  const objectDirectory = resolve(ROOT, 'src/objects', objectId), packageSource = resolve(objectDirectory, 'source');
  const work = resolve(ROOT, 'output/sphere-survey', objectId), source = resolve(work, 'source'), downloads = resolve(work, 'downloads');

  // Who the body is in the survey, from the Horizons target its astronomy record already queries.
  const command = horizonsCommand(await readJson(resolve(ROOT, 'packages/astronomy/data/bodies', `${objectId}.json`)));
  const number = Number(command.replace(/;$/u, ''));
  const { paper: paperPin, figures } = await surveyFigures();
  const figure = figures.find(entry => entry.number === number);
  if (!Number.isInteger(number) || !figure) throw new Error(`${objectId} (Horizons '${command}') is not a body of the survey's Appendix B.`);

  // The pole the column order is decided by is the survey's own, as its Table A.1 prints it. A body whose published pole
  // belongs to another solution, a DAMIT model say, carries the survey's in its lens record, beside the rotation it decides.
  // The table prints Thisbe's past the pole, latitude 116°: the direction (λ + 180°, 180° − β), which the obliquity it
  // prints confirms, so it is folded; a record describing another solution is still refused below.
  const [printedLongitude, printedLatitude] = figure.pole;
  const surveyPole = Math.abs(printedLatitude) <= 90 ? { longitudeDegrees: printedLongitude, latitudeDegrees: printedLatitude }
    : { longitudeDegrees: (printedLongitude + 180) % 360, latitudeDegrees: Math.sign(printedLatitude) * 180 - printedLatitude };
  const properties = requireRecord(await readJson(resolve(packageSource, 'reference/model-properties.json')).catch(() => ({})));
  const ownPole = properties.source === paperPin.source;

  // The figure and its column labels.
  const paper = await surveyPaper(objectId);
  const image = readPdfImage(paper, figure.object);
  if (image.width !== figure.width || image.height !== figure.height) throw new Error(`Object ${figure.object} is ${image.width}×${image.height}, not Figure ${figure.figure}.`);
  const bands = figureBands(image);
  if (bands.some(band => band.y1 - band.y0 > 3 * PANEL + PANEL / 2)) throw new Error(`Figure ${figure.figure} uses a layout other than the survey's rows of ${PANEL}-pixel panels.`);
  const rows = Math.round((bands[0].y1 - bands[0].y0) / PANEL);
  const reference = parseComparisonSpec(await readJson(resolve(ROOT, 'src/objects', REFERENCE_FIGURE.objectId, 'source', COMPARISON_SPEC_FILE)));
  if (reference.document.object !== REFERENCE_FIGURE.object) throw new Error('The reference figure moved; update REFERENCE_FIGURE.');
  const referenceImage: Raster = readPdfImage(paper, reference.document.object);
  const templates = glyphTemplates(referenceImage, figureCells(referenceImage, reference.rows.count, reference.columns.length)[0], reference.columns.map(column => column.label));
  const labels = bands.flatMap((band, index) => figureCells(image, rows, Math.round((band.x1 - band.x0) / PANEL), index)[0].map(cell => ({ label: readLabel(image, cell, templates), band: index })));

  // The released frames and the ones the figure shows.
  const listing = await releasedFrames(framesUrl(number, figure.name), downloads);
  const shown = labels.map(({ label }) => listing.find(frame => frame.second === label) ?? null);
  // Frames left out by name, each for a reason the install records; never one the figure shows.
  const leaveOut = [...(options.leaveOut ?? [])];
  for (const id of leaveOut) {
    if (!listing.some(frame => frameId(frame) === id)) throw new Error(`${id} is not a released camera-1 frame of ${figure.name}.`);
    if (shown.some(frame => frame !== null && frameId(frame) === id)) throw new Error(`Figure ${figure.figure} shows ${id}; a frame the comparison reads cannot be left out.`);
  }
  // Whole apparitions left out by the date of their first night, each for a reason the install records: the pixels can
  // refuse a link the geometry predicted (Daphne's 2017 frames). Their columns then show no lens frame, like any apparition
  // the lens does not cast.
  const leftApparitions = apparitions(listing).filter(members => (options.leaveOutApparitions ?? []).includes(members[0].second.slice(0, 10)));
  for (const date of options.leaveOutApparitions ?? []) if (!leftApparitions.some(members => members[0].second.startsWith(date))) throw new Error(`No apparition of ${figure.name} starts on ${date}.`);
  const leftFrames = new Set(leftApparitions.flat());
  const candidates = listing.filter(frame => !leaveOut.includes(frameId(frame)) && !leftFrames.has(frame)), shownFrames = shown.filter((frame): frame is LamFrame => frame !== null && !leftFrames.has(frame));

  // A fresh copy of the package's source directory, without any earlier lens of this id, to build the lens in.
  await rm(source, { recursive: true, force: true });
  await cp(packageSource, source, { recursive: true, mode: constants.COPYFILE_FICLONE });
  const recipe = requireRecord(await readJson(resolve(source, 'preparation/terrestrial.json')));
  const raster = requireRecord(recipe.raster), geometry = requireRecord(recipe.geometry);
  const existing = Array.isArray(raster.surfaceObservations) ? raster.surfaceObservations.map(value => requireRecord(value)) : [];
  const earlierLens = existing.find(lens => lens.id === LENS_ID);
  raster.surfaceObservations = existing.filter(lens => lens.id !== LENS_ID);
  geometry.radialTerrainAlternatives = (Array.isArray(geometry.radialTerrainAlternatives) ? geometry.radialTerrainAlternatives.map(value => requireRecord(value)) : []).filter(entry => entry.lensId !== LENS_ID);

  // Files: the ADAM mesh, the spin record and the paper, each from this machine when present; the frames once they are chosen.
  const written: string[] = [];
  const put = async (path: string, bytes: Buffer | string) => { await mkdir(dirname(resolve(source, path)), { recursive: true }); await writeFile(resolve(source, path), bytes); if (!written.includes(path)) written.push(path); };
  // A release without an ADAM mesh for the body leaves the lens on the primary mesh, the release's MPCD: Themis's
  // 3Dshape directory answers 404 for it.
  // Where LAM withholds a body's own ADAM mesh and rotation record (Flora), the survey model's archive copy supplies both.
  const withheld = figure.releasedModel?.spin !== undefined && figure.releasedModel.shape !== undefined
    ? { ...figure.releasedModel, spin: figure.releasedModel.spin, shape: figure.releasedModel.shape } : undefined;
  const archiveSlug = withheld ? withheld.model.toLowerCase().replace(/[^a-z0-9]+/gu, '-') : '';
  const adamPath = withheld ? `shape/${archiveSlug}-shape.obj` : `shape/${number}_${figure.name}_adam.obj`, adamUrl = withheld ? withheld.shape : shapeUrl(number, figure.name, 'adam');
  const adam = await fetchOnce(objectId, adamPath, adamUrl, downloads).catch((error: unknown) => {
    if (error instanceof Error && error.message.startsWith('LAM answered 404 ')) return null;
    throw error;
  });
  if (adam) await put(adamPath, adam);
  const recordName = withheld ? `${archiveSlug}-spin.txt` : spinRecordName(await lamText(`${LAM}/3Dshape/`), number, figure.name);
  const spinRecordUrl = withheld ? withheld.spin : `${LAM}/3Dshape/${recordName}`;
  // A package that already keeps the release's record under its archive name reads that copy rather than adding a second.
  const spinRecordPath = withheld || await exists(resolve(packageSource, `reference/${recordName}`)) ? `reference/${recordName}` : SPIN_RECORD_PATH;
  const spinRecord = await exists(resolve(packageSource, spinRecordPath)) ? await readFile(resolve(packageSource, spinRecordPath)) : await fetchOnce(objectId, spinRecordPath, spinRecordUrl, downloads);
  await put(spinRecordPath, spinRecord);
  if (!await exists(resolve(packageSource, PAPER_PATH))) await put(PAPER_PATH, paper);

  // The column order the survey's pole supports.
  // Where Table A.1 describes another solution than the survey's released model (Eleonora, Thisbe), the released model's
  // pole as the archive's copy of it states decides the reading; the figure then decides whether the lens ships.
  const released = figure.releasedModel, readingPole = released ? { longitudeDegrees: released.pole[0], latitudeDegrees: released.pole[1] } : surveyPole;
  const reading = spinRecordReading(spinRecord.toString('utf8'), readingPole);

  // The lens mesh: the ADAM mesh as the lens's own model where the primary is another.
  // A body whose own shape is already the release's ADAM mesh (Adeona, which has no MPCD) needs no second copy of it.
  const primaryIsAdam = requireRecord(geometry.radialTerrain).path === adamPath;
  if (adam && !primaryIsAdam) {
    const counts = objCounts(adam.toString('utf8')), primary = requireRecord(geometry.radialTerrain);
    // The release's ADAM meshes are Wavefront OBJ files in kilometres, whatever format the primary mesh came in (a DAMIT
    // plate model, say); the rest of the primary's settings carry over.
    const adamGrid = { metersPerUnit: ADAM_METERS_PER_UNIT, expectedVertices: counts.vertices, expectedFaces: counts.faces };
    const alternative = { lensId: LENS_ID, ...primary, path: adamPath, format: 'wavefront-obj', grid: adamGrid,
      ...(primary.simplification === undefined ? {} : { simplification: await adamSimplification(requireRecord(primary.simplification), resolve(source, adamPath), adamGrid, counts, Number(primary.faceBudget), Number(geometry.radius) / (Number(geometry.radiusKm) * 1000)) }) };
    requireArray(geometry.radialTerrainAlternatives).push(alternative);
  }
  const lensTerrain = radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], LENS_ID);
  const mesh = await loadCameraShape(source, lensTerrain);

  // The apparitions the lens casts: the figure's, and every other its level fit can reach through shared surface.
  const { apparitions: byApparition, anchor } = anchorApparition(candidates, shownFrames);
  const apparitionOf = (frame: LamFrame) => byApparition.findIndex(members => members.includes(frame));
  const views = await listedViews(candidates, spinOrientation(parseSpinState(spinRecord.toString('utf8'), reading.order)), command, downloads);
  const { levelMatching } = SURVEY_LENS_SETTINGS;
  const links = apparitionLinks(meshFaces(mesh), mesh, candidates.map((frame, index) => ({ apparition: apparitionOf(frame), view: views[index] })), anchor,
    { gateDegrees: levelMatching.maximumAngleDegrees, minimumPairs: levelMatching.minimumPairs, displaySamples: requireFiniteNumber(requireRecord(lensTerrain).faceBudget) * levelMatching.samplesPerTriangle });
  const selected = selectFrames(candidates.filter(frame => links[apparitionOf(frame)].cast), shownFrames);
  const columns = labels.map(({ label, band }, index) => ({ label, frame: shown[index] && selected.includes(shown[index]) ? frameId(shown[index]) : null, band }));
  if (!columns.some(column => column.frame)) throw new Error(`None of Figure ${figure.figure}'s columns shows a released camera-1 frame.`);
  const frames = [];
  for (const frame of selected) {
    const path = `observations/${frame.file}`, bytes = await fetchOnce(objectId, path, frame.url, downloads);
    await put(path, bytes);
    frames.push({ frame, id: frameId(frame), path, bytes, exposure: zimpolExposure(readFitsHdu(bytes).header) });
  }

  // Both Horizons tables for exactly these exposures, kept with the downloads so a rerun asks Horizons once.
  const cachedTables = resolve(downloads, 'horizons.json'), starts = frames.map(entry => entry.exposure.startJd);
  const cache = await readJson(cachedTables).then(value => requireRecord(value), () => null);
  const tables = cache && JSON.stringify(cache.starts) === JSON.stringify(starts) ? { observer: requireString(cache.observer), heliocentric: requireString(cache.heliocentric) }
    : await horizonsTables(command, starts);
  await mkdir(downloads, { recursive: true });
  await writeFile(cachedTables, JSON.stringify({ starts, ...tables }));
  await put(HORIZONS.observer, tables.observer); await put(HORIZONS.heliocentric, tables.heliocentric);

  // The records: the observer cameras, the figure and the lens itself.
  const record = { schema: OBSERVER_CAMERAS_SCHEMA, lensId: LENS_ID, rotation: { kind: 'spin-record', path: spinRecordPath, columnOrder: reading.order,
    ...(released ? { publishedPole: { source: released.source, table: released.model, eclipticJ2000Degrees: released.pole } }
      : ownPole ? {} : { publishedPole: { source: paperPin.source, table: 'Table A.1', eclipticJ2000Degrees: [surveyPole.longitudeDegrees, surveyPole.latitudeDegrees] } }) },
    ephemeris: HORIZONS, epoch: 'exposure-midpoint', centre: { method: 'limb', edgeFraction: 0.25 } };
  await put(OBSERVER_CAMERAS_FILE, JSON.stringify(record, null, 2) + '\n');
  const manifest = requireRecord(await readJson(resolve(source, 'manifest.json')));
  const paperInput = requireArray(manifest.inputs).map(value => requireRecord(value)).find(input => input.path === PAPER_PATH);
  const spec = { schema: COMPARISON_SPEC_SCHEMA, lensId: LENS_ID, source: paperPin.source, figure: `Figure ${figure.figure}`,
    document: { input: paperInput ? requireString(paperInput.id) : `${objectId}-survey-research`, object: figure.object, width: image.width, height: image.height, sha256: sha256(image.data) },
    rows: { image: 0, model: rows - 1, count: rows, labelLines: SURVEY_LABEL_LINES }, columns };
  await put(COMPARISON_SPEC_FILE, JSON.stringify(spec, null, 2) + '\n');
  const cameras = await deriveObserverCameras(source, parseObserverCameras(record), frames, mesh, ROOT);
  // The recipe states each frame's limb-fitted centre, so a fit that has not settled cannot be stated.
  const unsettled = cameras.filter(camera => !limbSettled(camera.limb));
  if (unsettled.length > 0) throw new Error(`The limb fit does not settle on ${unsettled.map(camera => `${camera.id} (last move ${camera.limb.movedPixels.toFixed(2)} px)`).join(', ')}; leave those frames out with --leave-out and say why.`);
  const nights = [...new Set(frames.map(entry => entry.frame.second.slice(0, 10)))], cast = links.filter(link => link.cast).length;
  const lens = { id: LENS_ID, format: SURVEY_LENS_SETTINGS.format, consumer: SURVEY_LENS_SETTINGS.consumer,
    metadata: { label: 'SPHERE photograph', falseColor: false, coverage: lensCoverage(frames.length, nights, figure.figure, cast) },
    selection: SURVEY_LENS_SETTINGS.selection, levelMatching: SURVEY_LENS_SETTINGS.levelMatching, transfer: SURVEY_LENS_SETTINGS.transfer,
    photometry: SURVEY_LENS_SETTINGS.photometry, display: SURVEY_LENS_SETTINGS.display,
    frames: cameras.map(camera => ({ id: camera.id, path: camera.path, encoding: 'fits-zimpol-intensity', ...recipeFields(camera) })) };
  requireArray(raster.surfaceObservations).push(lens);
  await put('preparation/terrestrial.json', JSON.stringify(recipe, null, 2) + '\n');

  // The manifest: every new file declared, so the scratch copy measures exactly what the package would hold.
  const inputs = requireArray(manifest.inputs).map(value => requireRecord(value)), documents = requireArray(manifest.documents).map(value => requireRecord(value));
  const setInput = (entry: Record<string, unknown>) => { const at = inputs.findIndex(input => input.path === entry.path); if (at >= 0) inputs[at] = { ...inputs[at], ...entry }; else inputs.push(entry); };
  for (const entry of frames) setInput(frameInput(objectId, entry.frame, entry.bytes));
  if (adam && !primaryIsAdam) setInput(adamInput(objectId, number, figure.name, adamPath, adam, withheld));
  setInput({ ...tableInput(objectId, 'observer', HORIZONS.observer, Buffer.from(tables.observer)) });
  setInput({ ...tableInput(objectId, 'heliocentric', HORIZONS.heliocentric, Buffer.from(tables.heliocentric)) });
  if (!paperInput) setInput(paperInputFor(objectId, paper));
  for (const path of [OBSERVER_CAMERAS_FILE, COMPARISON_SPEC_FILE, spinRecordPath, 'preparation/terrestrial.json']) {
    // A record the package already pins as a downloaded input stays an input; a manifest names each path once.
    if (inputs.some(input => input.path === path)) continue;
    if (!documents.some(document => document.path === path)) documents.push({ path });
  }
  manifest.inputs = inputs; manifest.documents = documents;
  await put('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  // The measurement, through the same cameras the recipe states.
  const result = await measurePublishedComparison(objectId, { sourceDirectory: source });
  await writeComparisonEvidence(result, resolve(work, 'evidence'));
  const setup = { schema: SETUP_SCHEMA, objectId, survey: { number, name: figure.name, figure: figure.figure, command }, lensId: LENS_ID,
    listing: framesUrl(number, figure.name), spinRecordUrl, cast: { nights, frames: frames.length, released: listing.length },
    apparitions: byApparition.map((members, index) => {
      const latitudes = candidates.flatMap((frame, at) => apparitionOf(frame) === index ? [views[at].latitude] : []);
      return { from: members[0].second.slice(0, 10), to: members.at(-1)!.second.slice(0, 10), frames: members.length, cast: members.filter(frame => selected.includes(frame)).length,
        anchor: index === anchor, sharedSamples: links[index].sharedSamples, subObserverLatitude: [Math.min(...latitudes), Math.max(...latitudes)].map(value => Number(value.toFixed(1))) };
    }),
    leftOutApparitions: leftApparitions.map(members => ({ from: members[0].second.slice(0, 10), to: members.at(-1)!.second.slice(0, 10), frames: members.length })),
    leftOut: leaveOut, lensMesh: adam && !primaryIsAdam ? 'adam' : 'primary', primaryIsAdam, releasedModel: released ?? null, tablePole: figure.pole,
    sources: { mesh: adam ? { label: withheld ? `ADAM reconstruction, as ${withheld.model} distributes it` : 'ADAM reconstruction', url: adamUrl } : null,
      rotation: { label: withheld ? `Rotation state, as ${withheld.model} states it` : 'Release rotation record', url: spinRecordUrl } },
    labels: columns, columnOrder: { order: reading.order, separationDegrees: Number(reading.separationDegrees.toFixed(2)), otherSeparationDegrees: reading.otherSeparationDegrees === null ? null : Number(reading.otherSeparationDegrees.toFixed(2)) },
    written: written.sort(), earlierLens: earlierLens ? compareEarlierLens(earlierLens, lens) : null, evidence: result.evidence };
  await writeFile(resolve(work, 'setup.json'), JSON.stringify(setup, null, 2) + '\n');
  return setup;
}

export interface LeaveOuts { leaveOut?: readonly string[]; leaveOutApparitions?: readonly string[] }
/**
 * Frame ids from `--leave-out=a,b` and apparitions from `--leave-out-apparition=YYYY-MM-DD,…` (the date of each one's
 * first night), each flag at most once; empty lists without them, or null for any other argument.
 */
export function leaveOutArguments(args: readonly string[]): { leaveOut: string[]; leaveOutApparitions: string[] } | null {
  const read = (flag: string) => { const found = args.filter(arg => arg.startsWith(flag)); return found.length > 1 ? null : found.length ? found[0].slice(flag.length).split(',').filter(value => value.length > 0) : []; };
  const leaveOut = read('--leave-out='), leaveOutApparitions = read('--leave-out-apparition=');
  if (leaveOut === null || leaveOutApparitions === null || args.some(arg => !arg.startsWith('--leave-out=') && !arg.startsWith('--leave-out-apparition='))) return null;
  if (leaveOutApparitions.some(date => !/^\d{4}-\d{2}-\d{2}$/u.test(date))) return null;
  return { leaveOut, leaveOutApparitions };
}

/**
 * The ADAM mesh is simplified to the primary mesh's face target. Its error bound is the primary's wherever that reaches
 * the target, as it does for Iris and Hebe; otherwise it is the next hundred metres above the error the ADAM mesh
 * reaches there, the rule the primary bounds were authored by.
 */
export async function adamSimplification(primary: Record<string, unknown>, path: string, grid: Record<string, unknown>, counts: { vertices: number; faces: number }, faceBudget: number, scale: number) {
  const simplification = { ...primary } as unknown as RadialSimplification;
  if (primary.method !== 'source-meshoptimizer') return simplification;
  const mesh = requireTerrainMesh(await loadObjShape(path, { ...grid, expectedVertices: counts.vertices, expectedFaces: counts.faces }));
  const probe = await simplifyRadialShape(mesh, { faceBudget, simplification: { ...simplification, maximumErrorMeters: 1e9 } }, scale);
  const reached = requireFiniteNumber(requireRecord(probe.simplification).estimatedErrorMeters, 'estimated error');
  if (reached > simplification.maximumErrorMeters) simplification.maximumErrorMeters = Math.ceil(reached / 100) * 100;
  return simplification;
}

/** How a rebuilt lens compares with the one the package already has: its frames and every camera field. */
function compareEarlierLens(earlier: Record<string, unknown>, rebuilt: { frames: Record<string, unknown>[] }) {
  const before = requireArray(earlier.frames).map(value => requireRecord(value));
  const sameFrames = JSON.stringify(before.map(frame => frame.path)) === JSON.stringify(rebuilt.frames.map(frame => frame.path));
  const differing = sameFrames ? rebuilt.frames.filter((frame, index) => JSON.stringify(frame) !== JSON.stringify(before[index])).map(frame => frame.id) : [];
  return { frames: before.length, sameFrames, camerasDiffering: differing };
}

function lensCoverage(frames: number, nights: readonly string[], figure: string, apparitions: number) {
  const over = nights.length === 1 ? `on ${nights[0]}` : `over ${nights.length} nights${apparitions > 1 ? ` in ${apparitions} apparitions` : ''} from ${nights[0]} to ${nights.at(-1)}`;
  const levels = `matched relative frame brightness,${apparitions > 1 ? ' each apparition placed through the surface it shares with another,' : ''} averaged where frames overlap with each fading out toward its disc edge,`;
  return `${frames} deconvolved VLT/SPHERE/ZIMPOL frames, camera 1, ${over}, cast onto the ADAM reconstruction the survey released with its rotation record. The camera’s pointing and orientation are computed from that record, JPL Horizons geometry and each frame’s header; the exposure epoch is the midpoint of each frame’s stated exposure, the disc centre is fitted to the limb of the lens mesh, and the sky threshold is one stated fraction of the frame’s peak. With these cameras the mesh reproduces Vernazza et al. (2021) Figure ${figure}. Grayscale retains photographed illumination and ${levels} not measured albedo. The grid marks unphotographed, grazing or rejected surface.`;
}

const SURVEY_CREDIT = 'P. Vernazza, M. Ferrais, L. Jorda et al.; ESO/VLT/SPHERE; LAM asteroid survey';
const surveyCapture = { attributions: [{ kind: 'facility', facilityId: 'vlt-ut3', missionId: 'eso-sphere-asteroid-survey', evidence: `The preserved credit for this input reads: ${SURVEY_CREDIT}` }] };
const surveyTerms = { license: 'Public scientific release from the source-author site accompanying CC-BY-4.0 research; retain credit and citations.',
  acquisition: 'Restored through source/preparation/acquisition.json. Its ordinary public-site cookie is included in the request headers.',
  redistribution: 'Attributed scientific display derivatives; see NOTICE.md.' };

function frameInput(objectId: string, frame: LamFrame, bytes: Buffer) {
  const { width, height } = readFitsImageSize(bytes);
  return { id: `${objectId}-sphere-${frame.second.replace(/\D/gu, '')}`, path: `observations/${frame.file}`, origin: frame.url, credit: SURVEY_CREDIT, capture: surveyCapture, ...surveyTerms,
    consumers: ['sphere-photograph'], width, height, lensId: LENS_ID, label: 'Deconvolved ZIMPOL frame',
    coverage: 'Deconvolved VLT/SPHERE/ZIMPOL intensity frame, camera 1. Derived from the ESO pipeline product named in its own header; the deconvolution is the survey’s and is not described in the file.' };
}
function adamInput(objectId: string, number: number, name: string, path: string, bytes: Buffer, archive?: { model: string; shape: string }) {
  return { id: `${objectId}-adam-shape`, path, origin: archive?.shape ?? shapeUrl(number, name, 'adam'),
    credit: archive ? `${SURVEY_CREDIT}; distributed as ${archive.model} by DAMIT, Astronomical Institute of Charles University` : SURVEY_CREDIT,
    capture: surveyCapture, ...(archive ? damitTerms : surveyTerms), consumers: ['adam-terrain'],
    projection: { kind: 'body-fixed-cartesian-triangular-mesh', longitudeDirection: 'east', latitudeType: 'planetocentric', units: 'kilometers' },
    coverage: archive
      ? `ADAM reconstruction from the same survey, as ${archive.model} distributes it: LAM withholds the release’s own file for this body. The survey’s comparison figure shows it beside the frames, so the photographic lens is registered to this mesh.`
      : 'ADAM reconstruction from the same survey. The release’s rotation record describes this frame, and the survey’s comparison figure shows it beside the frames, so the photographic lens is registered to this mesh.' };
}
const damitTerms = { license: 'CC-BY-4.0; DAMIT site license, retained with author and model attribution.', acquisition: 'Restored through source/preparation/acquisition.json.',
  redistribution: 'CC-BY-4.0 with author/model attribution; see NOTICE.md.' };
function paperInputFor(objectId: string, bytes: Buffer) {
  return { id: `${objectId}-survey-research`, path: PAPER_PATH, origin: SURVEY_PAPER_URL, credit: 'P. Vernazza et al. (2021), Astronomy & Astrophysics 654, A56', ...surveyTerms,
    license: 'CC-BY-4.0 research article; retain the citation.', consumers: ['physical', 'rotation'] };
}
function readFitsImageSize(bytes: Buffer) {
  const { header } = readFitsHdu(bytes);
  return { width: requireFiniteNumber(header.NAXIS1, 'NAXIS1'), height: requireFiniteNumber(header.NAXIS2, 'NAXIS2') };
}

function summary(setup: Awaited<ReturnType<typeof buildSetup>>) {
  const lines = [`${setup.objectId}: (${setup.survey.number}) ${setup.survey.name}, Figure ${setup.survey.figure}; ${setup.cast.frames} of ${setup.cast.released} released camera-1 frames, ${setup.cast.nights.join(', ')}.`,
    ...setup.apparitions.map(entry => `  apparition ${entry.from} to ${entry.to}: ${entry.cast} of ${entry.frames} frames cast, sub-observer latitude ${entry.subObserverLatitude.join(' to ')}°; ${entry.anchor ? 'the figure\'s' : `${entry.sharedSamples} display samples shared with a cast frame at the level fit's angle limit`}`),
    `Spin record read ${setup.columnOrder.order}: ${setup.columnOrder.separationDegrees}° from the published pole, the other reading ${setup.columnOrder.otherSeparationDegrees ?? '—'}°.`,
    ...setup.labels.map(column => `  column ${column.label}${column.band ? ` (band ${column.band})` : ''}: ${column.frame ?? 'no lens frame'}`)];
  for (const column of setup.evidence.columns) lines.push(`  ${column.label}  model ${column.overlapWithModel}, photograph ${column.overlapWithPhotograph}, same shape ${column.sameShapeOverlap}; best turn ${column.bestTurnDegrees}°; axis ${column.axis.oursDegrees}° against ${column.axis.paperDegrees}°`);
  lines.push(`  native outline ${setup.evidence.nativeOutline.residualPixelsAtZero} px over ${setup.evidence.nativeOutline.frames} frames, smallest at ${setup.evidence.nativeOutline.bestOffsetDegrees}°`);
  if (setup.leftOut.length) lines.push(`  left out by name: ${setup.leftOut.join(', ')}`);
  for (const entry of setup.leftOutApparitions) lines.push(`  apparition left out by name: ${entry.from} to ${entry.to}, ${entry.frames} frames`);
  if (setup.primaryIsAdam) lines.push('  the body’s own shape is the release’s ADAM mesh; the lens rides it');
  else if (setup.lensMesh === 'primary') lines.push('  the release has no ADAM mesh for this body; the lens rides the primary mesh');
  if (setup.earlierLens) lines.push(`  the package's lens: ${setup.earlierLens.frames} frames, ${setup.earlierLens.sameFrames ? 'the same' : 'different'} frames, cameras differing: ${setup.earlierLens.camerasDiffering.length ? setup.earlierLens.camerasDiffering.join(', ') : 'none'}`);
  lines.push(`Evidence: ${relative(ROOT, resolve(ROOT, 'output/sphere-survey', setup.objectId, 'evidence/published-comparison.webp'))}`);
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [objectId, ...rest] = process.argv.slice(2), leaveOuts = leaveOutArguments(rest);
  if (!objectId || leaveOuts === null) { console.error('usage: node tools/objects/sphere-survey/setup.mts <object-id> [--leave-out=<frame-id>,…] [--leave-out-apparition=<first night>,…]'); process.exit(2); }
  console.log(summary(await buildSetup(objectId, leaveOuts)));
}
