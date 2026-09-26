/**
 * Author a DAMIT asteroid package from one archived model (convex, or nonconvex with `model.nonconvex` and `model.basis`)
 * and a separately published physical size.
 *
 *   node tools/objects/source-authoring/damit-asteroids/author.mts [--inputs=<path>] [--object=<id>]
 *
 * Every value that is not measured from the downloaded files comes from `inputs.json`, where each carries its source.
 * The tool downloads the pinned DAMIT shape and spin files, the JPL records and, for a NEOWISE scale, the IRSA row; it
 * measures the mesh (signed volume, closure, extents, radial range), converts the ecliptic pole to the equatorial one,
 * and writes the package in the layout of the existing DAMIT bodies (Achilles, Ajax). It then renders the marker
 * snapshot and writes the source manifest. The astronomy record is written without elements; run
 * `node packages/astronomy/tools/generate-asteroids.mts --object=<ids>` next, then `node tools/prepare/cli/prepare-object.mts <id>`.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import sharp from 'sharp';
import { createSourceManifest } from '../../../../src/platform/source-manifest.mts';
import { ENTRY_EVIDENCE } from '../../../sources/author-source-records.mts';
import { shapeMaterialRaster } from '../../terrestrial-layers/shape-material.mts';
import { elementsUrl, vectorsUrl } from '../../../../packages/astronomy/tools/lib/horizons.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { loadPdsPlateShape } from '../../terrestrial-layers/obj-shape.mts';
import { loadRadialTerrain } from '../../terrestrial-layers/radial-terrain.mts';
import { requireTerrainMesh, simplifyRadialShape } from '../../terrestrial-layers/radial-mesh.mts';
import { renderRadialSnapshot } from '../../terrestrial-layers/radial-snapshot.mts';

const ROOT = resolve(import.meta.dirname, '../../../..');
if (process.cwd() !== ROOT) throw new Error('Run from the repository root.');
const TEMPLATE = 'achilles';
const EPOCH_JD = 2461286.5, AU_KM = 149597870.7, OBLIQUITY_DEGREES = 23.439291111;
const DAMIT = 'https://damit.cuni.cz/projects/damit';
const PALETTE = ['#35306b', '#2c7db7', '#51b5ab', '#c5d879', '#f3c56b', '#c76138', '#f8eee1'];

interface Reference { id: number; label: string; title: string }
interface Paper { url: string; label: string; locator: string; quote: string; catalogueId: string; kind: string; credit: string; identifier?: { type: string; value: string } }
interface RecordSource { catalogueId: string; kind: string; title: string; credit: string; identifier?: { type: string; value: string } }
interface Body {
  id: string; name: string; number: number;
  model: { id: number; version: string; shapeFile: number; spinFile?: number; lambda: number; beta: number; periodHours: number; yorpRadPerDay2?: number; comment?: string; references: Reference[];
    /** Nonconvex models name the data they were fitted to, e.g. "light curves, Keck adaptive-optics images and stellar occultations". */
    nonconvex: boolean; basis?: string; spinFileName?: string; note?: string };
  alternatives: { id: number; lambda: number; beta: number; periodHours: number; diameterKm?: number; uncertaintyKm?: number }[];
  calibration: { method: string; diameterKm: number; uncertaintyKm: number; quantity: string; reference: string; referenceUrl: string; notes: string; visibleDescription: string; neowiseReference?: string; catalogueId: string; record?: RecordSource };
  occultation?: { file: number; name: string };
  checked?: string;
  /** Simplification error allowance as a fraction of the radius; 0.02 unless a shape needs more to reach the face budget. */
  maximumErrorFraction: number;
  text: { card: string; cardSources: string[]; introduction: string; introductionSources: string[]; shapeSummary: string };
  papers: Record<string, Paper>;
}

const args = process.argv.slice(2);
const inputsPath = args.find(arg => arg.startsWith('--inputs='))?.slice(9) ?? 'tools/objects/source-authoring/damit-asteroids/inputs.json';
const only = args.find(arg => arg.startsWith('--object='))?.slice(9);
const inputs = requireRecord(JSON.parse(await readFile(inputsPath, 'utf8')));
/** The date the current body's sources were checked: its own `checked`, else the table's. */
let checked = requireString(inputs.checked);
const bodies = requireArray(inputs.bodies).map(value => parseBody(requireRecord(value))).filter(body => !only || body.id === only);
if (only && !bodies.length) throw new Error(`No input for ${only}.`);

