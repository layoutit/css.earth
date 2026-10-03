/** The package files of a placed star, shared by the shape-only scaffold and the full generator (generate.mts); the command is
 * packages/telescope-cli/src/new-object/new-object-cli.mts. */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { skyPlaneOrientation, starStateFromAstrometryKm } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { AUTHORED_OBJECT_SCHEMA, OBJECT_SCHEMA, SOURCE_MANIFEST_SCHEMA, NEUTRAL_CATALOGUE_COLOR, PREPARED_CSS_OBJECT_FORMAT, OBJECT_TEXT_SCHEMA, DISPLAY_ORIENTATION_SCHEMA, UNIFORM_DISC_STAR_SCHEMA } from '@cssearth/objects';
import { readStarTemperature, temperatureCatalogueColor } from '@cssearth/bake/objects/color';
import { neutralDiscMarker } from '@cssearth/bake/navigation';
import { sphereProjection } from '@cssearth/bake/objects/scene';
import type { SolarEpoch } from './solar-epoch.mts';

export const TODO = 'TODO(new-object)';
const AU_M = 149597870700, PARSEC_M = 3.085677581491367e16, SOLAR_RADIUS_KM = 695700, MAS_RAD = Math.PI / 180 / 3.6e6;
const BODY_RADIUS_UNITS = 248, BODY_DIAMETER_PX = 496, GEOMETRY_SCALE = 1.25;

export interface StarScaffold { readonly id: string; readonly name: string; readonly system: string; readonly temperatureK?: number; readonly temperatureSource?: string; readonly description: string; readonly paper: string; readonly paperCredit: string; readonly order?: number; readonly aliases?: readonly string[]; readonly featured?: true;
  /** A black hole instead of a star: its record's radius is the measured shadow, drawn black. It has no temperature, so its catalogue color is the shared neutral gray. */
  readonly blackHole?: { readonly shadowSource: string };
  /** A neutron star instead of a star with a photosphere: no whole-surface temperature is measured, so it has no temperature, its catalogue color is the shared neutral gray, and its generator writes its measurements (pulsar.mts). */
  readonly neutronStar?: true }
const NEUTRAL_GRAY = NEUTRAL_CATALOGUE_COLOR, SHADOW_BLACK = '#000000';

/** The emissive stylesheet: the Sun's emissive presentation scoped to one object id, with its off-limb plate size. The plates keep
 * their native sizes even when solar-system.json enlarges the sphere: the silhouette fit already draws them at the drawn sphere. */
