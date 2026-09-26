#!/usr/bin/env node
/** Scaffold a planet of another star from its astronomy record, instead of cloning another planet by find-and-replace.
 *
 *   node tools/objects/new-hosted-planet.mts <id> --name <display name> --system <system name>
 *     --description <catalogue line> --paper <url> --paper-credit <credit> [--order <n>] [--color <#rrggbb>]
 *     [--rotation synchronous|unmeasured] [--self-luminous <K> --temperature-source <citation>]
 *
 * Requires packages/astronomy/data/bodies/<id>.json with a `hostedOrbit` and a `physical.parent` that is a placed star.
 * Every number here comes from those two records: the world-frame origin at the scene epoch, the radius facts, the
 * circular synchronous rotation the orbit implies and the light direction its star gives. A planet seen by its own heat (a young
 * giant imaged directly) takes --self-luminous with its cited effective temperature: it is built emissive, like the stars, with no
 * light from its host. A star on a hosted orbit (the second star of a pair that a planet orbits) is scaffolded the same way,
 * --self-luminous with its cited temperature, and keeps its star class and a temperature catalogue colour. The package starts shape-only, in the
 * shared neutral gray, lit by its own star: no colour of these planets is measured. Prose the scaffold cannot know
 * (reader text, README, credits, ledger) carries the marker TODO(new-hosted-planet).
 * Then run: node tools/prepare/prepare-object.mts <id> */
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { hostedKeplerElements, hostedPlanetStateRelativeKm, starStateFromAstrometryKm } from '@cssearth/astronomy';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { starStylesheet } from './new-object/scaffold.mts';
import { temperatureCatalogueColor } from './star-catalogue-color.mts';
import { sphereProjection } from './sphere-projection.mts';

export const TODO = 'TODO(new-hosted-planet)';
const AU_M = 149597870700, BODY_RADIUS_UNITS = 248;
/** A hosted planet's sphere is drawn 1.25 times its logical size (solar-system.json geometryScale). */
const GEOMETRY_SCALE = 1.25;
/** The shared neutral gray of an unresolved surface, as the shape-only bodies use. */
const NEUTRAL_GRAY = '#9a9a9a';

/** Static presentation for a hosted planet's 460px lighting frames. It names no lens image: each lens's variant writes the
 * textures every leaf reads (scene/projector.ts, presentation/composite.ts). */
export function hostedPlanetStylesheet(id: string): string {
  const scope = `.object-stage[data-object-id="${id}"]`;
  const scale = BODY_RADIUS_UNITS * 2 / 460;
  return `${scope} > .${id}-material-composite {
  position: absolute;
  inset: 0;
  transform-origin: 50% 50%;
  pointer-events: none;
  z-index: 2;
}
${scope} .polycss-scene s,
${scope} .${id}-fixed-material {
  position: absolute;
  display: block;
  margin: 0;
  padding: 0;
  line-height: 0;
  text-decoration: none;
  transform-origin: 0 0;
  backface-visibility: hidden;
  background-repeat: no-repeat;
  pointer-events: none;
}
${scope} .polycss-scene s {
  width: var(--polycss-atlas-width, var(--polycss-atlas-size, 64px));
  height: var(--polycss-atlas-height, var(--polycss-atlas-size, 64px));
  transform-style: preserve-3d;
}
/* The bank clips each frame at 460px; the silhouette binding uses a 496px reference disc. */
${scope} .${id}-fixed-material {
  top: 50%;
  left: 50%;
  width: 460px;
  height: 460px;
  transform-origin: 50% 50%;
  transform: translate(-50%, -50%) rotate(var(--${id}-light-roll, 0deg)) scale(${scale});
}
${scope}.${id}-hide-shadows .${id}-fixed-material {
  transform: translate(-50%, -50%) scale(${scale});
}
`;
}