function parseBody(raw: Record<string, unknown>): Body {
  const id = requireString(raw.id);
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError(`Invalid id ${id}.`);
  const model = requireRecord(raw.model), calibration = requireRecord(raw.calibration), text = requireRecord(raw.text);
  const papers = Object.fromEntries(Object.entries(requireRecord(raw.papers)).map(([key, value]) => {
    const paper = requireRecord(value);
    return [key, { url: requireString(paper.url), label: requireString(paper.label), locator: requireString(paper.locator), quote: requireString(paper.quote),
      catalogueId: requireString(paper.catalogueId), kind: requireString(paper.kind), credit: requireString(paper.credit), identifier: parseIdentifier(paper.identifier) }];
  }));
  const record = calibration.record === undefined ? undefined : requireRecord(calibration.record);
  const optionalNumber = (value: unknown) => value === undefined ? undefined : requireFiniteNumber(value);
  const body: Body = {
    id, name: requireString(raw.name), number: requireFiniteNumber(raw.number), checked: raw.checked === undefined ? undefined : requireString(raw.checked),
    maximumErrorFraction: raw.maximumErrorFraction === undefined ? 0.02 : requireFiniteNumber(raw.maximumErrorFraction),
    model: { id: requireFiniteNumber(model.id), version: requireString(model.version), shapeFile: requireFiniteNumber(model.shapeFile), spinFile: optionalNumber(model.spinFile),
      lambda: requireFiniteNumber(model.lambda), beta: requireFiniteNumber(model.beta), periodHours: requireFiniteNumber(model.periodHours), yorpRadPerDay2: optionalNumber(model.yorpRadPerDay2),
      comment: model.comment === undefined ? undefined : requireString(model.comment),
      nonconvex: model.nonconvex === true, basis: model.basis === undefined ? undefined : requireString(model.basis),
      spinFileName: model.spinFileName === undefined ? undefined : requireString(model.spinFileName),
      note: model.note === undefined ? undefined : requireString(model.note),
      references: requireArray(model.references).map(value => { const r = requireRecord(value); return { id: requireFiniteNumber(r.id), label: requireString(r.label), title: requireString(r.title) }; }) },
    alternatives: requireArray(raw.alternatives).map(value => { const a = requireRecord(value); return { id: requireFiniteNumber(a.id), lambda: requireFiniteNumber(a.lambda), beta: requireFiniteNumber(a.beta),
      periodHours: requireFiniteNumber(a.periodHours), diameterKm: optionalNumber(a.diameterKm), uncertaintyKm: optionalNumber(a.uncertaintyKm) }; }),
    calibration: { method: requireString(calibration.method), diameterKm: requireFiniteNumber(calibration.diameterKm), uncertaintyKm: requireFiniteNumber(calibration.uncertaintyKm),
      quantity: requireString(calibration.quantity), reference: requireString(calibration.reference), referenceUrl: requireString(calibration.referenceUrl), notes: requireString(calibration.notes),
      visibleDescription: requireString(calibration.visibleDescription), neowiseReference: calibration.neowiseReference === undefined ? undefined : requireString(calibration.neowiseReference),
      catalogueId: requireString(calibration.catalogueId), record: record && { catalogueId: requireString(record.catalogueId), kind: requireString(record.kind), title: requireString(record.title),
        credit: requireString(record.credit), identifier: parseIdentifier(record.identifier) } },
    occultation: raw.occultation === undefined ? undefined : (() => { const o = requireRecord(raw.occultation); return { file: requireFiniteNumber(o.file), name: requireString(o.name) }; })(),
    text: { card: requireString(text.card), cardSources: requireArray(text.cardSources).map(v => requireString(v)), introduction: requireString(text.introduction),
      introductionSources: requireArray(text.introductionSources).map(v => requireString(v)), shapeSummary: requireString(text.shapeSummary) },
    papers,
  };
  if (body.model.nonconvex !== (body.model.basis !== undefined)) throw new TypeError(`${id}: a nonconvex model names its basis, and only a nonconvex one.`);
  for (const key of [...body.text.cardSources, ...body.text.introductionSources]) if (key !== 'sbdb' && !papers[key]) throw new TypeError(`${id}: unknown source ${key}.`);
  return body;
}

function parseIdentifier(value: unknown) {
  if (value === undefined) return undefined;
  const identifier = requireRecord(value);
  return { type: requireString(identifier.type), value: requireString(identifier.value) };
}

/** Write a catalogue record for a cited work that has none yet; its evidence names the citing file and locator. */
async function ensureRecord(source: RecordSource & { url: string; label: string }, citingPath: string, locator: string) {
  const path = resolve('src/sources', `${source.catalogueId}.json`);
  if (await readFile(path).catch(() => null)) return;
  await write(path, json({ id: source.catalogueId, kind: source.kind, identityLevel: 'work', title: source.title,
    identifiers: source.identifier ? [source.identifier] : [], links: [{ role: 'landing', url: source.url, label: source.label }],
    evidence: [{ path: relative(ROOT, citingPath), locator }], relations: [],
    statements: [{ kind: 'credit', text: source.credit, scope: 'citation', evidence: `${relative(ROOT, citingPath)}#${locator}` }] }));
}

const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
const write = async (path: string, value: string | Buffer) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };
const cacheDirectory = resolve('output/damit-asteroids/downloads');
async function download(url: string, name: string) {
  const cached = resolve(cacheDirectory, name);
  const existing = await readFile(cached).catch(() => null);
  if (existing) return existing;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.subarray(0, 64).toString('utf8').trimStart().startsWith('<!DOCTYPE html')) throw new Error(`${url} answered with an HTML page.`);
  await write(cached, bytes);
  return bytes;
}

/** Measure the unchanged DAMIT counted triangle table: closure, winding, signed volume, extents. */
function measureMesh(text: string) {
  const tokens = text.trim().split(/\s+/u).map(Number);
  const [vertexCount, faceCount] = tokens;
  if (!Number.isInteger(vertexCount) || !Number.isInteger(faceCount) || tokens.length !== 2 + vertexCount! * 3 + faceCount! * 3) throw new TypeError('Not a DAMIT counted triangle table.');
  const vertices = Array.from({ length: vertexCount! }, (_, i) => tokens.slice(2 + i * 3, 5 + i * 3) as [number, number, number]);
  const faces = Array.from({ length: faceCount! }, (_, i) => tokens.slice(2 + vertexCount! * 3 + i * 3, 5 + vertexCount! * 3 + i * 3).map(index => index - 1) as [number, number, number]);
  let volume = 0;
  const directed = new Map<string, number>();
  for (const [a, b, c] of faces) {
    const [p, q, r] = [vertices[a]!, vertices[b]!, vertices[c]!];
    volume += (p[0] * (q[1] * r[2] - q[2] * r[1]) - p[1] * (q[0] * r[2] - q[2] * r[0]) + p[2] * (q[0] * r[1] - q[1] * r[0])) / 6;
    for (const [from, to] of [[a, b], [b, c], [c, a]] as const) directed.set(`${from}>${to}`, (directed.get(`${from}>${to}`) ?? 0) + 1);
  }
  const edges = new Set([...directed.keys()].map(key => key.split('>').map(Number).sort((x, y) => x - y).join('-')));
  const closedManifold = [...directed.entries()].every(([key, count]) => count === 1 && directed.get(key.split('>').reverse().join('>')) === 1);
  const extents = [0, 1, 2].map(axis => Math.max(...vertices.map(v => v[axis]!)) - Math.min(...vertices.map(v => v[axis]!)));
  const radii = vertices.map(v => Math.hypot(...v));
  return { vertexCount: vertexCount!, faceCount: faceCount!, volume, closedManifold, euler: vertexCount! - edges.size + faceCount!, extents, radii, firstVertex: vertices[0]!, firstFace: faces[0]! };
}