export function starStylesheet(id: string, name: string, offLimbSize: number, plateNote: string, spinNote = 'No spin: the rotation axis and period are unmeasured.') {
  const s = `.object-stage[data-object-id="${id}"]`;
  return `/* ${name}: the Sun's emissive presentation (body-surfaces.css, SUN block) scoped to this object, loaded after the shared
   body-surfaces.css base rules. ${spinNote} ${plateNote} */
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

/* The shared stage rule (body-surfaces.css) sizes the camera and the Sun's plates; this object's plates need the same box. */
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

/* The silhouette-fit binding already includes physical framing. Keep the prepared plate's native dimensions. */
${s} .${id}-corona-layer {
  background-image: var(--${id}-corona-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size:
    ${offLimbSize}px
    ${offLimbSize}px;
}

/* Limb plate: ${BODY_DIAMETER_PX} px = raster.json emission.bodyDiameter = camera.logicalBodyDiameter. */
${s} .${id}-limb-layer {
  background-image: var(--${id}-limb-image);
  background-position: center;
  background-repeat: no-repeat;
  background-size:
    ${BODY_DIAMETER_PX}px
    ${BODY_DIAMETER_PX}px;
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

/** A radius in solar radii for the panel: whole numbers for giants, two significant figures below ten (0.65 for a K dwarf, not 1). */
export const solarRadii = (value: number): string => value >= 10 ? String(Math.round(value)) : String(Number(value.toPrecision(2)));

/** Every file of a new shape-only placed star, keyed by repository path. Pure: the caller writes them. */
export function scaffoldStarFiles(spec: StarScaffold, bodyRecord: unknown, epochJdTt: number): Map<string, string> {
  if (!/^[a-z][a-z0-9-]*$/u.test(spec.id)) throw new TypeError('A star needs a lowercase id.');
  const blackHole = spec.blackHole;
  const temperature = blackHole || spec.neutronStar ? null : readStarTemperature({ effectiveTemperatureK: spec.temperatureK, effectiveTemperatureSource: spec.temperatureSource });
  // A black hole's sphere is its shadow, drawn black; its catalogue dot has no measured color.
  const color = temperature ? temperatureCatalogueColor(temperature.kelvin) : blackHole ? SHADOW_BLACK : NEUTRAL_GRAY, catalogColor = temperature ? color : NEUTRAL_GRAY;
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
  put(`${o}/object.json`, { schema: OBJECT_SCHEMA, id, type: 'layered-body', properties: {
    preparation: { schema: 'cssearth-object-preparation@1', label: name, steps: ['verify-sources', 'assets', 'panel-content', 'datasets', 'starfield', 'scene', 'controls', 'presentation', 'runtime-assets'] },
    recipe: { schema: AUTHORED_OBJECT_SCHEMA, surfaces: [{ id: 'body', source: 'geometry', projection: 'equirectangular', datasets: [{ id: 'shape', source: 'content', material: 'emission' }] }],
      shape: { kind: 'sphere', radiusKm }, materials: [{ id: 'emission', source: 'raster', model: 'emissive' }],
      sources: ['raster', 'geometry', 'presentation'].map(source => ({ id: source, path: `source/preparation/${source}.json` })).concat([
        { id: 'content', path: 'source/content/object.json' }, { id: 'solar-system', path: 'source/presentation/solar-system.json' }, { id: 'rotation', path: 'source/preparation/rotation.json' },
        { id: 'navigation', path: 'source/preparation/navigation.json' }, { id: 'acquisition', path: 'source/preparation/acquisition.json' }]),
      emission: { source: 'raster', material: 'emission' } },
    page: { stylesheets: ['src/renderers/css/styles/body-surfaces.css', `src/renderers/css/styles/${id}-surfaces.css`], metadata: { url: 'prepared/page.json' } },
    catalog: { name, classification: blackHole ? 'black-hole' : 'star', color: catalogColor, distanceAu: Math.round(Math.hypot(...originM) / AU_M * 10) / 10, description: spec.description, systemName: spec.system, ...(spec.aliases?.length ? { aliases: spec.aliases } : {}), order: spec.order ?? 1100, context: { order: (spec.order ?? 1100) - 3 }, ...(spec.featured ? { featured: true } : {}) },
    // A first frame for the catalogue; preparation replaces it with the prepared presentation frame.
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt, originM, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 0, 1], metersPerUnit: radiusKm * 1000 / BODY_RADIUS_UNITS, bodyRadiusM: radiusKm * 1000 } },
    prepared: { format: PREPARED_CSS_OBJECT_FORMAT, url: 'prepared/object.json' } });
  put(`${o}/source/preparation/raster.json`, { schema: 'cssearth-raster-recipe@2', publicBase: `/scenes/${id}/`, sourceWidth: 1024, sourceHeight: 512, width: 1024, height: 512, latitudeBands: 16, polarTile: 256,
    resample: 'density-before-pack', polarProjection: 'orthographic-bilinear', polesOutput: `${id}-poles-{id}{suffix}.webp`, surfaceMetadata: { schema: `css${id}-prepared-assets@1` },
    thumbnail: { size: 64, centerLongitudeDegrees: 0 },
    surfaces: [{ id: 'shape', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-dataset-{id}.webp`, source: 'measurements.json', falseColor: false,
      science: blackHole ? { kind: 'black-shadow', qualification: 'The measured shadow drawn as a black disc that always faces the viewer. A display convention; not an event horizon, a surface or a measured color. No lighting.' }
        : { kind: 'neutral-shape', qualification: 'Shared neutral gray display convention for a photosphere with no image in this package; a sphere of the published radius, self-luminous, so no lighting.' } }],
    emission: { offLimbSize, limbSize: 512, bodyDiameter: BODY_DIAMETER_PX, offLimbOutput: `${id}-context-{id}{suffix}.webp`, limbOutput: `${id}-limb-{id}{suffix}.webp`, metadata: {
      schema: `css${id}-prepared-emission@1`, presentation: 'prepared-emissive-surface-with-stationary-off-limb-context-and-limb-plate',
      offLimbContext: { logicalSize: offLimbSize, source: 'none: no observation, a transparent plate', composition: 'transparent', rotation: 'none', runtimeAlphaProcessing: false },
      limbMaterial: { logicalSize: BODY_DIAMETER_PX, composition: "transparent: the sphere's own silhouette is the limb; the light just outside it is on the off-limb plate", surfaceReplacement: false, runtimeAlphaProcessing: false },
      lighting: false, shadows: false, runtimeLighting: false } } });
  put(`${o}/source/preparation/geometry.json`, { schema: 'cssearth-css-geometry-profile@1', namespace: id, surface: { radius: BODY_RADIUS_UNITS, polarRadius: BODY_RADIUS_UNITS, latitudeSegments: 16, longitudeSegments: 32,
    surface: { url: `/scenes/${id}/${id}-surface-shape@2x.webp`, width: 1024, height: 768 }, surfaceLatitudeHeight: 512, packedBandGutter: 8,
    poles: { url: `/scenes/${id}/${id}-poles-shape@2x.webp`, width: 512, height: 256 }, polarTileSize: 256, polarRadiusScale: 1.035, polarOffset: 0.1, uv: 'cell', color },
    projection: sphereProjection(1, 1024 / 32),
    bodyRotationDegrees: 0, output: { schema: `css${id}-prepared-runtime-scene@1`, materialSchema: `css${id}-prepared-emission@1`, layout: 'body-container', body: { axialTiltDegrees: 0, rotationDirection: 'prograde', rotationPeriodEarthDays: 36525,
      sourceProjection: 'no observation: the shared neutral gray of an unresolved surface on the reference sphere', polarPreparation: 'the same gray on the polar tiles',
      axialTiltNote: "the star has no measured rotation axis; the object's rotation record places a display axis along celestial north in the plane of the sky, and this profile's tilt is not used for the frame" } } });
  put(`${o}/source/preparation/presentation.json`, { schema: 'cssearth-css-presentation-profile@2', namespace: id, mode: 'emissive' });
  put(`${o}/source/preparation/navigation.json`, { schema: 'cssearth-navigation-marker@2', objectId: id, owner: 'object', presentation: { size: 5 }, source: { path: 'presentation/context.png' },
    operations: [{ type: 'resize', width: 'tile', height: 'tile', fit: 'cover', position: 'centre', kernel: 'lanczos3' },
      { type: 'ensure-alpha' }, { type: 'ellipse-mask', cx: .5, cy: .5, rx: .45, ry: .45, shading: { ambient: .35, diffuse: .65 } }, { type: 'png' }], context: { pixels: 512 } });
  put(`${o}/source/preparation/rotation.json`, { schema: DISPLAY_ORIENTATION_SCHEMA, ...orientation, phase: 'arbitrary-display-phase',
    source: `No measured rotation axis or period (${TODO}: name the literature checked). The display axis is celestial north at the catalogue position, placed in the plane of the sky; computed by skyPlaneOrientation in @cssearth/astronomy.`,
    coordinateSystem: 'ICRF/J2000. +Z is the display axis: the sky-north direction at the star, in the plane of the sky. +X is the display meridian, set so that grid longitude 0 faces the Sun and Earth at the scene epoch; east longitude. No spin is propagated.',
    qualification: `Display convention, not a measurement. The rotation axis, spin sense, period and prime meridian of ${name} are unmeasured; the axis shown is where celestial north lies on the sky.` });
  put(`${o}/source/preparation/acquisition.json`, { schema: 'cssearth-acquisition-plan@1', operations: [] });
  put(`${o}/source/presentation/solar-system.json`, { schema: 'cssearth-solar-system-preparation@1', bodyId: id, displayName: name, bodyRadiusUnits: BODY_RADIUS_UNITS, bodyRadiusKilometers: radiusKm,
    defaultZoom: 1.25, geometryScale: GEOMETRY_SCALE });
  if (blackHole) put(`${o}/source/measurements.json`, { schema: 'cssearth-black-hole-shadow@1', id, angularDiameterMas: Math.round(angularDiameterMas * 1e6) / 1e6,
    angularDiameterSource: blackHole.shadowSource, distanceParsecs: astrometry.distanceParsecs, distanceSource: requireString(requireRecord(star.sources).distance),
    radiusKm, radiusSource: String(body.physicalNotes ?? TODO),
    shape: { kind: 'shadow-sphere', qualification: 'A black sphere at the measured shadow radius: the dark region an observer sees, not an event horizon or a surface.' } });
  else if (temperature) put(`${o}/source/measurements.json`, { schema: UNIFORM_DISC_STAR_SCHEMA, id, angularDiameterMas: Math.round(angularDiameterMas * 100) / 100,
    angularDiameterSource: `${TODO}: the published angular diameter and its source; this value is the record's radius at its distance.`, distanceParsecs: astrometry.distanceParsecs,
    distanceSource: requireString(requireRecord(star.sources).distance), radiusKm, radiusSource: String(body.physicalNotes ?? TODO),
    effectiveTemperatureK: temperature.kelvin, effectiveTemperatureSource: temperature.source,
    shape: { kind: 'uniform-disc-sphere', qualification: 'A sphere at the published radius in the shared neutral gray; the photosphere of a star is not a solid surface and its limb is not sharp.' } });
  put(`${o}/source/content/object.json`, { schema: 'cssearth-object-content@2', version: 1, id, displayName: name,
    // A published fact names its source: the author replaces each TODO catalogue id with the entry the measurement record cites.
    panel: { facts: [
      { id: 'radius', label: 'Radius', value: `${solarRadii(radiusKm / SOLAR_RADIUS_KM)} solar radii`,
        source: { catalogueId: `${TODO}-radius-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'radiusKm; radiusSource' } },
      { id: 'distance', label: 'Distance from the Sun', value: `${Math.round(astrometry.distanceParsecs)} parsecs`,
        source: { catalogueId: `${TODO}-distance-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'distanceParsecs; distanceSource' } },
    ], moreFacts: [] },
    datasets: { titleKey: 'datasets', defaultDataset: 'shape', controls: [{ id: 'shape', label: 'Shape', qualification: 'A sphere of the published radius; the neutral gray is a display convention, not a measured color or brightness.',
      thumbnail: `${id}-dataset-shape.webp`, surface: `${id}-surface-shape@2x.webp`, poles: `${id}-poles-shape@2x.webp`, source: { id: `${id}-observational-measurements`, path: '../manifest.json', url: spec.paper },
      falseColor: false, notes: `No image of the photosphere is cast here (${TODO}: say why, and point at the ledger). Neutral gray marks an unresolved surface; the display axis is celestial north, a convention.` }] },
    settings: { titleKey: 'settings', controls: [] }, charts: [],
    resources: [{ label: 'Research', role: 'facts', description: spec.paperCredit, href: spec.paper }],
    provenance: { editorial: { url: spec.paper, credit: spec.paperCredit },
      physical: { path: `../../../../../packages/astronomy/data/bodies/${id}.json`, credit: 'Published radius at the catalogue distance; SIMBAD astrometry; no measured rotation axis (display convention)' } } });
  put(`${o}/text.json`, { schema: OBJECT_TEXT_SCHEMA, objectId: id, card: { text: spec.description, sources: [{ catalogueId: `${TODO}-card-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    introduction: { text: `${TODO}: two sentences, 180 characters at most.`, sources: [{ catalogueId: `${TODO}-introduction-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    datasets: { shape: { title: 'Sphere of the measured radius', detail: 'No image', summary: 'A sphere at the published size in neutral gray. No picture of the surface is cast here.' } } });
  put(`${o}/README.md`, `# ${name}\n\n## Sources\n\n${TODO}: placement, radius, rotation and the shape dataset, each with its source.\n\n## Evidence\n\n${TODO}: the tests and captures that prove the package.\n\n## Known problems\n\n${TODO}: what is not shown and why.\n\n[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)\n`);
  put(`${o}/NOTICE.md`, `# ${name} credits\n\n${TODO}: the measurements and placement credits.\n`);
  // Empty, like the TODO prose: `pnpm check:investigations` refuses it until the sources examined are recorded (new-object
  // writes its own choices over it, ledger.mts).
  put(`${o}/investigations.json`, { schema: 'cssearth-investigation-ledger@1', objectId: id, entries: [] });
  const local = (reason: string) => ({ kind: 'local', reason });
  const preparation = (entryId: string, path: string, origin: string, consumers: string[]) => ({ id: `${id}-${entryId}`, path, origin, sourceBinding: local('Project-authored preparation record; published inputs retain their own identities and hashes.'),
    credit: 'cssEarth and the institutional sources identified in this record', license: 'Project-authored preparation record; referenced observations retain their source terms', acquisition: 'checked repository source', redistribution: 'checked authored source with embedded provenance', consumers });
  put(`${o}/source/manifest.json`, { schema: SOURCE_MANIFEST_SCHEMA, inputs: [
    { id: `${id}-observational-measurements`, path: 'measurements.json', origin: spec.paper, credit: spec.paperCredit, license: 'Factual numerical measurements; source attribution retained', acquisition: 'Transcribed published measurements with their sources', redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['shape-model'], sourceBinding: local('Measurements transcribed in this package with their sources; repinned when edited.') },
    preparation('preparation-raster', 'preparation/raster.json', 'Repository-authored raster recipe: the shared neutral gray on the reference sphere, transparent plates', ['assets', 'datasets']),
    preparation('preparation-geometry', 'preparation/geometry.json', 'Repository-authored CSS geometry profile: 248-unit sphere, 16 x 32 leaves, emissive material', ['scene', 'presentation']),
    preparation('preparation-presentation', 'preparation/presentation.json', 'Repository-authored presentation profile: emissive mode', ['presentation']),
    preparation('physical-solar-system-recipe', 'presentation/solar-system.json', 'Repository-authored scene recipe: published radius, camera plan', ['scene'])],
    generatedIntermediates: [{ id: 'neutral-disc-context-marker', path: 'presentation/context.png', origin: spec.paper, credit: `Sphere of the published radius; marker written by packages/telescope-cli/src/new-object/new-object-cli.mts`, license: 'Project-authored display derivative.', consumers: ['navigation'],
      recipe: { generator: 'packages/telescope-cli/src/new-object/new-object-cli.mts', inputs: [`${id}-observational-measurements`] }, generator: 'packages/telescope-cli/src/new-object/new-object-cli.mts', sourceBinding: local('A flat neutral gray disc, the marker of an unresolved surface.') }],
    documents: ['content/object.json', 'preparation/acquisition.json', 'preparation/navigation.json', 'preparation/rotation.json'].map(path => ({ path,
      // Provenance refuses a document without a binding; the content record is authored here.
      ...(path === 'content/object.json' ? { sourceBinding: local('Project-authored factsheet, dataset recipe and legend.') } : {}) })) });
  put(`src/renderers/css/styles/${id}-surfaces.css`, starStylesheet(id, name, offLimbSize, 'Both plates are transparent: no observation is cast.'));
  return files;
}

export async function scaffoldStar(spec: StarScaffold, { SOLAR_GEOMETRY_EPOCH_JD_TT }: Pick<SolarEpoch, 'SOLAR_GEOMETRY_EPOCH_JD_TT'>, root = process.cwd()) {
  if (await stat(resolve(root, 'src/objects', spec.id)).then(() => true, () => false)) throw new Error(`src/objects/${spec.id} already exists; the scaffold never overwrites a package.`);
  const record = JSON.parse(await readFile(resolve(root, 'packages/astronomy/data/bodies', `${spec.id}.json`), 'utf8')) as unknown;
  const files = scaffoldStarFiles(spec, record, SOLAR_GEOMETRY_EPOCH_JD_TT);
  for (const [path, text] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); }
  const presentation = resolve(root, 'src/objects', spec.id, 'source/presentation');
  await writeFile(resolve(presentation, 'context.png'), await neutralDiscMarker());
  return [...files.keys(), `src/objects/${spec.id}/source/presentation/context.png`];
}
