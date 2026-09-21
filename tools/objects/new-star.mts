#!/usr/bin/env node
/** Scaffold a placed-star object package from its astronomy record, instead of cloning another star by find-and-replace.
 *
 *   node tools/objects/new-star.mts <id> --name <display name> --system <constellation> --color <#rrggbb>
 *     --description <catalogue line> --paper <url> --paper-credit <credit>
 *
 * Requires packages/astronomy/data/bodies/<id>.json with a `star` block and `physical.meanRadiusKm`. Every number here is
 * derived from that record: the world-frame origin, the catalogue distance, the radius facts and the sky-north display axis
 * (skyPlaneOrientation). The package starts with the shape lens and stays off the map until a surface image is added.
 * Prose the scaffold cannot know (reader text, README, credits, ledger) is written with the marker TODO(new-star), which
 * tools/object-package-consistency.test.mts refuses. Then run: node tools/prepare-object.mts <id> */
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { skyPlaneOrientation, starStateFromAstrometryKm } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '../source-values.mts';

export const TODO = 'TODO(new-star)';
const AU_M = 149597870700, PARSEC_M = 3.085677581491367e16, SOLAR_RADIUS_KM = 695700, MAS_RAD = Math.PI / 180 / 3.6e6;
const BODY_RADIUS_UNITS = 248, BODY_DIAMETER_PX = 496;
const INTER = { url: 'https://raw.githubusercontent.com/rsms/inter/9221beed3/docs/font-files/InterVariable.ttf', bytes: 862936, sha256: '746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c' };

export interface StarScaffold { readonly id: string; readonly name: string; readonly system: string; readonly color: string; readonly description: string; readonly paper: string; readonly paperCredit: string; readonly order?: number }

/** The star stylesheet: the Sun's emissive presentation scoped to one object id, with its off-limb plate size. */
export function starStylesheet(id: string, name: string, offLimbSize: number, plateNote: string, spinNote = 'No spin: the rotation axis and period are unmeasured.') {
  const s = `.planet-stage[data-object-id="${id}"]`;
  return `/* ${name}: the Sun's emissive presentation (planet-surfaces.css, SUN block) scoped to this object, loaded after the shared
   planet-surfaces.css base rules. ${spinNote} ${plateNote} */
${s} > :is(.polycss-camera, .${id}-corona-layer, .${id}-limb-layer) {
  --${id}-scene-side-padding: 16px;
  --${id}-reference-width: 1920px;
  --${id}-reference-height: 1080px;
  --${id}-shell-scale: min(
    1,
    calc(
      (100cqw - var(--${id}-scene-side-padding) - var(--${id}-scene-side-padding)) /
        var(--${id}-reference-width)
    ),
    calc(100cqh / var(--${id}-reference-height))
  );
}

/* The shared stage rule (planet-surfaces.css) sizes the camera and the Sun's plates; this object's plates need the same box. */
${s} > :is(.${id}-corona-layer, .${id}-limb-layer) {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
  pointer-events: none;
}

/* Paint order: off-limb context behind the sphere, limb plate above it. */
${s} .${id}-corona-layer {
  z-index: 0;
}

${s} .polycss-camera {
  z-index: 1;
}

${s} .${id}-limb-layer {
  z-index: 2;
}

${s} .${id}-body {
  transform-style: preserve-3d;
}

${s} .polycss-scene s {
  position: absolute;
  display: block;
  transform-origin: 0 0;
  margin: 0;
  padding: 0;
  line-height: 0;
  text-decoration: none;
  background-repeat: no-repeat;
  pointer-events: none;
}

/* Emissive leaves: full-band leaves stay visible from behind so the overlapped seams never open; polar cap leaves
   hide their back faces. */
${s} .polycss-scene s:not(.${id}-polar) {
  backface-visibility: visible;
  background-image: var(--${id}-surface-image) !important;
}

${s} .polycss-scene s.${id}-polar {
  backface-visibility: hidden;
  background-image: var(--${id}-poles-image) !important;
}

/* Off-limb context: ${offLimbSize} px = raster.json emission.offLimbSize, drawn at the disc's ${BODY_DIAMETER_PX} px. */
${s} .${id}-corona-layer {
  background-image: var(--${id}-corona-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size:
    calc(${offLimbSize}px * var(--${id}-camera-zoom, 1))
    calc(${offLimbSize}px * var(--${id}-camera-zoom, 1));
}

/* Limb plate: ${BODY_DIAMETER_PX} px = raster.json emission.bodyDiameter = camera.logicalBodyDiameter. */
${s} .${id}-limb-layer {
  background-image: var(--${id}-limb-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size:
    calc(${BODY_DIAMETER_PX}px * var(--${id}-camera-zoom, 1))
    calc(${BODY_DIAMETER_PX}px * var(--${id}-camera-zoom, 1));
}

${s} .polycss-camera {
  display: block;
  width: 100%;
  height: 100%;
}

${s} .polycss-scene {
  will-change: transform;
}

${s} .polycss-scene s {
  width: var(--polycss-atlas-width, var(--polycss-atlas-size, 64px));
  height: var(--polycss-atlas-height, var(--polycss-atlas-size, 64px));
  transform-style: preserve-3d;
  font: inherit;
  font-weight: normal;
  font-style: normal;
  line-height: 0;
}
`;
}