/** Round a relief extreme outward to 1, 2, 2.5 or 5 times a power of ten. */
function niceCeil(value: number) {
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map(step => step * power).find(step => step >= value - 1e-12)!;
}

function equatorialPole(lambda: number, beta: number) {
  const rad = Math.PI / 180, e = OBLIQUITY_DEGREES * rad, l = lambda * rad, b = beta * rad;
  const x = Math.cos(b) * Math.cos(l), y = Math.cos(b) * Math.sin(l), z = Math.sin(b);
  const Y = y * Math.cos(e) - z * Math.sin(e), Z = y * Math.sin(e) + z * Math.cos(e);
  return { rightAscensionDegrees: ((Math.atan2(Y, x) / rad) % 360 + 360) % 360, declinationDegrees: Math.asin(Z) / rad };
}

function horizonsElement(text: string, key: string) {
  const block = text.slice(text.indexOf('$$SOE'), text.indexOf('$$EOE'));
  const header = text.slice(0, text.indexOf('$$SOE')).split('\n').reverse().find(line => line.includes('JDTDB') && line.includes(','));
  if (!header) throw new TypeError('Horizons elements header is missing.');
  const columns = header.split(',').map(value => value.trim()), row = block.split('\n').find(line => line.includes(','))!.split(',').map(value => value.trim());
  const value = Number(row[columns.indexOf(key)]);
  if (!Number.isFinite(value)) throw new TypeError(`Horizons ${key} is missing.`);
  return value;
}

const sourceEntry = (catalogueId: string, url: string, label: string, locator: string, quote?: string) =>
  ({ catalogueId, url, label, checked, locator, ...(quote ? { quote } : {}) });

