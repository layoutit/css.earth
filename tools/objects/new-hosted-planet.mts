#!/usr/bin/env node
/** Scaffold a planet of another star from its astronomy record, instead of cloning another planet by find-and-replace.
 *
 *   node tools/objects/new-hosted-planet.mts <id> --name <display name> --system <system name>
 *     --description <catalogue line> --paper <url> --paper-credit <credit> [--order <n>] [--color <#rrggbb>]
 *
 * Requires packages/astronomy/data/bodies/<id>.json with a `hostedOrbit` and a `physical.parent` that is a placed star.
 * Every number here comes from those two records: the world-frame origin at the scene epoch, the radius facts, the
 * circular synchronous rotation the orbit implies and the light direction its star gives. The package starts shape-only, in the
 * shared neutral gray, lit by its own star: no colour of these planets is measured. Prose the scaffold cannot know
 * (reader text, README, credits, ledger) carries the marker TODO(new-hosted-planet).
 * Then run: node tools/prepare-object.mts <id> */
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostedPlanetStateRelativeKm, starStateFromAstrometryKm } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '../source-values.mts';

export const TODO = 'TODO(new-hosted-planet)';
const AU_M = 149597870700, BODY_RADIUS_UNITS = 248;
/** The shared neutral gray of an unresolved surface, as the shape-only bodies use. */
const NEUTRAL_GRAY = '#9a9a9a';
const INTER_URL = 'https://raw.githubusercontent.com/rsms/inter/9221beed3/docs/font-files/InterVariable.ttf';

export interface HostedPlanetScaffold {
  readonly id: string; readonly name: string; readonly system: string; readonly description: string;
  readonly paper: string; readonly paperCredit: string; readonly order?: number; readonly color?: string;
}