export interface HostedPlanetScaffold {
  readonly id: string; readonly name: string; readonly system: string; readonly description: string;
  readonly paper: string; readonly paperCredit: string; readonly order?: number; readonly color?: string;
  /** `synchronous` (the default) assumes tidal locking on a circular orbit; `unmeasured` writes a display orientation whose axis is
   * the orbit normal and no spin, for a planet whose rotation is not measured and whose orbit may be eccentric. */
  readonly rotation?: 'synchronous' | 'unmeasured';
  /** A planet seen by its own heat, as a young giant imaged directly is: emissive like the stars, with transparent off-limb and
   * limb plates and no light from its host; the cited effective temperature is recorded beside its source. */
  readonly selfLuminous?: { readonly temperatureK: number; readonly source: string };
}

/** Every file of a new shape-only planet of another star, keyed by repository path. Pure: the caller writes them. */
export function scaffoldHostedPlanetFiles(spec: HostedPlanetScaffold, bodyRecord: unknown, hostRecord: unknown, epochJdTt: number): Map<string, string> {
  if (!/^[a-z][a-z0-9-]*$/u.test(spec.id)) throw new TypeError('A planet needs a lowercase id.');
  const body = requireRecord(bodyRecord, 'astronomy record'), physical = requireRecord(body.physical, 'physical');
  const orbit = requireRecord(body.hostedOrbit, 'hosted orbit'), host = requireRecord(hostRecord, 'host astronomy record');
  if (body.id !== spec.id) throw new TypeError(`The astronomy record is for ${String(body.id)}, not ${spec.id}.`);
  const hostId = requireString(physical.parent, 'physical.parent');
  if (host.id !== hostId) throw new TypeError(`${spec.id} orbits ${hostId}, but the host record is ${String(host.id)}.`);
  const eccentricity = requireFiniteNumber(orbit.eccentricity), rotation = spec.rotation ?? 'synchronous';
  if (eccentricity !== 0 && rotation === 'synchronous') throw new TypeError(`Cannot scaffold ${spec.id}: synchronous rotation requires a circular hosted orbit. Scaffold it with --rotation unmeasured and author the rotation law, or supply one, for eccentricity ${eccentricity}.`);
  const star = requireRecord(host.star, 'host star astrometry');
  const astrometry = { rightAscensionDegrees: requireFiniteNumber(star.rightAscensionDegrees), declinationDegrees: requireFiniteNumber(star.declinationDegrees),
    positionEpochJulianYear: requireFiniteNumber(star.positionEpochJulianYear), distanceParsecs: requireFiniteNumber(star.distanceParsecs),
    properMotionRaMasPerYear: requireFiniteNumber(star.properMotionRaMasPerYear), properMotionDecMasPerYear: requireFiniteNumber(star.properMotionDecMasPerYear),
    radialVelocityKmPerS: requireFiniteNumber(star.radialVelocityKmPerS) };
  // A companion star on a hosted orbit (the second star of a pair a planet orbits) keeps its class, and its catalogue colour is its
  // cited temperature through the star field's colour fit, as new-object gives a placed star.
  const classification = body.classification === 'star' ? 'star' : 'exoplanet';
  if (classification === 'star' && !spec.selfLuminous) throw new TypeError(`${spec.id} is a star on a hosted orbit: scaffold it --self-luminous with its cited temperature.`);
  const radiusKm = requireFiniteNumber(physical.meanRadiusKm), { id, name } = spec;
  const color = spec.color ?? (classification === 'star' ? temperatureCatalogueColor(spec.selfLuminous!.temperatureK) : NEUTRAL_GRAY);
  const hostKm = starStateFromAstrometryKm(astrometry, epochJdTt).positionKm;
  const relativeKm = hostedPlanetStateRelativeKm(id as Parameters<typeof hostedPlanetStateRelativeKm>[0], epochJdTt).positionKm;
  const originM = hostKm.map((value, axis) => (value + relativeKm[axis]!) * 1000);
  const periodDays = requireFiniteNumber(orbit.periodDays);
  const files = new Map<string, string>(), put = (path: string, value: unknown) => files.set(path, typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`);
  const o = `src/objects/${id}`;
  const order = spec.order ?? 1100;
  const glow = spec.selfLuminous, material = glow ? 'emission' : 'lighting';
  if (glow && !(glow.temperatureK > 0)) throw new TypeError(`${spec.id}: a self-luminous planet needs a positive effective temperature, not ${glow.temperatureK}.`);

  put(`${o}/object.json`, { schema: 'cssearth-object@1', id, type: 'layered-body', properties: {
    preparation: { schema: 'cssearth-object-preparation@1', label: name,
      steps: ['verify-sources', 'assets', 'panel-content', 'lenses', 'starfield', ...(glow ? [] : ['sky-sun']), 'system-markers', 'scene', 'controls', 'presentation', 'runtime-assets'] },
    recipe: { schema: 'cssearth-authored-object@1',
      surfaces: [{ id: 'body', source: 'geometry', projection: 'equirectangular', lenses: [{ id: 'shape', source: 'content', material }] }],
      shape: { kind: 'sphere', radiusKm }, materials: [{ id: material, source: 'raster', model: glow ? 'emissive' : 'lit' }],
      sources: ['raster', 'geometry', 'celestial', 'presentation'].map(source => ({ id: source, path: `source/preparation/${source}.json` })).concat([
        { id: 'content', path: 'source/content/object.json' }, { id: 'solar-system', path: 'source/presentation/solar-system.json' }, { id: 'rotation', path: 'source/preparation/rotation.json' },
        { id: 'navigation', path: 'source/preparation/navigation.json' }, { id: 'acquisition', path: 'source/preparation/acquisition.json' }]),
      ...(glow ? { emission: { source: 'raster', material: 'emission' } } : {}) },
    page: { stylesheets: ['src/renderers/css/styles/body-surfaces.css', `src/renderers/css/styles/${id}-surfaces.css`], metadata: { url: 'prepared/page.json' } },
    catalog: { name, classification, color, distanceAu: Math.round(Math.hypot(...originM) / AU_M * 10) / 10,
      description: spec.description, systemName: spec.system, order, context: { order } },
    worldFrame: { referenceFrame: 'sun-icrf', epochJdTt, originM, presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], orbitUpReference: [0, 0, 1],
      metersPerUnit: radiusKm * 1000 / BODY_RADIUS_UNITS, bodyRadiusM: radiusKm * 1000 } },
    prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' } });

  put(`src/renderers/css/styles/${id}-surfaces.css`, glow ? starStylesheet(id, name, 600, 'Both plates are transparent: no observation is cast.') : hostedPlanetStylesheet(id));
  put(`${o}/source/preparation/raster.json`, { schema: 'cssearth-raster-recipe@1', publicBase: `/scenes/${id}/`, sourceWidth: 1024, sourceHeight: 512, width: 1024, height: 512,
    latitudeBands: 16, polarTile: 256, resample: 'density-before-pack', polarProjection: 'orthographic-bilinear',
    polesOutput: `${id}-poles-{id}{suffix}.webp`, surfaceMetadata: { schema: `css${id}-prepared-assets@1` }, thumbnail: { size: 64, centerLongitudeDegrees: 0 },
    surfaces: [{ id: 'shape', output: `${id}-surface-{id}{suffix}.webp`, thumbnail: `${id}-lens-{id}.webp`, source: 'measurements.json', falseColor: false,
      science: { kind: 'neutral-shape', qualification: glow
        ? `Shared neutral gray display convention for a self-luminous planet with no image or measured visible colour in this package; a sphere of the published radius that glows with its own heat (${glow.temperatureK.toLocaleString('en-US')} K), so no lighting.`
        : 'Shared neutral gray display convention for a planet with no image or measured colour in this package; a sphere of the published radius, lit by its own star.' } }],
    ...(glow ? { emission: { offLimbSize: 600, limbSize: 512, bodyDiameter: 496, offLimbOutput: `${id}-context-{id}{suffix}.webp`, limbOutput: `${id}-limb-{id}{suffix}.webp`, metadata: {
      schema: `css${id}-prepared-emission@1`, presentation: 'prepared-emissive-surface-with-stationary-off-limb-context-and-limb-plate',
      offLimbContext: { logicalSize: 600, source: 'none: no observation, a transparent plate', composition: 'transparent', rotation: 'none', runtimeAlphaProcessing: false },
      limbMaterial: { logicalSize: 496, composition: 'transparent: the adopted source-radius opaque-sphere silhouette is the limb; no off-limb or radial-brightness source is selected', sourceRadius: 'measurements.json#radiusKm', surfaceReplacement: false, runtimeAlphaProcessing: false },
      lighting: false, shadows: false, runtimeLighting: false } } } : { lighting: { bank: 'sphere', presentationSize: 460, defaultFrame: 230, bankSchema: `css${id}-prepared-lighting-bank@1`, billboardSchema: `css${id}-prepared-lighting-billboard@1`,
      metadata: { schema: `css${id}-prepared-lighting@1`, storageModel: 'prepared-full-resolution-density-row-shards',
        model: 'prepared-full-phase-lambert-cubic-sky-sun-no-atmosphere',
        sourceRadius: 'measurements.json#radiusKm',
        limbMeaning: 'The adopted source-radius opaque-sphere silhouette and prepared phase lighting define the limb; no atmospheric rim is inferred.',
        sourceRenderer: 'OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl', ambientIntensity: 0.05,
        shadowlessFloodLimbFloor: 0.35, orenNayarRoughness: 0, terminatorSmoothstep: [0, 0.1], minimumLightViewZ: -1, maximumLightViewZ: 1,
        baseLightAzimuthDegrees: 0, cameraContract: 'unbounded-accumulated-matrix3d-phase-and-roll', runtimeRasterization: false } } }) });

  put(`${o}/source/preparation/geometry.json`, { schema: 'cssearth-css-geometry-profile@1', namespace: id,
    surface: { radius: BODY_RADIUS_UNITS, polarRadius: BODY_RADIUS_UNITS, latitudeSegments: 16, longitudeSegments: 32,
      surface: { url: `/scenes/${id}/${id}-surface-shape@2x.webp`, width: 1024, height: 768 }, surfaceLatitudeHeight: 512, packedBandGutter: 8,
      poles: { url: `/scenes/${id}/${id}-poles-shape@2x.webp`, width: 512, height: 256 }, polarTileSize: 256, polarRadiusScale: 1.035, polarOffset: 0.1, uv: 'cell', color },
    projection: sphereProjection(0.05, 1024 / 32),
    bodyRotationDegrees: 0, output: { schema: `css${id}-prepared-runtime-scene@1`, materialSchema: `css${id}-prepared-lighting@1`, layout: 'body-container',
      body: { axialTiltDegrees: 0, rotationDirection: 'prograde', rotationPeriodEarthDays: rotation === 'unmeasured' ? 0 : periodDays,
        sourceProjection: 'no observation: the shared neutral gray of an unresolved surface on the reference sphere',
        polarPreparation: 'the same gray on the polar tiles',
        axialTiltNote: rotation === 'unmeasured' ? 'no obliquity or spin of this planet is measured; the display axis is the orbit normal and nothing turns' : "no obliquity of this planet is measured; the rotation record assumes the spin axis on the orbit normal, as tidal locking implies" } } });

  put(`${o}/source/preparation/celestial.json`, { schema: 'cssearth-celestial-preparation@2', sources: ['presentation/solar-system.json'], ...(glow ? { directionalSun: false } : {}) });
  put(`${o}/source/preparation/presentation.json`, { schema: 'cssearth-css-presentation-profile@1', namespace: id, mode: glow ? 'emissive' : 'composite' });
  put(`${o}/source/preparation/navigation.json`, { schema: 'cssearth-navigation-marker@2', objectId: id, owner: 'object', presentation: { size: 5 },
    source: { path: 'presentation/context.png' }, operations: [{ type: 'resize', width: 'tile', height: 'tile', fit: 'cover', position: 'centre', kernel: 'lanczos3' },
      { type: 'ensure-alpha' }, { type: 'ellipse-mask', cx: .5, cy: .5, rx: .45, ry: .45, shading: { ambient: .35, diffuse: .65 } }, { type: 'png' }],
    context: { pixels: 512 } });
  if (rotation === 'unmeasured') {
    // The orbit normal in ICRF, from the same elements the orbit is propagated with: a display axis, not a measured pole.
    const elements = hostedKeplerElements(orbit as unknown as Parameters<typeof hostedKeplerElements>[0], astrometry, requireFiniteNumber(requireRecord(host.physical, 'host physical').meanRadiusKm));
    const normal = [Math.sin(elements.inclinationRad) * Math.sin(elements.ascendingNodeRad), -Math.sin(elements.inclinationRad) * Math.cos(elements.ascendingNodeRad), Math.cos(elements.inclinationRad)];
    put(`${o}/source/preparation/rotation.json`, { schema: 'cssearth-display-orientation@1',
      rightAscensionDegrees: (Math.atan2(normal[1]!, normal[0]!) * 180 / Math.PI + 360) % 360, declinationDegrees: Math.asin(normal[2]!) * 180 / Math.PI, displayMeridianDegrees: 90, phase: 'arbitrary-display-phase',
      source: `No rotation period or spin axis of ${name} is measured (${TODO}: name the literature checked). The display axis is the normal of its hosted orbit in packages/astronomy/data/bodies/${id}.json, computed by hostedKeplerElements in @cssearth/astronomy; the meridian is set so that grid longitude 0 faces the Sun and Earth at the scene epoch.`,
      coordinateSystem: 'ICRF/J2000. +Z is the display axis, the orbit normal; +X is the display meridian; east longitude. No spin is propagated.',
      qualification: `Display convention, not a measurement: the spin axis, spin sense, period and prime meridian of ${name} are unmeasured; the axis shown is its orbit normal.` });
  } else put(`${o}/source/preparation/rotation.json`, { schema: 'cssearth-synchronous-rotation@1', host: hostId,
    source: `Assumed synchronous rotation: a planet ${Math.round(requireFiniteNumber(orbit.semiMajorAxisStellarRadii))} stellar radii from its star is expected to be tidally locked, and no rotation period of ${name} is measured (${TODO}: name the literature checked). Pole, prime meridian and rate are computed from the hosted orbit in packages/astronomy/data/bodies/${id}.json.`,
    coordinateSystem: 'ICRF/J2000. +Z is the orbit normal (prograde spin); +X points at the host star at each instant, so longitude 0 is the substellar point; east longitude, the direction of rotation.',
    qualification: `Tidal locking and a spin axis on the orbit normal are assumptions, not measurements: neither the rotation period nor the obliquity of ${name} is measured.` });
  put(`${o}/source/preparation/acquisition.json`, { schema: 'cssearth-acquisition-plan@1',
    operations: [] });
  put(`${o}/source/presentation/solar-system.json`, { schema: 'cssearth-solar-system-preparation@1', bodyId: id, displayName: name,
    bodyRadiusUnits: BODY_RADIUS_UNITS, bodyRadiusKilometers: radiusKm, defaultZoom: 1.25, geometryScale: GEOMETRY_SCALE });
  put(`${o}/source/measurements.json`, { schema: 'cssearth-hosted-planet@1', id, radiusKm, radiusSource: String(body.physicalNotes ?? TODO),
    orbitalPeriodDays: periodDays, orbitalPeriodSource: requireString(requireRecord(orbit.sources).period, 'hosted orbit period source'),
    shape: { kind: 'sphere', qualification: `A sphere at the published radius in the shared neutral gray. No image, colour, map or oblateness of ${name} is measured; only its size, mass and orbit are.` },
    ...(glow ? { effectiveTemperatureK: glow.temperatureK, effectiveTemperatureSource: glow.source } : {}) });
  put(`${o}/source/content/object.json`, { schema: 'cssearth-object-content@1', version: 1, id, displayName: name,
    panel: { facts: [
      { id: 'radius', label: 'Radius', value: `${TODO}: the radius in Earth radii`,
        source: { catalogueId: `${TODO}-radius-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'radiusKm; radiusSource' } },
      { id: 'period', label: 'Year', value: `${TODO}: the orbital period in days`,
        source: { catalogueId: `${TODO}-period-source`, url: spec.paper, label: spec.paperCredit, checked: TODO, path: 'source/measurements.json', locator: 'orbitalPeriodDays; orbitalPeriodSource' } }], moreFacts: [] },
    lenses: { titleKey: 'lenses', defaultLens: 'shape', controls: [{ id: 'shape', label: 'Shape', qualification: glow ? 'A sphere of the published radius, glowing with its own heat; the neutral gray is a display convention, not a measured colour.' : `A sphere of the published radius, lit by ${spec.system.replace(' system', '')}; the neutral gray is a display convention, not a measured colour.`,
      thumbnail: `${id}-lens-shape.webp`, surface: `${id}-surface-shape@2x.webp`, poles: `${id}-poles-shape@2x.webp`,
      source: { id: `${id}-observational-measurements`, path: '../manifest.json', url: spec.paper }, falseColor: false,
      notes: `No image or colour of this planet exists (${TODO}: say why, and point at the ledger). The gray marks an unresolved surface; ${glow ? 'it glows with its own heat, so no starlight falls on it' : "the lighting is its own star's, at the measured orbit"}.` }] },
    // A lit body's prepared variants bind the shared shadows toggle; a self-luminous one has no shadows.
    settings: { titleKey: 'settings', controls: glow ? [] : [{ kind: 'toggle', name: 'shadows', label: 'Shadows', checked: false }] }, charts: [],
    resources: [{ label: 'Research', role: 'facts', description: spec.paperCredit, href: spec.paper }],
    provenance: { editorial: { url: spec.paper, credit: spec.paperCredit },
      physical: { path: `../../../../../packages/astronomy/data/bodies/${id}.json`, credit: `Published radius, mass and transit-fitted orbit; ${TODO}` } } });
  put(`${o}/text.json`, { schema: 'cssearth-object-text@1', objectId: id,
    card: { text: `${TODO}: one sentence, 110 characters at most.`, sources: [{ catalogueId: `${TODO}-card-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    introduction: { text: `${TODO}: two sentences, 180 characters at most.`, sources: [{ catalogueId: `${TODO}-introduction-source`, url: spec.paper, label: TODO, checked: TODO, locator: TODO, quote: TODO }] },
    datasets: { shape: { title: 'Shape only', detail: 'Published radius', summary: `${TODO}: what the sphere is and is not, 125 characters at most.` } } });
  put(`${o}/.gitignore`, '# No observation files: the sphere is the shared neutral gray.\n');
  const local = (reason: string) => ({ kind: 'local', reason });
  const preparation = (entryId: string, path: string, origin: string, consumers: string[]) => ({ id: `${id}-${entryId}`, path, origin,
    sourceBinding: local('Project-authored preparation record; published inputs retain their own identities and hashes.'),
    credit: 'cssEarth and the institutional sources identified in this record', license: 'Project-authored preparation record; referenced observations retain their source terms',
    acquisition: 'checked repository source', redistribution: 'checked authored source with embedded provenance', consumers });
  put(`${o}/source/manifest.json`, { schema: `cssearth-authoritative-sources@2`, inputs: [
    { id: `${id}-observational-measurements`, path: 'measurements.json', origin: spec.paper, credit: spec.paperCredit,
      license: 'Factual numerical measurements; source attribution retained', acquisition: 'Transcribed published measurements with their sources',
      redistribution: 'Factual parameter transcription only; no paper figures', consumers: ['shape-model'],
      sourceBinding: local('Measurements transcribed in this package with their sources; repinned when edited.') },
    preparation('preparation-raster', 'preparation/raster.json', glow ? 'Repository-authored raster recipe: the shared neutral gray on the reference sphere, self-luminous with transparent plates' : 'Repository-authored raster recipe: the shared neutral gray on the reference sphere, lit by the host star', ['assets', 'lenses']),
    preparation('preparation-geometry', 'preparation/geometry.json', `Repository-authored CSS geometry profile: 248-unit sphere, 16 x 32 leaves, ${glow ? 'emissive' : 'lit'} material`, ['scene', 'presentation']),
    preparation('preparation-celestial', 'preparation/celestial.json', glow ? 'Repository-authored celestial recipe: astrometric sky registration for the hosted planet, no directional light' : 'Repository-authored celestial recipe: astrometric sky registration and the host star as the light', glow ? ['starfield'] : ['starfield', 'sky-sun']),
    preparation('preparation-presentation', 'preparation/presentation.json', `Repository-authored presentation profile: ${glow ? 'emissive' : 'composite'} mode`, ['presentation']),
    preparation('physical-solar-system-recipe', 'presentation/solar-system.json', 'Repository-authored scene recipe: published radius, camera plan', ['scene'])],
    generatedIntermediates: [{ id: 'neutral-disc-context-marker', path: 'presentation/context.png', origin: spec.paper,
      credit: 'Sphere of the published radius; marker written by tools/objects/new-hosted-planet.mts', license: 'Project-authored display derivative.', consumers: ['navigation'],
      recipe: { generator: 'tools/objects/new-hosted-planet.mts', inputs: [`${id}-observational-measurements`] }, generator: 'tools/objects/new-hosted-planet.mts',
      sourceBinding: local('A flat neutral gray disc, the marker of an unresolved surface.') }],
    documents: ['content/object.json', 'preparation/acquisition.json', 'preparation/navigation.json', 'preparation/rotation.json'].map(path => ({ path,
      ...(path === 'content/object.json' ? { sourceBinding: local('Project-authored factsheet, dataset recipe and legend.') } : {}) })) });
  put(`${o}/README.md`, `# ${name}\n\n## Sources\n\n${TODO}: what is measured, what is not, and where each number comes from.\n\n## Evidence\n\n${TODO}\n\n## Known problems\n\n${TODO}\n\n[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](inventory.json) · [Credits](NOTICE.md)\n`);
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
  const order = flag('order'), color = flag('color'), rotation = flag('rotation'), glowK = flag('self-luminous'), glowSource = flag('temperature-source');
  if ((glowK === undefined) !== (glowSource === undefined)) throw new TypeError('--self-luminous <K> and --temperature-source <citation> go together.');
  if (rotation !== undefined && rotation !== 'synchronous' && rotation !== 'unmeasured') throw new TypeError(`--rotation takes synchronous or unmeasured, not ${rotation}.`);
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
    ...(order === undefined ? {} : { order: Number(order) }), ...(color === undefined ? {} : { color }), ...(rotation === undefined ? {} : { rotation: rotation as 'synchronous' | 'unmeasured' }),
    ...(glowK === undefined ? {} : { selfLuminous: { temperatureK: Number(glowK), source: glowSource! } }),
  }, body, await read(`packages/astronomy/data/bodies/${hostId}.json`), SOLAR_GEOMETRY_EPOCH_JD_TT);
  for (const [path, text] of files) { await mkdir(dirname(resolve(root, path)), { recursive: true }); await writeFile(resolve(root, path), text); }
  const { neutralDiscMarker } = await import('./new-object/scaffold.mts');
  const presentation = resolve(root, 'src/objects', id, 'source/presentation');
  await writeFile(resolve(presentation, 'context.png'), await neutralDiscMarker());
  console.log(`${files.size + 1} files written. Replace every ${TODO}, then: node tools/prepare/prepare-object.mts ${id}`);
}