async function authorBody(body: Body) {
  const { id, name, number, model, calibration } = body;
  const pkg = resolve('src/objects', id), src = resolve(pkg, 'source'), template = resolve('src/objects', TEMPLATE);
  const modelUrl = `${DAMIT}/asteroid_models/view/${model.id}`, shapeUrl = `${DAMIT}/stored_files/open/${model.shapeFile}/shape.txt`;
  const spinUrl = model.spinFile === undefined ? undefined : `${DAMIT}/stored_files/open/${model.spinFile}/${model.spinFileName ?? 'IAUspin.txt'}`;
  const shapePath = `shape/model-${model.id}.txt`, spinPath = `reference/${model.id}-IAUspin.txt`;
  const credit = `DAMIT, Astronomical Institute of Charles University; ${name} model ${model.id}; original model authors identified in its pinned reference records.`;
  const shapeId = `${id}-shape`;

  // Downloads.
  const shapeBytes = await download(shapeUrl, `${id}-shape.txt`);
  await write(resolve(src, shapePath), shapeBytes);
  if (spinUrl) await write(resolve(src, spinPath), await download(spinUrl, `${id}-IAUspin.txt`));
  if (body.occultation) await write(resolve(src, `reference/${model.id}-${body.occultation.name}`), await download(`${DAMIT}/stored_files/open/${body.occultation.file}/${body.occultation.name}`, `${id}-${body.occultation.name}`));
  const sbdbUrl = `https://ssd-api.jpl.nasa.gov/sbdb.api?sstr=${number}&discovery=1&phys-par=1`;
  const sbdbBytes = await download(sbdbUrl, `${id}-sbdb.json`);
  await write(resolve(src, 'reference/sbdb.json'), sbdbBytes);
  const sbdb = requireRecord(JSON.parse(sbdbBytes.toString('utf8'))), sbdbObject = requireRecord(sbdb.object), discovery = requireRecord(sbdb.discovery);
  const command = `${number};`;
  const elementsQuery = elementsUrl({ command, center: '500@10', startJd: EPOCH_JD, stopJd: EPOCH_JD + 1, stepDays: 1 });
  const vectorsQuery = vectorsUrl({ command, center: '500@10', epochsJdTdb: [EPOCH_JD - 30, EPOCH_JD, EPOCH_JD + 30], outUnits: 'KM-D' });
  const physicalQuery = `https://ssd.jpl.nasa.gov/api/horizons.api?format=text&COMMAND=%27${number}%3B%27&OBJ_DATA=YES&MAKE_EPHEM=NO`;
  const horizonsFiles: Record<string, string> = { 'reference/horizons-elements.txt': elementsQuery, 'reference/horizons-vectors.txt': vectorsQuery, 'reference/horizons-physical.txt': physicalQuery };
  const horizonsText: Record<string, string> = {};
  for (const [path, url] of Object.entries(horizonsFiles)) {
    const text = `# ${url}\n${(await download(url, `${id}-${path.split('/')[1]}`)).toString('utf8')}`;
    horizonsText[path] = text;
    await write(resolve(src, path), text);
  }
  const semiMajorAxisAu = horizonsElement(horizonsText['reference/horizons-elements.txt']!, 'A') / AU_KM;
  const orbitalPeriodYears = horizonsElement(horizonsText['reference/horizons-elements.txt']!, 'PR') / 365.25;
  let neowise: Record<string, string> | undefined;
  if (calibration.neowiseReference) {
    const query = `select * from neowisesbpropv2 where asteroid_number = ${number}`;
    const url = `https://irsa.ipac.caltech.edu/TAP/sync?QUERY=${encodeURIComponent(query).replace(/%20/gu, '+')}&FORMAT=csv&LANG=ADQL&REQUEST=doQuery`;
    const csv = (await download(url, `${id}-neowise.csv`)).toString('utf8');
    const [header, ...rows] = csv.trim().split('\n');
    const columns = header!.split(',');
    const selected = rows.map(row => Object.fromEntries(row.split(',').map((value, i) => [columns[i]!, value]))).filter(row => row.reference === calibration.neowiseReference);
    if (selected.length !== 1 || Number(selected[0]!.diameter) !== calibration.diameterKm || Number(selected[0]!.diameter_err) !== calibration.uncertaintyKm)
      throw new Error(`${id}: the NEOWISE ${calibration.neowiseReference} row does not match the input diameter.`);
    neowise = selected[0]!;
    await write(resolve(src, 'reference/neowise-query.txt'), `${url}\n`);
    await write(resolve(src, 'reference/neowise-selected.csv'), `${header}\n${rows[rows.findIndex(row => row.split(',')[columns.indexOf('reference')] === calibration.neowiseReference)]}\n`);
  }

  // Mesh measurements and physical scale.
  const mesh = measureMesh(shapeBytes.toString('utf8'));
  if (!mesh.closedManifold || mesh.euler !== 2 || !(mesh.volume > 0)) throw new Error(`${id}: the source mesh is not a closed, consistently wound genus-zero surface.`);
  const equivalentDiameterUnits = 2 * Math.cbrt(3 * mesh.volume / (4 * Math.PI));
  const kmPerUnit = calibration.diameterKm / equivalentDiameterUnits, metersPerUnit = kmPerUnit * 1000;
  const radiusKm = calibration.diameterKm / 2, radiusMeters = radiusKm * 1000;
  const radialRangeKm = [Math.min(...mesh.radii) * kmPerUnit, Math.max(...mesh.radii) * kmPerUnit];
  const elevation = [-niceCeil(radiusKm - radialRangeKm[0]!), niceCeil(radialRangeKm[1]! - radiusKm)];
  // The shared 800-face budget, or the whole source when it is smaller (as Bacchus keeps its 508 faces).
  const faceBudget = Math.min(800, mesh.faceCount);
  const maximumErrorMeters = Math.round(radiusMeters * body.maximumErrorFraction * 1000) / 1000;
  const grid = { metersPerUnit, expectedVertices: mesh.vertexCount, expectedFaces: mesh.faceCount, indexBase: 1 };
  const terrain = requireTerrainMesh(await loadPdsPlateShape(resolve(src, shapePath), grid));
  const simplification = { method: 'source-meshoptimizer', targetFaces: faceBudget, maximumErrorMeters, regularize: true };
  const simplified = requireRecord((await simplifyRadialShape(terrain, { faceBudget, simplification, source: `${id}: ${relative(ROOT, resolve(src, shapePath))}` }, 1)).simplification);
  const pole = equatorialPole(model.lambda, model.beta);
  const limitation = model.nonconvex
    ? `The nonconvex model, fitted to ${model.basis}, resolves large concavities where those data constrain them; craters and fine relief are unresolved.`
    : 'The convex inversion resolves the broad shape; craters and concavities are unresolved.';
  const kind = model.nonconvex ? `nonconvex model fitted to ${model.basis}` : 'convex light-curve model';

  const calibrationRecord = {
    method: calibration.method, diameterKm: calibration.diameterKm, uncertaintyKm: calibration.uncertaintyKm, quantity: calibration.quantity,
    reference: calibration.reference, referenceUrl: calibration.referenceUrl, notes: calibration.notes,
    scaleKmPerSourceUnit: kmPerUnit, sourceUrl: calibration.referenceUrl, sourceLabel: calibration.reference, diameterSemantics: calibration.quantity,
    limitations: `Uniform scale of the unchanged archived mesh by the adopted diameter and its quoted uncertainty. ${calibration.notes}`,
    visibleDescription: calibration.visibleDescription, ...(neowise ? { catalog: neowise } : {}),
  };
  const damitModel = {
    modelId: model.id, modelUrl, shapeUrl, ...(spinUrl ? { spinUrl } : {}), modelVersion: model.version,
    lambda: model.lambda, beta: model.beta, periodHours: model.periodHours, ...(model.yorpRadPerDay2 === undefined ? {} : { yorpRadPerDay2: model.yorpRadPerDay2 }),
    ...(model.comment ? { archiveComment: model.comment } : {}), nonconvex: model.nonconvex,
    mesh: { vertices: mesh.vertexCount, faces: mesh.faceCount, signedVolumeSourceUnitsCubed: mesh.volume, volumeEquivalentDiameterSourceUnits: equivalentDiameterUnits,
      closedManifold: mesh.closedManifold, extentsSourceUnits: mesh.extents, eulerCharacteristic: mesh.euler, scaledVolumeCubicKm: mesh.volume * kmPerUnit ** 3, physicalRadiusKm: radiusKm },
    alternativeModels: body.alternatives.map(alternative => ({ ...alternative, modelUrl: `${DAMIT}/asteroid_models/view/${alternative.id}` })),
    selectionReason: body.alternatives.length
      ? `Selected model ${model.id}${model.comment ? ` (archive comment: ${model.comment})` : ''}; the listed alternative pole fits the light curves as well. No unique-pole claim.`
      : 'The only archived model for this asteroid.',
    references: model.references.map(reference => `${DAMIT}/references/view/${reference.id}`),
  };
  const modelProperties = {
    source: modelUrl, modelId: model.id, modelVersion: model.version, diameterKm: calibration.diameterKm, diameterInterpretation: calibration.visibleDescription,
    calibration: calibrationRecord, periodHours: model.periodHours, poleEclipticJ2000Degrees: [model.lambda, model.beta], modelLimitations: limitation,
    shape: { source: shapeUrl, vertices: mesh.vertexCount, faces: mesh.faceCount, originalUnits: 'uncalibrated source coordinates', metersPerUnit,
      firstVertexKm: mesh.firstVertex.map(value => value * kmPerUnit), firstFaceZeroBased: mesh.firstFace, extentsKm: mesh.extents.map(value => value * kmPerUnit),
      volumeCubicKm: mesh.volume * kmPerUnit ** 3, volumeEquivalentRadiusKm: radiusKm, radialRangeKm },
    elevation, simplification: simplified,
  };
  await write(resolve(src, 'reference/calibration.json'), json(calibrationRecord));
  await write(resolve(src, 'reference/damit-model.json'), json(damitModel));
  await write(resolve(src, 'reference/model-properties.json'), json(modelProperties));

  // Preparation records.
  const templateTerrestrial = requireRecord(JSON.parse(await readFile(resolve(template, 'source/preparation/terrestrial.json'), 'utf8')));
  const templateRaster = requireRecord(templateTerrestrial.raster), templateScience = requireRecord(requireArray(templateRaster.scientific)[0]);
  const scientific = { ...templateScience, path: shapePath, format: 'pds-plate-model', grid, valueTransform: { scale: 0.001, offset: -radiusKm }, minimum: elevation[0], maximum: elevation[1], colors: PALETTE,
    relief: { ...requireRecord(templateScience.relief), referenceRadiusMeters: radiusMeters }, surfaceSampling: { method: 'closest-source-point', maximumDistanceMeters: maximumErrorMeters } };
  const templateGeometry = requireRecord(templateTerrestrial.geometry), templateRadial = requireRecord(templateGeometry.radialTerrain);
  const terrestrial = { ...templateTerrestrial, namespace: id, displayName: name, publicBase: `/scenes/${id}/`,
    raster: { ...templateRaster, scientific: [scientific] },
    geometry: { ...templateGeometry, radiusKm, mapUrl: `/scenes/${id}/${id}-shape-surface@2x.webp`, polesUrl: `/scenes/${id}/${id}-shape-surface@2x.webp`,
      radialTerrain: { ...templateRadial, path: shapePath, grid, faceBudget, simplification } },
    celestial: { sunSource: 'Published DAMIT pole and period, physical scale from the pinned calibration, and fixed-epoch JPL Horizons orbit; arbitrary display phase.' } };
  await write(resolve(src, 'preparation/terrestrial.json'), json(terrestrial));
  await write(resolve(src, 'preparation/rotation.json'), json({ schema: 'cssearth-observed-pole@1', ...pole, displayMeridianDegrees: 0, phase: 'arbitrary-display-phase', periodHours: model.periodHours,
    coordinateSystem: 'Original DAMIT co-rotating Cartesian frame, +Z spin pole and +X reference meridian; east-positive longitude; arbitrary display phase',
    source: `DAMIT model ${model.id}, version ${model.version}: ecliptic J2000 pole (${model.lambda}, ${model.beta}) degrees; period ${model.periodHours} hours; equatorial conversion with obliquity ${OBLIQUITY_DEGREES} degrees. ${limitation}` }));
  const operations = [
    { kind: 'download', groups: ['restore', 'refresh'], path: shapePath, url: shapeUrl },
    // Reference PDFs are not committed (see .gitignore); restore them from the archive.
    ...(body.occultation ? [{ kind: 'download', groups: ['restore', 'refresh'], path: `reference/${model.id}-${body.occultation.name}`, url: `${DAMIT}/stored_files/open/${body.occultation.file}/${body.occultation.name}` }] : []),
  ];
  await write(resolve(src, 'preparation/acquisition.json'), json({ schema: 'cssearth-acquisition-plan@1', operations }));
  const navigation = requireRecord(JSON.parse(await readFile(resolve(template, 'source/preparation/navigation.json'), 'utf8')));
  await write(resolve(src, 'preparation/navigation.json'), json({ ...navigation, objectId: id }));
  await write(resolve(pkg, '.gitignore'), await readFile(resolve(template, '.gitignore')));
  const css = (await readFile(resolve('src/renderers/css/styles', `${TEMPLATE}-surfaces.css`), 'utf8')).replaceAll(TEMPLATE, id);
  await write(resolve('src/renderers/css/styles', `${id}-surfaces.css`), css);

  // Content: facts, lenses, resources.
  const horizonsSource = (locator: string) => ({ url: elementsQuery, label: 'JPL Horizons, 2026-09-03 epoch', checked, path: 'source/reference/horizons-elements.txt', catalogueId: 'jpl-horizons', locator });
  const legendMiddle = (elevation[0]! + elevation[1]!) / 2;
  const fmt = (value: number) => String(Number(value.toPrecision(4)));
  const content = {
    schema: 'cssearth-object-content@1', version: 1, id, displayName: name,
    panel: {
      facts: [
        { id: 'radius', label: 'Display reference radius', value: `${fmt(radiusKm)} km (size-calibrated model)`,
          source: { url: calibration.referenceUrl, label: calibration.reference, checked, path: 'source/reference/calibration.json', catalogueId: calibration.catalogueId, locator: '/diameterKm; radius = diameterKm / 2' } },
        { id: 'distance-from-sun', label: 'Solar semimajor axis', value: `${semiMajorAxisAu.toFixed(3)} AU`, source: horizonsSource('$$SOE first epoch; A (km) / 149597870.7') },
        { id: 'orbital-period', label: 'Orbital period', value: `${orbitalPeriodYears.toFixed(2)} years`, source: horizonsSource('$$SOE first epoch; PR (days) / 365.25') },
        { id: 'rotation-period', label: 'Model rotation period', value: `${model.periodHours} hours`,
          source: { url: modelUrl, label: `DAMIT model ${model.id}`, checked, path: 'source/reference/damit-model.json', catalogueId: 'damit-models', locator: `Model ${model.id}; /periodHours` } },
      ],
      moreFacts: [],
    },
    lenses: {
      titleKey: 'lenses', defaultLens: 'shape',
      controls: [
        { id: 'shape', label: 'Shape', thumbnail: `/scenes/${id}/${id}-shape-thumbnail.webp`, surface: `${id}-shape-surface@2x.webp`, poles: `${id}-shape-surface@2x.webp`,
          source: { id: shapeId, path: '../manifest.json' }, falseColor: false,
          notes: `${calibration.visibleDescription} The ${model.nonconvex ? 'nonconvex model shows broad shape and large concavities' : 'convex model shows broad shape'}; rotational phase is illustrative. Neutral gray (#808080 sRGB) is a shared display convention, not measured surface color or albedo.`, noData: true },
        { id: 'elevation', label: 'Elevation', thumbnail: `/scenes/${id}/${id}-elevation-thumbnail.webp`, surface: `${id}-elevation-surface@2x.webp`, poles: `${id}-elevation-surface@2x.webp`,
          source: { id: shapeId, path: '../manifest.json' },
          legend: { kind: 'scale', title: 'Elevation', width: 256, height: 16, labels: [fmt(elevation[0]!), fmt(legendMiddle), fmt(elevation[1]!)], meta: `km · ${fmt(radiusKm)} km reference sphere`,
            sourceUrl: modelUrl, image: `/scenes/${id}/${id}-elevation-legend.webp` },
          notes: `Radius on the shape model minus a ${fmt(radiusKm)} km reference sphere, in false color. Heights inherit the size uncertainty; this is not independent topography or gravitational height.` },
      ],
    },
    settings: { titleKey: 'settings', controls: [{ kind: 'toggle', name: 'shadows', label: 'Shadows', checked: false }] },
    charts: [],
    resources: [
      { label: 'Model record', role: 'terrain', description: `DAMIT model ${model.id}, version ${model.version}`, href: modelUrl },
      { label: 'Size calibration', role: 'facts', description: calibration.reference, href: calibration.referenceUrl },
      { label: 'Rotation', role: 'rotation', description: 'Published pole and period; arbitrary display phase', href: modelUrl },
    ],
    provenance: {
      editorial: { url: modelUrl, credit },
      physical: { path: `../../../../../packages/astronomy/data/bodies/${id}.json`, credit: 'Vendored JPL physical and orbital data' },
    },
  };
  await write(resolve(src, 'content/object.json'), json(content));

  // Reader text.
  const sbdbName = requireString(sbdbObject.fullname);
  const sbdbSource = sourceEntry('jpl-small-body-database', `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${number}`, 'JPL Small-Body Database', 'Object, discovery circumstances and orbit',
    `${sbdbName}; Discovered ${requireString(discovery.date)} by ${requireString(discovery.who)} at ${requireString(discovery.location)}; orbit class: ${requireString(requireRecord(sbdbObject.orbit_class).name)}`);
  const damitSource = sourceEntry(`damit-shape-${model.shapeFile}`, shapeUrl, `DAMIT shape ${model.shapeFile} · ${name}`, 'Dataset source');
  const cite = (keys: string[]) => [...keys.map(key => key === 'sbdb' ? sbdbSource : (({ url, label, locator, quote, catalogueId }) => sourceEntry(catalogueId, url, label, locator, quote))(body.papers[key]!)), damitSource];
  await write(resolve(pkg, 'text.json'), json({
    schema: 'cssearth-object-text@1', objectId: id,
    card: { text: body.text.card, sources: cite(body.text.cardSources) },
    introduction: { text: body.text.introduction, sources: cite(body.text.introductionSources) },
    datasets: {
      shape: { title: model.nonconvex ? `DAMIT ${model.id} shape model` : 'Light-curve shape model', detail: 'Published shape', summary: body.text.shapeSummary },
      elevation: { title: 'Shape-derived elevations', detail: 'Shape-derived radial height',
        summary: `Height above or below a ${fmt(radiusKm)} km sphere, sharing the size uncertainty. Colors mix the overall shape with local relief.` },
    },
  }));

  const textPath = resolve(pkg, 'text.json');
  for (const [part, keys] of [['card', body.text.cardSources], ['introduction', body.text.introductionSources]] as const)
    for (const [index, key] of keys.entries()) if (key !== 'sbdb') { const paper = body.papers[key]!; await ensureRecord({ ...paper, title: paper.quote.length < 200 && paper.locator === 'Title' ? paper.quote : paper.label }, textPath, `/${part}/sources/${index}`); }
  if (calibration.record) await ensureRecord({ ...calibration.record, url: calibration.referenceUrl, label: calibration.reference }, resolve(src, 'content/object.json'), '/panel/facts/0/source');

  // Object descriptor and astronomy record.
  const descriptor = requireRecord(JSON.parse(await readFile(resolve(template, 'object.json'), 'utf8')));
  const properties = requireRecord(descriptor.properties), recipe = requireRecord(properties.recipe);
  // A first frame for the catalogue, from the Horizons position at the shared epoch; preparation replaces it.
  const epochRow = horizonsText['reference/horizons-vectors.txt']!.slice(horizonsText['reference/horizons-vectors.txt']!.indexOf('$$SOE')).split('\n')
    .find(line => line.startsWith(`${EPOCH_JD.toFixed(9)},`));
  if (!epochRow) throw new TypeError(`${id}: Horizons vectors lack the ${EPOCH_JD} epoch.`);
  const originM = epochRow.split(',').slice(2, 5).map(value => Number(value) * 1000);
  const geometryRadius = requireFiniteNumber(templateGeometry.radius);
  const object = {
    id,
    properties: {
      preparation: { ...requireRecord(properties.preparation), label: name },
      recipe: { ...recipe, shape: { kind: 'radial-terrain', radiusKm } },
      worldFrame: { referenceFrame: 'sun-icrf', epochJdTt: EPOCH_JD, originM, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 0, 1],
        metersPerUnit: radiusMeters / geometryRadius, bodyRadiusM: radiusMeters },
      page: { stylesheets: [`src/renderers/css/styles/${id}-surfaces.css`], metadata: { url: 'prepared/page.json' } },
      catalog: { name, classification: 'asteroid', color: '#aaaaaa', distanceAu: semiMajorAxisAu, description: body.text.card, systemName: 'Solar System', context: {} },
    },
    schema: descriptor.schema, type: descriptor.type,
    prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' },
  };
  await write(resolve(pkg, 'object.json'), json(object));
  const astronomyPath = resolve('packages/astronomy/data/bodies', `${id}.json`);
  const existingAstronomy = await readFile(astronomyPath, 'utf8').catch(() => null);
  if (!existingAstronomy) await write(astronomyPath, json({ id, classification: 'asteroid', physical: { name, horizonsCode: command, meanRadiusKm: radiusKm, gravitationalParameterKm3PerS2: 0, parent: 'sun' },
    physicalNotes: 'Published shape models with documented physical size calibration.', acquisition: { heliocentric: { target: command, model: 'asteroid' } } }));

  // Documentation.
  await write(resolve(pkg, 'NOTICE.md'), notice(body, modelUrl));
  await write(resolve(pkg, 'README.md'), readme(body, { modelUrl, shapeUrl, spinUrl, mesh, equivalentDiameterUnits, metersPerUnit, radiusKm, pole, neowise }));
  await write(resolve(pkg, 'investigations.json'), json(ledger(body, modelUrl)));

  // Manifest, then the marker snapshot that reads it.
  const manifest: Record<string, unknown> = {
    schema: `cssearth-authoritative-sources@2`,
    inputs: [
      { id: shapeId, path: shapePath, origin: shapeUrl, credit, license: 'CC-BY-4.0, DAMIT; retain original model and authors attribution.',
        acquisition: 'Restore original uncalibrated counted triangle table through the pinned acquisition recipe.',
        redistribution: 'Original and derived model data with CC-BY-4.0 attribution; see NOTICE.md.', consumers: ['terrain', 'shape', 'elevation'], lensId: 'elevation',
        projection: { kind: 'body-fixed-cartesian-triangular-mesh', longitudeDirection: 'east', latitudeType: 'planetocentric', units: 'uncalibrated source coordinates', metersPerUnit, referenceRadiusMeters: radiusMeters },
        coverage: `Published ${kind} ${model.id}. ${calibration.visibleDescription} ${limitation}`,
        sourceBinding: { kind: 'catalogued', references: [{ catalogueId: `damit-shape-${model.shapeFile}`, role: 'material', evidence: ENTRY_EVIDENCE }] } },
    ],
    generatedIntermediates: [], documents: [],
  };
  await write(resolve(src, 'manifest.json'), json(manifest));
  await pinDocuments(src, manifest);
  const source = await createSourceManifest({ objectId: id, objectName: name, sourceRoot: src });
  const radial = await loadRadialTerrain({ config: { ...terrestrial, geometry: { ...terrestrial.geometry, radius: geometryRadius, radiusKm } }, sourceDirectory: src, source });
  if (!radial) throw new TypeError(`${id}: the marker snapshot requires a radial terrain.`);
  const recipeRecord = { generator: 'tools/objects/terrestrial-layers/radial-snapshot.mts', inputs: [shapeId], size: 512, longitudeDegrees: 0, latitudeDegrees: 35, ambient: 0.45, diffuse: 0.55, lensId: 'shape' };
  const context = await renderRadialSnapshot({ ...recipeRecord, faces: radial.faces, map: await neutralMap() });
  await write(resolve(src, 'presentation/context.png'), context);
  manifest.generatedIntermediates = [{ id: 'prepared-radial-context', path: 'presentation/context.png', origin: shapeUrl, credit, license: 'CC-BY-4.0', consumers: ['navigation'],
    recipe: recipeRecord, generator: recipeRecord.generator }];
  await pinDocuments(src, manifest);
  console.log(JSON.stringify({ id, vertices: mesh.vertexCount, faces: mesh.faceCount, radiusKm, metersPerUnit, elevation, maximumErrorMeters, semiMajorAxisAu, pole, estimatedErrorMeters: simplified.estimatedErrorMeters }));
}