/** Every file of a new shape-only placed star, keyed by repository path. Pure: the caller writes them. */
export function scaffoldStarFiles(spec: StarScaffold, bodyRecord: unknown, epochJdTt: number): Map<string, string> {
  if (!/^[a-z][a-z0-9-]*$/u.test(spec.id) || !/^#[0-9a-f]{6}$/u.test(spec.color)) throw new TypeError('A star needs a lowercase id and a #rrggbb colour.');
  const body = requireRecord(bodyRecord, 'astronomy record'), star = requireRecord(body.star, 'star astrometry'), physical = requireRecord(body.physical, 'physical');
  if (body.id !== spec.id) throw new TypeError(`The astronomy record is for ${String(body.id)}, not ${spec.id}.`);
  const astrometry = { rightAscensionDegrees: requireFiniteNumber(star.rightAscensionDegrees), declinationDegrees: requireFiniteNumber(star.declinationDegrees),
    positionEpochJulianYear: requireFiniteNumber(star.positionEpochJulianYear), distanceParsecs: requireFiniteNumber(star.distanceParsecs),
    properMotionRaMasPerYear: requireFiniteNumber(star.properMotionRaMasPerYear), properMotionDecMasPerYear: requireFiniteNumber(star.properMotionDecMasPerYear),
    radialVelocityKmPerS: requireFiniteNumber(star.radialVelocityKmPerS) };
  if (star.presentationUp !== 'display-axis') throw new TypeError('A star without a measured axis needs presentationUp: display-axis in its astronomy record.');
  const radiusKm = requireFiniteNumber(physical.meanRadiusKm), { id, name } = spec;
  const originM = starStateFromAstrometryKm(astrometry, epochJdTt).positionKm.map(value => value * 1000);
  const angularDiameterMas = 2 * radiusKm * 1000 / (astrometry.distanceParsecs * PARSEC_M) / MAS_RAD;
  const orientation = skyPlaneOrientation(astrometry, 0), offLimbSize = 600;
  const files = new Map<string, string>(), put = (path: string, value: unknown) => files.set(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  const o = `src/objects/${id}`;
  put(`${o}/object.json`, { schema: 'cssearth-object@1', id, type: 'layered-body', properties: {
    preparation: { schema: 'cssearth-object-preparation@1', label: name, steps: ['verify-sources', 'title', 'assets', 'panel-content', 'lenses', 'starfield', 'scene', 'controls', 'presentation', 'runtime-assets'] },
    recipe: { schema: 'cssearth-authored-object@1', surfaces: [{ id: 'body', source: 'geometry', projection: 'equirectangular', lenses: [{ id: 'shape', source: 'content', material: 'emission' }] }],
      shape: { kind: 'sphere', radiusKm }, materials: [{ id: 'emission', source: 'raster', model: 'emissive' }],
      sources: ['raster', 'geometry', 'celestial', 'presentation'].map(source => ({ id: source, path: `source/preparation/${source}.json` })).concat([
        { id: 'content', path: 'source/content/object.json' }, { id: 'solar-system', path: 'source/presentation/solar-system.json' }, { id: 'rotation', path: 'source/preparation/rotation.json' },
        { id: 'title', path: 'source/presentation/title-mark.json' }, { id: 'navigation', path: 'source/preparation/navigation.json' }, { id: 'acquisition', path: 'source/preparation/acquisition.json' }]),
      emission: { source: 'raster', material: 'emission' } },
    page: { stylesheets: ['src/renderers/css/styles/planet-surfaces.css', `src/renderers/css/styles/${id}-surfaces.css`], metadata: { url: 'prepared/page.json', sha256: '0'.repeat(64) } },
    catalog: { name, classification: 'star', color: spec.color, distanceAu: Math.round(Math.hypot(...originM) / AU_M * 10) / 10, description: spec.description, systemName: spec.system, order: spec.order ?? 1100, context: { order: (spec.order ?? 1100) - 3 } },
    // A first frame for the catalogue; preparation replaces it with the prepared presentation frame.
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt, originM, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 0, 1], metersPerUnit: radiusKm * 1000 / BODY_RADIUS_UNITS, bodyRadiusM: radiusKm * 1000 } },
    prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json', sha256: '0'.repeat(64) } });
  put(`${o}/source/preparation/raster.json`, { schema: 'cssearth-raster-recipe@1', publicBase: `/scenes/${id}/`, sourceWidth: 1024, sourceHeight: 512, width: 1024, height: 512, latitudeBands: 16, polarTile: 256,
    resample: 'density-before-pack', polarProjection: 'orthographic-bilinear', polesCombined: false, polesOutput: `${id}-poles-{id}{suffix}.webp`, surfaceMetadata: { schema: `css${id}-prepared-assets@1` },
    thumbnail: { size: 64, quality: 88, centerLongitudeDegrees: 0 },
    surfaces: [{ id: 'shape', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-lens-{id}.webp`, source: 'measurements.json', falseColor: false,
      science: { kind: 'neutral-shape', qualification: 'Shared neutral gray display convention for a photosphere with no image in this package; a sphere of the published radius, self-luminous, so no lighting.' } }],
    emission: { offLimbSize, limbSize: 512, bodyDiameter: BODY_DIAMETER_PX, offLimbOutput: `${id}-context-{id}{suffix}.webp`, limbOutput: `${id}-limb-{id}{suffix}.webp`, metadata: {
      schema: `css${id}-prepared-emission@1`, presentation: 'prepared-emissive-surface-with-stationary-off-limb-context-and-limb-plate',
      offLimbContext: { logicalSize: offLimbSize, source: 'none: no observation, a transparent plate', composition: 'transparent', rotation: 'none', runtimeAlphaProcessing: false },
      limbMaterial: { logicalSize: BODY_DIAMETER_PX, composition: "transparent: the sphere's own silhouette is the limb; the light just outside it is on the off-limb plate", surfaceReplacement: false, runtimeAlphaProcessing: false },
      lighting: false, shadows: false, runtimeLighting: false } } });
  put(`${o}/source/preparation/geometry.json`, { schema: 'cssearth-css-geometry-profile@1', namespace: id, surface: { radius: BODY_RADIUS_UNITS, polarRadius: BODY_RADIUS_UNITS, latitudeSegments: 16, longitudeSegments: 32,
    surface: { url: `/scenes/${id}/${id}-surface-shape@2x.webp`, width: 1024, height: 768 }, surfaceLatitudeHeight: 512, packedBandGutter: 8,
    poles: { url: `/scenes/${id}/${id}-poles-shape@2x.webp`, width: 512, height: 256 }, polarTileSize: 256, polarRadiusScale: 1.035, polarOffset: 0.1, uv: 'cell', color: spec.color },
    projection: { tileSize: 50, layerElevation: 50, seamBleed: 24, interiorSeamBleed: 8, overlap: 0.008, fitToSource: false, rasterScale: 2, rasterGutter: 8, rasterOverscan: 0, positionVariables: false, projectivePoles: false, lightColor: '#ffffff', ambientIntensity: 1 },
    bodyRotationDegrees: 0, output: { schema: `css${id}-prepared-runtime-scene@1`, materialSchema: `css${id}-prepared-emission@1`, layout: 'body-container', body: { axialTiltDegrees: 0, rotationDirection: 'prograde', rotationPeriodEarthDays: 36525,
      sourceProjection: 'no observation: the shared neutral gray of an unresolved surface on the reference sphere', polarPreparation: 'the same gray on the polar tiles',
      axialTiltNote: "the star has no measured rotation axis; the object's rotation record places a display axis along celestial north in the plane of the sky, and this profile's tilt is not used for the frame" } } });
  put(`${o}/source/preparation/celestial.json`, { schema: 'cssearth-celestial-preparation@2', sources: ['presentation/solar-system.json'], directionalSun: false });
  put(`${o}/source/preparation/presentation.json`, { schema: 'cssearth-css-presentation-profile@1', namespace: id, mode: 'emissive' });
  put(`${o}/source/preparation/navigation.json`, { schema: 'cssearth-navigation-marker@1', planetId: id, owner: 'object', presentation: { size: 5 }, source: { path: 'presentation/context.png' },
    operations: [{ type: 'resize', width: 'tile', height: 'tile', fit: 'cover', position: 'centre', kernel: 'lanczos3' }, { type: 'png' }], context: { pixels: 512 } });
  put(`${o}/source/preparation/rotation.json`, { schema: 'cssearth-display-orientation@1', ...orientation, phase: 'arbitrary-display-phase',
    source: `No measured rotation axis or period (${TODO}: name the literature checked). The display axis is celestial north at the catalogue position, placed in the plane of the sky; computed by skyPlaneOrientation in @cssearth/astronomy.`,
    coordinateSystem: 'ICRF/J2000. +Z is the display axis: the sky-north direction at the star, in the plane of the sky. +X is the display meridian, set so that grid longitude 0 faces the Sun and Earth at the scene epoch; east longitude. No spin is propagated.',
    qualification: `Display convention, not a measurement. The rotation axis, spin sense, period and prime meridian of ${name} are unmeasured; the axis shown is where celestial north lies on the sky.` });
  put(`${o}/source/preparation/acquisition.json`, { schema: 'cssearth-acquisition-plan@1', operations: [{ kind: 'download', groups: ['restore', 'refresh'], path: 'presentation/InterVariable.ttf', url: INTER.url }] });
  put(`${o}/source/presentation/solar-system.json`, { schema: 'cssearth-solar-system-preparation@1', bodyId: id, displayName: name, bodyRadiusUnits: BODY_RADIUS_UNITS, bodyRadiusKilometers: radiusKm,
    defaultZoom: 1.25, geometryScale: 1.25 });
  put(`${o}/source/measurements.json`, { schema: 'cssearth-uniform-disc-star@1', id, angularDiameterMas: Math.round(angularDiameterMas * 100) / 100,
    angularDiameterSource: `${TODO}: the published angular diameter and its source; this value is the record's radius at its distance.`, distanceParsecs: astrometry.distanceParsecs,
    distanceSource: requireString(requireRecord(star.sources).distance), radiusKm, radiusSource: String(body.physicalNotes ?? TODO),
    shape: { kind: 'uniform-disc-sphere', qualification: 'A sphere at the published radius in the shared neutral gray; the photosphere of a giant star is not a solid surface and its limb is not sharp.' } });
  put(`${o}/source/content/object.json`, { schema: 'cssearth-object-content@1', version: 1, id, displayName: name,
    // A published fact names its source: the author replaces each TODO catalogue id with the entry the measurement record cites.
    panel: { facts: [
      { id: 'radius', label: 'Radius', value: `${Math.round(radiusKm / SOLAR_RADIUS_KM)} solar radii`,
        source: { catalogueId: `${TODO}-radius-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'radiusKm; radiusSource' } },
      { id: 'distance', label: 'Distance from the Sun', value: `${Math.round(astrometry.distanceParsecs)} parsecs`,
        source: { catalogueId: `${TODO}-distance-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'distanceParsecs; distanceSource' } },
    ], moreFacts: [] },
    lenses: { titleKey: 'lenses', defaultLens: 'shape', controls: [{ id: 'shape', label: 'Shape', qualification: 'A sphere of the published radius; the neutral gray is a display convention, not a measured colour or brightness.',
      thumbnail: `${id}-lens-shape.webp`, surface: `${id}-surface-shape@2x.webp`, poles: `${id}-poles-shape@2x.webp`, source: { id: `${id}-observational-measurements`, path: '../manifest.json', url: spec.paper },
      falseColor: false, notes: `No image of the photosphere is cast here (${TODO}: say why, and point at the ledger). Neutral gray marks an unresolved surface; the display axis is celestial north, a convention.` }] },
    settings: { titleKey: 'settings', controls: [] }, charts: [],
    resources: [{ label: 'Research', role: 'facts', description: spec.paperCredit, href: spec.paper }],
    provenance: { title: { path: '../presentation/title-mark.json' }, editorial: { url: spec.paper, credit: spec.paperCredit },
      physical: { path: `../../../../../packages/astronomy/data/bodies/${id}.json`, credit: 'Published radius at the catalogue distance; SIMBAD astrometry; no measured rotation axis (display convention)' } } });
  put(`${o}/text.json`, { schema: 'cssearth-object-text@1', objectId: id, card: { text: spec.description, sources: [{ catalogueId: `${TODO}-card-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    introduction: { text: `${TODO}: two sentences, 180 characters at most.`, sources: [{ catalogueId: `${TODO}-introduction-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    datasets: { shape: { title: 'Sphere of the measured radius', detail: 'No image', summary: 'A sphere at the published size in neutral gray. No picture of the surface is cast here.' } } });
  put(`${o}/README.md`, `# ${name}\n\n## Sources\n\n${TODO}: placement, radius, rotation and the shape lens, each with its source.\n\n## Evidence\n\n${TODO}: the tests and captures that prove the package.\n\n## Known problems\n\n${TODO}: what is not shown and why.\n\n[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)\n`);
  put(`${o}/NOTICE.md`, `# ${name} credits\n\n${TODO}: the measurements, placement and title font credits.\n\nTitle: Inter (Rasmus Andersson and the Inter Project Authors), SIL Open Font License 1.1; see source/presentation/LICENSE.INTER-OFL.\n`);
  put(`${o}/investigations.json`, { schema: 'cssearth-investigation-ledger@1', objectId: id, entries: [] });
  put(`${o}/.gitignore`, '# No observation files: the sphere is the shared neutral gray.\n');
  const pin = { expectedBytes: 0, expectedSha256: '0'.repeat(64) }, local = (reason: string) => ({ kind: 'local', reason });
  const catalogued = (entryId: string, index: number) => ({ kind: 'catalogued', references: [{ catalogueId: `source-${id}-${entryId}`, role: 'material', evidence: `src/objects/${id}/source/manifest.json@0000000000000000000000000000000000000000#/inputs/${index}` }] });
  const preparation = (entryId: string, path: string, origin: string, consumers: string[]) => ({ id: `${id}-${entryId}`, path, ...pin, origin, sourceBinding: local('Project-authored preparation record; published inputs retain their own identities and hashes.'),
    credit: 'cssEarth and the institutional sources identified in this record', license: 'Project-authored preparation record; referenced observations retain their source terms', acquisition: 'checked repository source', redistribution: 'checked authored source with embedded provenance', consumers });
  put(`${o}/source/manifest.json`, { schema: `css${id}-authoritative-sources@2`, inputs: [
    { id: `${id}-observational-measurements`, path: 'measurements.json', ...pin, origin: spec.paper, credit: spec.paperCredit, license: 'Factual numerical measurements; source attribution retained', acquisition: 'Transcribed published measurements with their sources', redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['shape-model'], sourceBinding: local('Measurements transcribed in this package with their sources; repinned when edited.') },
    { id: 'inter-title-font', path: 'presentation/InterVariable.ttf', expectedBytes: INTER.bytes, expectedSha256: INTER.sha256, origin: INTER.url, credit: 'Inter Project Authors / Rasmus Andersson', license: 'SIL Open Font License 1.1', licenseEvidence: ['presentation/LICENSE.INTER-OFL'], acquisition: 'Restore exact Inter font pin through source/preparation/acquisition.json.', redistribution: 'Permitted with the accompanying SIL Open Font License.', consumers: ['title'], sourceBinding: catalogued('inter-title-font', 1) },
    preparation('preparation-raster', 'preparation/raster.json', 'Repository-authored raster recipe: the shared neutral gray on the reference sphere, transparent plates', ['assets', 'lenses']),
    preparation('preparation-geometry', 'preparation/geometry.json', 'Repository-authored CSS geometry profile: 248-unit sphere, 16 x 32 leaves, emissive material', ['scene', 'presentation']),
    preparation('preparation-celestial', 'preparation/celestial.json', 'Repository-authored celestial recipe: astrometric sky registration for the placed star, no directional Sun', ['starfield']),
    preparation('preparation-presentation', 'preparation/presentation.json', 'Repository-authored presentation profile: emissive mode', ['presentation']),
    preparation('physical-solar-system-recipe', 'presentation/solar-system.json', 'Repository-authored scene recipe: published radius, camera plan', ['scene'])],
    generatedIntermediates: [{ id: 'neutral-disc-context-marker', path: 'presentation/context.png', ...pin, origin: spec.paper, credit: `Sphere of the published radius; marker written by tools/objects/new-star.mts`, license: 'Project-authored display derivative.', consumers: ['navigation'],
      recipe: { generator: 'tools/objects/new-star.mts', inputs: [`${id}-observational-measurements`] }, generator: 'tools/objects/new-star.mts', sourceBinding: local('A flat neutral gray disc, the marker of an unresolved surface.') }],
    documents: ['content/object.json', 'preparation/acquisition.json', 'preparation/navigation.json', 'preparation/rotation.json', 'presentation/LICENSE.INTER-OFL', 'presentation/title-mark.json'].map(path => ({ path, ...pin,
      // Provenance refuses a document without a binding; the content record is authored here.
      ...(path === 'content/object.json' ? { sourceBinding: local('Project-authored factsheet, dataset recipe and legend.') } : {}) })) });
  put(`src/renderers/css/styles/${id}-surfaces.css`, starStylesheet(id, name, offLimbSize, 'Both plates are transparent: no observation is cast.'));
  return files;
}

/** A flat disc in the shared neutral gray on a transparent field: the marker of an unresolved, self-luminous surface. A body whose
 * marker takes a colour from its data (an emission map's palette at its dayside mean) passes that colour. */
export async function neutralDiscMarker(size = 512, fill = 0.9, color: readonly [number, number, number] = [128, 128, 128]) {
  const { default: sharp } = await import('sharp');
  const rgba = Buffer.alloc(size * size * 4), c = (size - 1) / 2, radius = size * fill / 2;
  for (let row = 0; row < size; row++) for (let col = 0; col < size; col++) {
    const distance = Math.hypot(col - c, row - c);
    if (distance > radius + 0.5) continue;
    rgba.set([...color, Math.round(255 * Math.max(0, Math.min(1, radius + 0.5 - distance)))], (row * size + col) * 4);
  }
  return sharp(rgba, { raw: { width: size, height: size, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
}

export async function scaffoldStar(spec: StarScaffold, root = process.cwd()) {
  if (await stat(resolve(root, 'src/objects', spec.id)).then(() => true, () => false)) throw new Error(`src/objects/${spec.id} already exists; the scaffold never overwrites a package.`);
  const record = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${spec.id}.json`), 'utf8')) as unknown;
  const { SOLAR_GEOMETRY_EPOCH_JD_TT } = await import(pathToFileURL(resolve(root, 'src/platform/solar-geometry.mts')).href) as { SOLAR_GEOMETRY_EPOCH_JD_TT: number };
  const files = scaffoldStarFiles(spec, record, SOLAR_GEOMETRY_EPOCH_JD_TT);
  for (const [path, text] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); }
  const presentation = resolve(root, 'src/objects', spec.id, 'source/presentation');
  await copyFile(resolve(root, 'src/objects/betelgeuse/source/presentation/LICENSE.INTER-OFL'), resolve(presentation, 'LICENSE.INTER-OFL'));
  await writeFile(resolve(presentation, 'context.png'), await neutralDiscMarker());
  const font = resolve(root, 'src/objects/betelgeuse/source/presentation/InterVariable.ttf');
  if (await stat(font).then(() => true, () => false)) await copyFile(font, resolve(presentation, 'InterVariable.ttf'));
  return [...files.keys(), `src/objects/${spec.id}/source/presentation/context.png`];
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2), id = args.find(argument => !argument.startsWith('--') && !args[args.indexOf(argument) - 1]?.startsWith('--'));
  const option = (name: string) => { const index = args.indexOf(`--${name}`); return index >= 0 ? args[index + 1] : undefined; };
  const required = ['name', 'system', 'color', 'description', 'paper', 'paper-credit'] as const;
  const missing = required.filter(name => option(name) === undefined);
  if (!id || missing.length) throw new TypeError(`Usage: new-star <id> ${required.map(name => `--${name} <value>`).join(' ')} [--order <n>]; missing ${missing.join(', ') || 'id'}.`);
  const order = option('order');
  const written = await scaffoldStar({ id, name: option('name')!, system: option('system')!, color: option('color')!, description: option('description')!, paper: option('paper')!, paperCredit: option('paper-credit')!, ...(order ? { order: Number(order) } : {}) });
  console.log(`${written.length} files written. Replace every ${TODO}, then: node tools/prepare-object.mts ${id}`);
}