/** Every file of a new shape-only planet of another star, keyed by repository path. Pure: the caller writes them. */
export function scaffoldHostedPlanetFiles(spec: HostedPlanetScaffold, bodyRecord: unknown, hostRecord: unknown, epochJdTt: number): Map<string, string> {
  if (!/^[a-z][a-z0-9-]*$/u.test(spec.id)) throw new TypeError('A planet needs a lowercase id.');
  const body = requireRecord(bodyRecord, 'astronomy record'), physical = requireRecord(body.physical, 'physical');
  const orbit = requireRecord(body.hostedOrbit, 'hosted orbit'), host = requireRecord(hostRecord, 'host astronomy record');
  if (body.id !== spec.id) throw new TypeError(`The astronomy record is for ${String(body.id)}, not ${spec.id}.`);
  const hostId = requireString(physical.parent, 'physical.parent');
  if (host.id !== hostId) throw new TypeError(`${spec.id} orbits ${hostId}, but the host record is ${String(host.id)}.`);
  const eccentricity = requireFiniteNumber(orbit.eccentricity);
  if (eccentricity !== 0) throw new TypeError(`Cannot scaffold ${spec.id}: synchronous rotation requires a circular hosted orbit. Supply an explicit authored rotation law for eccentricity ${eccentricity}.`);
  const star = requireRecord(host.star, 'host star astrometry');
  const astrometry = { rightAscensionDegrees: requireFiniteNumber(star.rightAscensionDegrees), declinationDegrees: requireFiniteNumber(star.declinationDegrees),
    positionEpochJulianYear: requireFiniteNumber(star.positionEpochJulianYear), distanceParsecs: requireFiniteNumber(star.distanceParsecs),
    properMotionRaMasPerYear: requireFiniteNumber(star.properMotionRaMasPerYear), properMotionDecMasPerYear: requireFiniteNumber(star.properMotionDecMasPerYear),
    radialVelocityKmPerS: requireFiniteNumber(star.radialVelocityKmPerS) };
  const radiusKm = requireFiniteNumber(physical.meanRadiusKm), { id, name } = spec, color = spec.color ?? NEUTRAL_GRAY;
  const hostKm = starStateFromAstrometryKm(astrometry, epochJdTt).positionKm;
  const relativeKm = hostedPlanetStateRelativeKm(id as Parameters<typeof hostedPlanetStateRelativeKm>[0], epochJdTt).positionKm;
  const originM = hostKm.map((value, axis) => (value + relativeKm[axis]!) * 1000);
  const periodDays = requireFiniteNumber(orbit.periodDays);
  const files = new Map<string, string>(), put = (path: string, value: unknown) => files.set(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  const o = `src/objects/${id}`;
  const order = spec.order ?? 1100;

  put(`${o}/object.json`, { schema: 'cssearth-object@1', id, type: 'layered-body', properties: {
    preparation: { schema: 'cssearth-object-preparation@1', label: name,
      steps: ['verify-sources', 'title', 'assets', 'panel-content', 'lenses', 'starfield', 'sky-sun', 'system-markers', 'scene', 'controls', 'presentation', 'runtime-assets'] },
    recipe: { schema: 'cssearth-authored-object@1',
      surfaces: [{ id: 'body', source: 'geometry', projection: 'equirectangular', lenses: [{ id: 'shape', source: 'content', material: 'lighting' }] }],
      shape: { kind: 'sphere', radiusKm }, materials: [{ id: 'lighting', source: 'raster', model: 'lit' }],
      sources: ['raster', 'geometry', 'celestial', 'presentation'].map(source => ({ id: source, path: `source/preparation/${source}.json` })).concat([
        { id: 'content', path: 'source/content/object.json' }, { id: 'solar-system', path: 'source/presentation/solar-system.json' }, { id: 'rotation', path: 'source/preparation/rotation.json' },
        { id: 'title', path: 'source/presentation/title-mark.json' }, { id: 'navigation', path: 'source/preparation/navigation.json' }, { id: 'acquisition', path: 'source/preparation/acquisition.json' }]) },
    page: { stylesheets: ['src/renderers/css/styles/planet-surfaces.css'], metadata: { url: 'prepared/page.json' } },
    catalog: { name, classification: 'exoplanet', color, distanceAu: Math.round(Math.hypot(...originM) / AU_M * 10) / 10,
      description: spec.description, systemName: spec.system, order, context: { order } },
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt, originM, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 0, 1],
      metersPerUnit: radiusKm * 1000 / BODY_RADIUS_UNITS, bodyRadiusM: radiusKm * 1000 } },
    prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json', sha256: '0'.repeat(64) } });

  put(`${o}/source/preparation/raster.json`, { schema: 'cssearth-raster-recipe@1', publicBase: `/scenes/${id}/`, sourceWidth: 1024, sourceHeight: 512, width: 1024, height: 512,
    latitudeBands: 16, polarTile: 256, resample: 'density-before-pack', polarProjection: 'orthographic-bilinear', polesCombined: false,
    polesOutput: `${id}-poles-{id}{suffix}.webp`, surfaceMetadata: { schema: `css${id}-prepared-assets@1` }, thumbnail: { size: 64, quality: 88, centerLongitudeDegrees: 0 },
    surfaces: [{ id: 'shape', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-lens-{id}.webp`, source: 'measurements.json', falseColor: false,
      science: { kind: 'neutral-shape', qualification: 'Shared neutral gray display convention for a planet with no image or measured colour in this package; a sphere of the published radius, lit by its own star.' } }],
    lighting: { frameSize: 512, columns: 8, presentationSize: 460, defaultFrame: 230, billboardFrameSize: 24, billboardColumns: 16,
      rowOutput: `${id}-lighting-{density}x-row-{row}.webp`, billboardOutput: `${id}-lighting-{density}x-billboard.webp`,
      minimumLightViewZ: -1, maximumLightViewZ: 1, frameCount: 256, shadowlessFloodLimbFloor: 0.35, ambientIntensity: 0.05, radiusScale: 0.505,
      terminator: [0, 0.1], maximumAlpha: 0.95, bankSchema: `css${id}-prepared-lighting-bank@1`, billboardSchema: `css${id}-prepared-lighting-billboard@1`,
      metadata: { schema: `css${id}-prepared-lighting@1`, storageModel: 'prepared-full-resolution-density-row-shards',
        model: 'prepared-full-phase-lambert-cubic-sky-sun-no-atmosphere',
        sourceRenderer: 'OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl', ambientIntensity: 0.05,
        shadowlessFloodLimbFloor: 0.35, orenNayarRoughness: 0, terminatorSmoothstep: [0, 0.1], minimumLightViewZ: -1, maximumLightViewZ: 1,
        baseLightAzimuthDegrees: 0, cameraContract: 'unbounded-accumulated-matrix3d-phase-and-roll', runtimeRasterization: false } } });

  put(`${o}/source/preparation/geometry.json`, { schema: 'cssearth-css-geometry-profile@1', namespace: id,
    surface: { radius: BODY_RADIUS_UNITS, polarRadius: BODY_RADIUS_UNITS, latitudeSegments: 16, longitudeSegments: 32,
      surface: { url: `/scenes/${id}/${id}-surface-shape@2x.webp`, width: 1024, height: 768 }, surfaceLatitudeHeight: 512, packedBandGutter: 8,
      poles: { url: `/scenes/${id}/${id}-poles-shape@2x.webp`, width: 512, height: 256 }, polarTileSize: 256, polarRadiusScale: 1.035, polarOffset: 0.1, uv: 'cell', color },
    projection: { tileSize: 50, layerElevation: 50, seamBleed: 24, interiorSeamBleed: 8, overlap: 0.008, fitToSource: false, rasterScale: 2, rasterGutter: 8, rasterOverscan: 0,
      positionVariables: false, projectivePoles: false, lightColor: '#ffffff', ambientIntensity: 0.05 },
    bodyRotationDegrees: 0, output: { schema: `css${id}-prepared-runtime-scene@1`, materialSchema: `css${id}-prepared-lighting@1`, layout: 'body-container',
      body: { axialTiltDegrees: 0, rotationDirection: 'prograde', rotationPeriodEarthDays: periodDays,
        sourceProjection: 'no observation: the shared neutral gray of an unresolved surface on the reference sphere',
        polarPreparation: 'the same gray on the polar tiles',
        axialTiltNote: "no obliquity of this planet is measured; the rotation record assumes the spin axis on the orbit normal, as tidal locking implies" } } });

  put(`${o}/source/preparation/celestial.json`, { schema: 'cssearth-celestial-preparation@2', sources: ['presentation/solar-system.json'] });
  put(`${o}/source/preparation/presentation.json`, { schema: 'cssearth-css-presentation-profile@1', namespace: id, mode: 'composite' });
  put(`${o}/source/preparation/navigation.json`, { schema: 'cssearth-navigation-marker@1', planetId: id, owner: 'object', presentation: { size: 5 },
    source: { path: 'presentation/context.png' }, operations: [{ type: 'resize', width: 'tile', height: 'tile', fit: 'cover', position: 'centre', kernel: 'lanczos3' }, { type: 'png' }],
    context: { pixels: 512 } });
  put(`${o}/source/preparation/rotation.json`, { schema: 'cssearth-synchronous-rotation@1', host: hostId,
    source: `Assumed synchronous rotation: a planet ${Math.round(requireFiniteNumber(orbit.semiMajorAxisStellarRadii))} stellar radii from its star is expected to be tidally locked, and no rotation period of ${name} is measured (${TODO}: name the literature checked). Pole, prime meridian and rate are computed from the hosted orbit in packages/astronomy/data/bodies/${id}.json.`,
    coordinateSystem: 'ICRF/J2000. +Z is the orbit normal (prograde spin); +X points at the host star at each instant, so longitude 0 is the substellar point; east longitude, the direction of rotation.',
    qualification: `Tidal locking and a spin axis on the orbit normal are assumptions, not measurements: neither the rotation period nor the obliquity of ${name} is measured.` });
  put(`${o}/source/preparation/acquisition.json`, { schema: 'cssearth-acquisition-plan@1',
    operations: [{ kind: 'download', groups: ['restore', 'refresh'], path: 'presentation/InterVariable.ttf', url: INTER_URL }] });
  put(`${o}/source/presentation/solar-system.json`, { schema: 'cssearth-solar-system-preparation@1', bodyId: id, displayName: name,
    bodyRadiusUnits: BODY_RADIUS_UNITS, bodyRadiusKilometers: radiusKm, defaultZoom: 1.25, geometryScale: 1.25 });
  put(`${o}/source/measurements.json`, { schema: 'cssearth-hosted-planet@1', id, radiusKm, radiusSource: String(body.physicalNotes ?? TODO),
    orbitalPeriodDays: periodDays, orbitalPeriodSource: requireString(requireRecord(orbit.sources).period, 'hosted orbit period source'),
    shape: { kind: 'sphere', qualification: `A sphere at the published radius in the shared neutral gray. No image, colour, map or oblateness of ${name} is measured; only its size, mass and orbit are.` } });
  put(`${o}/source/content/object.json`, { schema: 'cssearth-object-content@1', version: 1, id, displayName: name,
    panel: { facts: [
      { id: 'radius', label: 'Radius', value: `${TODO}: the radius in Earth radii`,
        source: { catalogueId: `${TODO}-radius-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'radiusKm; radiusSource' } },
      { id: 'period', label: 'Year', value: `${TODO}: the orbital period in days`,
        source: { catalogueId: `${TODO}-period-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'orbitalPeriodDays; orbitalPeriodSource' } }], moreFacts: [] },
    lenses: { titleKey: 'lenses', defaultLens: 'shape', controls: [{ id: 'shape', label: 'Shape', qualification: `A sphere of the published radius, lit by ${spec.system.replace(' system', '')}; the neutral gray is a display convention, not a measured colour.`,
      thumbnail: `${id}-lens-shape.webp`, surface: `${id}-surface-shape@2x.webp`, poles: `${id}-poles-shape@2x.webp`,
      source: { id: `${id}-observational-measurements`, path: '../manifest.json', url: spec.paper }, falseColor: false,
      notes: `No image or colour of this planet exists (${TODO}: say why, and point at the ledger). The gray marks an unresolved surface; the lighting is its own star's, at the measured orbit.` }] },
    // A lit body's prepared variants bind the shared shadows toggle.
    settings: { titleKey: 'settings', controls: [{ kind: 'toggle', name: 'shadows', label: 'Shadows', checked: false }] }, charts: [],
    resources: [{ label: 'Research', role: 'facts', description: spec.paperCredit, href: spec.paper }],
    provenance: { title: { path: '../presentation/title-mark.json' }, editorial: { url: spec.paper, credit: spec.paperCredit },
      physical: { path: `../../../../../packages/astronomy/data/bodies/${id}.json`, credit: `Published radius, mass and transit-fitted orbit; ${TODO}` } } });
  put(`${o}/text.json`, { schema: 'cssearth-object-text@1', objectId: id,
    card: { text: `${TODO}: one sentence, 110 characters at most.`, sources: [{ catalogueId: `${TODO}-card-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    introduction: { text: `${TODO}: two sentences, 180 characters at most.`, sources: [{ catalogueId: `${TODO}-introduction-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    datasets: { shape: { title: 'Shape only', detail: 'Published radius', summary: `${TODO}: what the sphere is and is not, 125 characters at most.` } } });
  put(`${o}/.gitignore`, '# No observation files: the sphere is the shared neutral gray.\n');
  const pin = { expectedBytes: 0, expectedSha256: '0'.repeat(64) }, local = (reason: string) => ({ kind: 'local', reason });
  const catalogued = (entryId: string, index: number) => ({ kind: 'catalogued', references: [{ catalogueId: `source-${id}-${entryId}`, role: 'material', evidence: 'Origin and product identifier recorded on this manifest entry.' }] });
  const preparation = (entryId: string, path: string, origin: string, consumers: string[]) => ({ id: `${id}-${entryId}`, path, ...pin, origin,
    sourceBinding: local('Project-authored preparation record; published inputs retain their own identities and hashes.'),
    credit: 'cssEarth and the institutional sources identified in this record', license: 'Project-authored preparation record; referenced observations retain their source terms',
    acquisition: 'checked repository source', redistribution: 'checked authored source with embedded provenance', consumers });
  put(`${o}/source/manifest.json`, { schema: `css${id}-authoritative-sources@2`, inputs: [
    { id: `${id}-observational-measurements`, path: 'measurements.json', ...pin, origin: spec.paper, credit: spec.paperCredit,
      license: 'Factual numerical measurements; source attribution retained', acquisition: 'Transcribed published measurements with their sources',
      redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['shape-model'],
      sourceBinding: local('Measurements transcribed in this package with their sources; repinned when edited.') },
    { id: 'inter-title-font', path: 'presentation/InterVariable.ttf', expectedBytes: 862936, expectedSha256: '746431e950fd28d29b0189d708d4a5852a8458edb3184387eadcee9e5e34676c',
      origin: INTER_URL, credit: 'Inter Project Authors / Rasmus Andersson', license: 'SIL Open Font License 1.1', licenseEvidence: ['presentation/LICENSE.INTER-OFL'],
      acquisition: 'Restore exact Inter font pin through source/preparation/acquisition.json.', redistribution: 'Permitted with the accompanying SIL Open Font License.',
      consumers: ['title'], sourceBinding: catalogued('inter-title-font', 1) },
    preparation('preparation-raster', 'preparation/raster.json', 'Repository-authored raster recipe: the shared neutral gray on the reference sphere, lit by the host star', ['assets', 'lenses']),
    preparation('preparation-geometry', 'preparation/geometry.json', 'Repository-authored CSS geometry profile: 248-unit sphere, 16 x 32 leaves, lit material', ['scene', 'presentation']),
    preparation('preparation-celestial', 'preparation/celestial.json', 'Repository-authored celestial recipe: astrometric sky registration and the host star as the light', ['starfield', 'sky-sun']),
    preparation('preparation-presentation', 'preparation/presentation.json', 'Repository-authored presentation profile: composite mode', ['presentation']),
    preparation('physical-solar-system-recipe', 'presentation/solar-system.json', 'Repository-authored scene recipe: published radius, camera plan', ['scene'])],
    generatedIntermediates: [{ id: 'neutral-disc-context-marker', path: 'presentation/context.png', ...pin, origin: spec.paper,
      credit: 'Sphere of the published radius; marker written by tools/objects/new-hosted-planet.mts', license: 'Project-authored display derivative.', consumers: ['navigation'],
      recipe: { generator: 'tools/objects/new-hosted-planet.mts', inputs: [`${id}-observational-measurements`] }, generator: 'tools/objects/new-hosted-planet.mts',
      sourceBinding: local('A flat neutral gray disc, the marker of an unresolved surface.') }],
    documents: ['content/object.json', 'preparation/acquisition.json', 'preparation/navigation.json', 'preparation/rotation.json', 'presentation/LICENSE.INTER-OFL', 'presentation/title-mark.json'].map(path => ({ path, ...pin,
      ...(path === 'content/object.json' ? { sourceBinding: local('Project-authored factsheet, dataset recipe and legend.') } : {}) })) });
  put(`${o}/README.md`, `# ${name}\n\n## Sources\n\n${TODO}: what is measured, what is not, and where each number comes from.\n\n## Evidence\n\n${TODO}\n\n## Known problems\n\n${TODO}\n\n[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)\n`);
  put(`${o}/NOTICE.md`, `# ${name} credits\n\n${TODO}: the sources this package redistributes and their terms.\n`);
  put(`${o}/investigations.json`, { schema: 'cssearth-investigation-ledger@1', objectId: id, entries: [] });
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const flag = (name: string) => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1]; };
  const id = args.find((argument, index) => !argument.startsWith('--') && !args[index - 1]?.startsWith('--'));
  if (!id) throw new TypeError('Usage: new-hosted-planet <id> --name <name> --system <system> --description <line> --paper <url> --paper-credit <credit>');
  const root = resolve(import.meta.dirname, '../..');
  const exists = (path: string) => stat(resolve(root, path)).then(() => true, () => false);
  if (await exists(`src/objects/${id}`)) throw new Error(`src/objects/${id} already exists; the scaffold never overwrites a package.`);
  // Everything the scaffold copies is checked before a file is written, so a missing input never leaves half a package.
  const font = 'src/objects/themis/source/presentation/InterVariable.ttf', license = 'src/objects/betelgeuse/source/presentation/LICENSE.INTER-OFL';
  for (const path of [font, license]) if (!await exists(path)) throw new Error(`${path} is missing; restore it (pnpm setup:assets) before scaffolding.`);
  const order = flag('order'), color = flag('color');
  if (order !== undefined && !Number.isSafeInteger(Number(order))) throw new TypeError(`--order must be a whole number, not ${order}.`);
  if (color !== undefined && !/^#[0-9a-f]{6}$/iu.test(color)) throw new TypeError(`--color must be #rrggbb, not ${color}.`);
  const read = async (path: string) => JSON.parse(await readFile(resolve(root, path), 'utf8')) as unknown;
  const body = requireRecord(await read(`packages/astronomy/data/bodies/${id}.json`), 'astronomy record');
  const hostId = requireString(requireRecord(body.physical, 'physical').parent, 'physical.parent');
  const { SOLAR_GEOMETRY_EPOCH_JD_TT } = await import('../../src/platform/solar-geometry.mts') as { SOLAR_GEOMETRY_EPOCH_JD_TT: number };
  const files = scaffoldHostedPlanetFiles({
    id, name: requireString(flag('name'), '--name'), system: requireString(flag('system'), '--system'),
    description: requireString(flag('description'), '--description'), paper: requireString(flag('paper'), '--paper'),
    paperCredit: requireString(flag('paper-credit'), '--paper-credit'),
    ...(order === undefined ? {} : { order: Number(order) }), ...(color === undefined ? {} : { color }),
  }, body, await read(`packages/astronomy/data/bodies/${hostId}.json`), SOLAR_GEOMETRY_EPOCH_JD_TT);
  for (const [path, text] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); }
  const { neutralDiscMarker } = await import('./new-star.mts');
  const presentation = resolve(root, 'src/objects', id, 'source/presentation');
  await copyFile(resolve(root, license), resolve(presentation, 'LICENSE.INTER-OFL'));
  await writeFile(resolve(presentation, 'context.png'), await neutralDiscMarker());
  await copyFile(resolve(root, font), resolve(presentation, 'InterVariable.ttf'));
  console.log(`${files.size + 3} files written. Replace every ${TODO}, then: node tools/prepare-object.mts ${id}`);
}