/** The shared neutral shape material, as every shape-only marker shows it. */
let neutral: Buffer | undefined;
async function neutralMap() {
  const width = 512, height = 256;
  return neutral ??= await sharp(shapeMaterialRaster(width, height), { raw: { width, height, channels: 3 } }).png().toBuffer();
}

/** Pin every source file that is neither an input nor a generated intermediate as a document. */
async function pinDocuments(src: string, manifest: Record<string, unknown>) {
  const walk = async (path: string): Promise<string[]> => (await Promise.all((await readdir(path, { withFileTypes: true }))
    .map(entry => entry.isDirectory() ? walk(resolve(path, entry.name)) : [resolve(path, entry.name)]))).flat();
  const declared = new Set([...requireArray(manifest.inputs), ...requireArray(manifest.generatedIntermediates)].map(entry => requireString(requireRecord(entry).path)));
  const documents: Record<string, unknown>[] = [];
  for (const path of (await walk(src)).sort()) {
    const rel = relative(src, path);
    if (rel === 'manifest.json' || declared.has(rel)) continue;
    const bytes = await readFile(path);
    documents.push({ path: rel,
      ...(rel === 'content/object.json' ? { sourceBinding: { kind: 'local', reason: 'Project-authored factsheet, dataset recipes and legends.' } } : {}) });
  }
  manifest.documents = documents;
  await write(resolve(src, 'manifest.json'), json(manifest));
}

function notice(body: Body, modelUrl: string) {
  const { name, number, model, calibration } = body;
  return `# (${number}) ${name}: attribution and reuse

The selected geometry and spin originate from [DAMIT model ${model.id}](${modelUrl}), version ${model.version}, credited to ${model.references.map(r => r.label).join('; ')} and the contributing observers cited by that record. DAMIT distributes its database under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/) as stated in the archived model page. Preserve attribution, source links and notice of changes.

Changes for cssEarth: apply the separately documented physical scale; simplify for an 800-face retained raster presentation through the existing preparer; add the shared coordinate grid and a false-color, shape-derived radial-relief view. The original source mesh and spin bytes remain intact. These outputs are derived visualizations; they are not photographs or newly measured terrain.

Physical-size credit: [${calibration.reference}](${calibration.referenceUrl}).${calibration.neowiseReference ? ' For PDS NEOWISE, credit Mainzer, Bauer, Cutri, Grav, Kramer, Masiero, Sonnett and Wright (eds.), NEOWISE Diameters and Albedos V2.0 (2019), plus the original Masiero publication.' : ''} JPL Small-Body Database and Horizons records are credited to NASA/JPL. Article PDFs and reference documents retain their own publication notices; the DAMIT CC BY license does not override those notices.

No texture is claimed to be supplied or endorsed by NASA. Source-coordinate grids and relief colors are visualization choices. No model-derived density, composition or optical appearance is supplied.
`;
}

function readme(body: Body, facts: { modelUrl: string; shapeUrl: string; spinUrl?: string; mesh: ReturnType<typeof measureMesh>; equivalentDiameterUnits: number; metersPerUnit: number; radiusKm: number;
  pole: { rightAscensionDegrees: number; declinationDegrees: number }; neowise?: Record<string, string> }) {
  const { name, number, model, calibration } = body;
  const references = model.references.map(r => `[${r.label}](${DAMIT}/references/view/${r.id}), *${r.title}*`).join('; ');
  const alternatives = body.alternatives.length
    ? `\n\nThe archive also holds model ${body.alternatives.map(a => `[${a.id}](${DAMIT}/asteroid_models/view/${a.id}) with pole λ = ${a.lambda}°, β = ${a.beta}° and period ${a.periodHours} h${a.diameterKm === undefined ? '' : ` (fitted diameter ${a.diameterKm} ± ${a.uncertaintyKm} km)`}`).join('; ')}. Light curves do not tell the two poles apart; the selected one is not claimed to be unique.`
    : '';
  return `# (${number}) ${name}

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| Input | Selected source |
| --- | --- |
| Shape and spin | [DAMIT ${model.id}](${facts.modelUrl}) |
| Physical scale | [${calibration.reference}](${calibration.referenceUrl}) ([record](source/reference/calibration.json)) |

[DAMIT model ${model.id}](${facts.modelUrl}), version ${model.version}${model.comment ? ` (archive comment: "${model.comment}")` : ''}, is a ${model.nonconvex ? `nonconvex mesh fitted to ${model.basis}` : 'convex light-curve inversion mesh'} from ${references}. The original ${facts.mesh.vertexCount} vertices and ${facts.mesh.faceCount} triangular faces are the source input. ${model.nonconvex
    ? 'Large concavities appear where the data constrain them; craters, surface texture and the current rotation phase are not resolved.'
    : "Its large-scale shape is inferred from how the asteroid's total brightness changes as it spins; concavities, craters, surface texture and the current rotation phase are not resolved."}${model.note ? ` ${model.note}` : ''}${alternatives}

Adopted diameter: **${calibration.diameterKm} ± ${calibration.uncertaintyKm} km**, meaning ${calibration.quantity}, from [${calibration.reference}](${calibration.referenceUrl}). The reference-sphere radius is ${facts.radiusKm} km. ${calibration.notes}

[Model fields and mesh measurements](source/reference/damit-model.json).

## Evidence

Checked ${checked} by \`tools/objects/source-authoring/damit-asteroids/author.mts\` from the pinned [inputs](../../../tools/objects/source-authoring/damit-asteroids/inputs.json). The tool measures the unchanged mesh: positive signed volume, every edge used once in each direction, and Euler characteristic ${facts.mesh.euler}. The shape, spin, JPL records${facts.neowise ? ', NEOWISE row' : ''} and every derived record are declared in the [input manifest](source/manifest.json).

## Known problems

- No registered surface imagery exists for this asteroid; the shape shows the shared neutral gray. ${model.nonconvex ? 'The nonconvex model leaves craters and fine relief unresolved.' : 'Convex inversion leaves concavities and fine relief unresolved.'}
- ${calibration.method === 'radiometric-effective-diameter-transfer' ? 'Transferring a thermal sphere diameter to the mesh volume is approximate. The quoted fit error excludes shape, spin and thermal-model systematics.'
  : calibration.method === 'radar-diameter-transfer' ? 'Transferring a radar diameter measured independently of this mesh to its volume is approximate.' : 'The scale inherits the quoted uncertainty of its published fit.'}
- Elevation is false color for model radius minus a reference sphere, not gravitational height or independent terrain.
- The displayed rotation phase is arbitrary and not propagated from the model epoch.${model.yorpRadPerDay2 === undefined ? '' : ` The measured YORP spin-up (${model.yorpRadPerDay2} rad/day²) is recorded but not propagated.`} Orbit context is fixed at 2026-09-03 TT.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Physical scale</summary>

The source's signed tetrahedral volume integral is ${facts.mesh.volume.toPrecision(11)} source units cubed, giving a volume-equivalent diameter of ${facts.equivalentDiameterUnits.toPrecision(12)} source units. The preparation conversion is:

\`metersPerUnit = D_km × 1000 / (2 × cbrt(3 × V_source / (4 × pi)))\`

For this input, \`metersPerUnit = ${facts.metersPerUnit.toPrecision(15)}\`. The raw mesh coordinates and connectivity are unchanged.

</details>

<details>
<summary>Orientation and time</summary>

DAMIT reports the J2000 ecliptic pole λ = ${model.lambda}°, β = ${model.beta}° and sidereal period ${model.periodHours} h. Converted with obliquity ${OBLIQUITY_DEGREES}°, the equatorial pole is α = ${facts.pole.rightAscensionDegrees.toFixed(2)}°, δ = ${facts.pole.declinationDegrees.toFixed(2)}°.${facts.spinUrl ? ` The archived [IAUspin file](${facts.spinUrl}) is kept as a frame and rate cross-check.` : ''} Model longitude zero is an inversion convention, not an observed landmark.

</details>
`;
}

function ledger(body: Body, modelUrl: string) {
  const { id, model, calibration } = body;
  const entries: Record<string, unknown>[] = [
    { id: 'selected-shape-and-spin', subject: `DAMIT ${model.id}: selected shape and spin`, status: 'included',
      finding: `DAMIT model ${model.id}, version ${model.version}, pole (${model.lambda}°, ${model.beta}°), period ${model.periodHours} h, taken unchanged from the archive.${body.alternatives.length ? ` Mirror solution ${body.alternatives.map(a => a.id).join(', ')} recorded as an alternative.` : ''}`,
      evidence: [modelUrl, `${DAMIT}/exports/table/asteroid_models`], checked: [{ date: checked }] },
    { id: 'selected-physical-scale', subject: 'Physical scale', status: 'included',
      finding: `${calibration.diameterKm} ± ${calibration.uncertaintyKm} km, ${calibration.quantity}. ${calibration.notes}`,
      evidence: [calibration.referenceUrl], checked: [{ date: checked }] },
    { id: 'surface-imagery', subject: 'Resolved surface imagery', status: 'unresolved',
      finding: 'No spacecraft or resolved ground-based image of this asteroid was found in the archives searched for this package.',
      revisitWhen: 'A resolved image or a registered surface map of this asteroid is published.', evidence: [modelUrl], checked: [{ date: checked }] },
  ];
  return { schema: 'cssearth-investigation-ledger@1', objectId: id, entries };
}

const tableChecked = checked;
for (const body of bodies) { checked = body.checked ?? tableChecked; await authorBody(body); }
