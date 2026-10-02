import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { BODIES, EXOPLANET_IDS, HOSTED_PLANET_IDS, M_PER_AU, M_PER_KM, SOLAR_EFFECTIVE_TEMPERATURE_K, SOLAR_RADIUS_M, STAR_IDS, isSceneSatellite, sceneSatelliteStateKm, starAstrometry } from '@cssearth/astronomy';
import type { StarId } from '@cssearth/astronomy';
import { isPlacedClassification, mapLabel, NEUTRAL_CATALOGUE_COLOR, parseObjectDescriptor } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';
import { packPreparedBinary, readCatalog, readPreparedObjects } from '@cssearth/objects/node';
import { worldOrbitBankRegions } from '@cssearth/objects';
import { prepareSceneDistance } from '@cssearth/bake/navigation';
import { parseWorldContextSource, PLAIN_STAR_DOT_BANK_IDS, plainStarDotBanks, prepareWorldContext, summarizeWorldContext, worldSystemViews } from '@cssearth/bake/world-context';
import { writeCatalogueBank } from '@cssearth/bake/volume/node';
import { worldOrbitBanks } from '@cssearth/objects';
import type { OrbitalState, Vector3, WorldContextBodyFact } from '@cssearth/bake/world-context';
import type { PreparedOrbitCenter as WorldContextOrbitCenter } from '@cssearth/objects';

interface Orbit { readonly semiMajorAxisAu: number; readonly eccentricity: number; readonly heliocentricDistanceAu: number; readonly perihelionDirection: Vector3; readonly trueAnomalyDegrees: number; readonly centerBodyId?: string; readonly centerPositionAu?: Vector3; readonly centerParentBodyId?: string; }
interface SolarGeometry {
  readonly SOLAR_GEOMETRY_EPOCH_JD_TT: number;
  readonly ASTRONOMICAL_UNIT_KILOMETERS: number;
  readonly BODY_FIXED_SUN_DIRECTIONS: Readonly<Record<string, Vector3>>;
  readonly BODY_FIXED_ORBIT_NORMAL_DIRECTIONS: Readonly<Record<string, Vector3>>;
  readonly BODY_FIXED_TO_ICRF_MATRICES: Readonly<Record<string, readonly number[]>>;
  readonly BODY_ORBITS: Readonly<Record<string, Orbit>>;
  readonly BODY_HELIOCENTRIC_STATES: Readonly<Record<string, { readonly positionKm: Vector3; readonly velocityKmPerDay: Vector3 }>>;
}

export interface SpatialContextPreparationOptions {
  readonly sourcePath: string;
  readonly outputPath: string;
  readonly solarGeometryPath: string;
  /** Directory containing object descriptor folders; inferred beside a navigation source when omitted. */
  readonly objectsDirectory?: string;
}

export type SpatialContextCommandOptions = SpatialContextPreparationOptions;

/** Parse the CLI. No manifest pins the generated context, so there is nothing to refresh after writing it. */
export function parseSpatialContextCommand(args: readonly string[], cwd = process.cwd()): SpatialContextCommandOptions {
  const [sourcePath, outputPath, solarGeometryPath = resolve(cwd, 'src/platform/solar-geometry.mts'), ...extra] = args;
  if (!sourcePath || !outputPath || extra.length > 0 || args.some(argument => argument.startsWith('--'))) {
    throw new TypeError('Usage: prepare-spatial-context <source.json> <world-context.json> [solar-geometry.mts]');
  }
  return { sourcePath: resolve(cwd, sourcePath), outputPath: resolve(cwd, outputPath), solarGeometryPath: resolve(cwd, solarGeometryPath) };
}

/** The sRGB hex of a Planck spectrum at a temperature, through a CIE color-matching table (the route a star without a measured
 * spectrum takes in packages/bake/src/objects/stellar/stellar-photometric-color.ts). */
async function planckHex(kelvin: number): Promise<string> {
  const [{ planckColor }, { parseCieTable }, { readCie1931ColorMatching }] = await Promise.all([import('@cssearth/bake/objects/stellar'), import('@cssearth/bake/objects/color'), import('@cssearth/bake/objects/sources')]);
  const color = planckColor(kelvin, parseCieTable((await readCie1931ColorMatching()).toString('utf8'), 3));
  return `#${color.srgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`;
}

/** Prepares a renderer-neutral solar context from a pinned source document and epoch geometry adapter. */
export async function prepareSpatialContext(options: SpatialContextPreparationOptions): Promise<void> {
  const input = JSON.parse(await readFile(options.sourcePath, 'utf8'));
  if (input.bodies === 'catalog') {
    const objects = await readCatalog(options.objectsDirectory ?? resolve(process.cwd(), 'src/objects'), prepareSceneDistance);
    input.bodies = objects.filter(body => body.context && body.id !== input.focus.id)
      .sort((a, b) => (a.context!.order ?? Number.MAX_SAFE_INTEGER) - (b.context!.order ?? Number.MAX_SAFE_INTEGER) || a.id.localeCompare(b.id, 'en'))
      .map(body => ({ id: body.id, name: body.context!.name ?? mapLabel(body.name), color: body.context!.color ?? body.color,
        ...(body.context!.orbitsWithinAu === undefined ? {} : { orbitsWithinM: body.context!.orbitsWithinAu * M_PER_AU }),
        ...(body.context!.labelPlacement === undefined ? {} : { labelPlacement: body.context!.labelPlacement }),
        ...(isSceneSatellite(body.id) && sceneSatelliteStateKm(body.id, input.frame.epochJdTt).provenance.placement === 'approximate'
          ? { placement: 'approximate' as const } : {}) }));
    // A star on a hosted orbit around a packaged host is drawn from its astronomy record without a page. Its color is the Planck
    // color at its measured effective temperature, through the CIE 1931 2° observer its host package keeps, as a star package
    // without a measured spectrum is colored; with no measured temperature it is the shared neutral gray. Adding its package
    // later makes it an ordinary, clickable body.
    const packaged = new Set(objects.map(object => object.id));
    const records = BODIES as Readonly<Record<string, { readonly name: string; readonly parent: string | null; readonly effectiveTemperatureK?: number }>>;
    const objectsRoot = options.objectsDirectory ?? dirname(dirname(dirname(dirname(options.sourcePath))));
    for (const id of HOSTED_PLANET_IDS as readonly string[]) {
      const record = records[id], parent = record?.parent;
      if (packaged.has(id) || !parent || !packaged.has(parent)) continue;
      input.bodies.push({ id, name: mapLabel(record!.name), color: record!.effectiveTemperatureK === undefined ? NEUTRAL_CATALOGUE_COLOR
        : await planckHex(record!.effectiveTemperatureK), unpackaged: true });
    }
  }
  // Each packaged body's world presentation, prepared here so no page carries a stylesheet rule or a registry entry per body:
  // the color its marker, orbit and caption take (its swatch, else its catalogue color lifted for caption contrast,
  // @cssearth/objects `contextColor`), capitals for a star, black hole or planet's caption, and its classification and system name.
  {
    // Every placed object the world draws: the scenes and the packages the world's host draws.
    const prepared = readPreparedObjects(process.cwd()), registry = prepared.worldObjects;
    const { contextColor } = await import('@cssearth/objects');
    const { contextAnnotationOpacity } = await import('@cssearth/renderer/navigation/marker-presentation.ts');
        const { isJplMissionTarget } = await import(pathToFileURL(resolve(process.cwd(), 'site/build/prepare/jpl-mission-targets.mts')).href) as typeof import('./jpl-mission-targets.mts');
    const objectsRoot = options.objectsDirectory ?? dirname(dirname(dirname(dirname(options.sourcePath))));
    const byId = new Map(registry.map(object => [object.id, object]));
    // The catalogue step's discovery records, as the prepared catalogue holds them: what the world's visibility reads per body.
    const discoveries: Record<string, unknown> = Object.fromEntries(registry.map(object => [object.id, object.discovery]));
    const present = async (body: Record<string, unknown>) => {
      const object = byId.get(String(body.id));
      if (!object) return;
      const swatch = await readFile(resolve(objectsRoot, object.id, 'swatch.json'), 'utf8').then(text => JSON.parse(text) as { hex: string; display?: { hex: string } },
        (error: unknown) => { if (isMissingFile(error)) return undefined; throw error; });
      const hex = contextColor(swatch ? swatch.display?.hex ?? swatch.hex : undefined, object.color, contextAnnotationOpacity(object.classification).label);
      if (hex) body.contextColor = hex;
      if (object.classification === 'star' || object.classification === 'black-hole' || object.classification === 'planet') body.labelCase = 'upper';
      // The page needs these for every body without loading the registry: which bodies host systems, and what each is called.
      body.classification = object.classification; body.systemName = object.systemName;
      if (Object.hasOwn(discoveries, object.id)) body.discovery = discoveries[object.id];
      // Only notable asteroids are map targets: JPL mission targets and those with real imagery. The rest are plain dots.
      const imagery = (discoveries[object.id] as { imagery?: unknown } | undefined)?.imagery === true;
      if (object.classification === 'asteroid' && !isJplMissionTarget(object) && !imagery) body.plainDot = true;
      // The galactic map's stars are decorative except the notable ones: a star is a map target only when it is featured (an IAU
      // name, or marked notable), has real imagery or hosts a body that does. Every other star, archive hosts included, is a
      // plain dot; its page stays reachable through search. The rule holds in every galaxy: a clickable marker always shows its
      // ring and name, so a Cepheid in a Virgo Cluster galaxy is a target only when its package features it.
      const discovery = discoveries[object.id] as { featured?: unknown; hostsImagery?: unknown } | undefined;
      if (object.classification === 'star' && body !== input.focus && !imagery && discovery?.featured !== true && discovery?.hostsImagery !== true) body.plainDot = true;
      // A star's dot is its color dimmed by its luminosity, L/L☉ = (R/R☉)²(T/T☉)⁴ from the radius and effective temperature
      // its package cites, against the IAU 2015 nominal solar values. Baked here, so the map writes nothing per frame for it.
      // A star whose package cites neither keeps its full color.
      if (object.classification === 'star' && body !== input.focus && typeof body.color === 'string') {
        const measured = await readFile(resolve(objectsRoot, object.id, 'source/measurements.json'), 'utf8').then(text => JSON.parse(text) as Record<string, unknown>,
          (error: unknown) => { if (isMissingFile(error)) return undefined; throw error; });
        const radiusKm = measured?.radiusKm, temperatureK = measured?.effectiveTemperatureK;
        if (typeof radiusKm === 'number' && typeof temperatureK === 'number') {
          const luminosity = (radiusKm * M_PER_KM / SOLAR_RADIUS_M) ** 2 * (temperatureK / SOLAR_EFFECTIVE_TEMPERATURE_K) ** 4;
          body.dotColor = dimHex(body.color, starDotBrightness(luminosity));
        }
      }
    };
    await present(input.focus);
    for (const body of input.bodies as Record<string, unknown>[]) await present(body);
  }
  const source = parseWorldContextSource(input);
  const geometry = await loadSolarGeometry(options.solarGeometryPath);
  // The application registry owns classification; preparation bakes its orbit presentation.
  const SCENE_OBJECTS = readPreparedObjects(process.cwd()).worldObjects;
  const planetIds = new Set(SCENE_OBJECTS.filter(body => body.classification === 'planet').map(body => body.id));
  const classifications = new Map(SCENE_OBJECTS.map(body => [body.id, body.classification]));
  // A planet of another star closes its orbit. A star on a hosted orbit (an S-star around Sgr A*) draws the half-orbit trail a
  // comet does: dozens of eccentric ellipses around one host read as a tangle, their recent paths as motion.
  const hostedIds = new Set<string>(HOSTED_PLANET_IDS), hostedStarIds = new Set<string>(HOSTED_PLANET_IDS.filter(id => !(EXOPLANET_IDS as readonly string[]).includes(id)));
  const { SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE, SYSTEM_FRAMING_ANGLES } = await import(pathToFileURL(resolve(process.cwd(), 'site/runtime-policy.mts')).href) as {
    SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE: number;
    SYSTEM_FRAMING_ANGLES: { readonly elevationsDegrees: readonly number[]; readonly azimuthStepDegrees: number };
  };
  if (source.frame.epochJdTt !== geometry.SOLAR_GEOMETRY_EPOCH_JD_TT) throw new TypeError('World context and solar geometry epochs differ.');
  const auM = geometry.ASTRONOMICAL_UNIT_KILOMETERS * M_PER_KM;
  const objectsDirectory = options.objectsDirectory ?? dirname(dirname(dirname(dirname(options.sourcePath))));
  const facts: Record<string, WorldContextBodyFact> = {}, states: Record<string, OrbitalState> = {};
  for (const body of source.bodies) {
    const data = (BODIES as Readonly<Record<string, { readonly meanRadiusKm: number }>>)[body.id];
    const orbit = geometry.BODY_ORBITS[body.id], sunDirection = geometry.BODY_FIXED_SUN_DIRECTIONS[body.id], normal = geometry.BODY_FIXED_ORBIT_NORMAL_DIRECTIONS[body.id], matrix = geometry.BODY_FIXED_TO_ICRF_MATRICES[body.id];
    if (!orbit || !sunDirection || !normal || !matrix) throw new TypeError(`Solar geometry lacks ${body.id}.`);
    // Match the physical-frame finalizer's conversion order even at Pluto-scale coordinates.
    const distanceM = orbit.heliocentricDistanceAu * geometry.ASTRONOMICAL_UNIT_KILOMETERS * M_PER_KM;
    const positionM = scale(apply(matrix, sunDirection), -distanceM);
    const centerBodyId = orbit.centerBodyId ?? source.focus.id;
    const centerPositionM = orbit.centerPositionAu ? add(positionM, scale(apply(matrix, orbit.centerPositionAu), auM)) : source.frame.originM;
    states[body.id] = { positionM, centerBodyId, centerPositionM, normal: unit(apply(matrix, normal)), perihelionDirection: unit(apply(matrix, orbit.perihelionDirection)),
      semiMajorAxisM: orbit.semiMajorAxisAu * auM, eccentricity: orbit.eccentricity, trueAnomalyRadians: orbit.trueAnomalyDegrees * Math.PI / 180 };
    const radiusM = await preparedRadius(body.id, positionM, source.frame.referenceFrame,
      source.frame.epochJdTt, resolve(objectsDirectory, body.id, 'object.json')) ?? (data ? data.meanRadiusKm * M_PER_KM : undefined);
    if (radiusM === undefined) throw new TypeError(`World context lacks a physical radius for ${body.id}.`);
    // A star other than the focus is placed, not orbiting: the context carries its position and radius and draws no trajectory.
    // A planet of another star closes its orbit around that star, which makes the star the root of its own planetary system.
    const classification = classifications.get(body.id);
    facts[body.id] = { radiusM, orbitStyle: hostedStarIds.has(body.id) ? 'trail' : hostedIds.has(body.id) ? 'closed' : isPlacedClassification(classification) ? 'none' : planetIds.has(body.id) || classification === 'exoplanet' ? 'closed' : 'trail', classification };
  }
  // A star measured to be bound to another with no measured orbit carries the pair's centre of mass, weighted by the
  // published masses (as gravitational parameters) at the two prepared positions.
  for (const body of source.bodies) {
    if (!(STAR_IDS as readonly string[]).includes(body.id)) continue;
    const hostId = starAstrometry(body.id as StarId).boundTo;
    if (!hostId) continue;
    const masses = BODIES as Readonly<Record<string, { readonly gravitationalParameterKm3PerS2: number }>>;
    const record = masses[body.id]!, host = masses[hostId];
    const hostPositionM = hostId === source.focus.id ? source.frame.originM : states[hostId]?.positionM;
    if (!host || !hostPositionM || !(host.gravitationalParameterKm3PerS2 > 0) || !(record.gravitationalParameterKm3PerS2 > 0)) {
      throw new TypeError(`${body.id} is bound to ${hostId}, which the world context must place with a mass.`);
    }
    const share = record.gravitationalParameterKm3PerS2 / (record.gravitationalParameterKm3PerS2 + host.gravitationalParameterKm3PerS2);
    const positionM = states[body.id]!.positionM;
    const centerM = hostPositionM.map((value, axis) => value + (positionM[axis]! - value) * share) as unknown as Vector3;
    facts[body.id] = { ...facts[body.id]!, boundTo: { hostId, centerM } };
  }
  const orbitCenters: Record<string, WorldContextOrbitCenter> = {};
  for (const body of source.bodies) {
    const state = states[body.id]!;
    if (!states[state.centerBodyId] && state.centerBodyId !== source.focus.id) {
      const primary = geometry.BODY_HELIOCENTRIC_STATES[state.centerBodyId];
      if (primary) orbitCenters[state.centerBodyId] = { positionM: scale(primary.positionKm, M_PER_KM), centerBodyId: 'sun' };
      // A binary's centre of mass (a circumbinary planet's orbit centre) is placed by the planet's own prepared orbit.
      const centreParent = geometry.BODY_ORBITS[body.id]!.centerParentBodyId;
      if (centreParent !== undefined) orbitCenters[state.centerBodyId] = { positionM: state.centerPositionM, centerBodyId: centreParent };
    }
    const parentPosition = state.centerBodyId === source.focus.id ? source.frame.originM :
      (states[state.centerBodyId] ?? orbitCenters[state.centerBodyId])?.positionM;
    // Matrix products at Neptune's distance have millimetre-scale roundoff.
    // Keep the check within a few floating-point ULPs before using the exact
    // prepared parent position below, rather than a fixed sub-ULP tolerance.
    const tolerance = parentPosition ? positionToleranceM(parentPosition, state.centerPositionM) : 0;
    if (!parentPosition || Math.hypot(...parentPosition.map((value, axis) => value - state.centerPositionM[axis]!)) > tolerance) {
      throw new TypeError(`Prepared orbit centre is incompatible with its parent for ${body.id}.`);
    }
    // The parent and child ephemeris adapters can differ by sub-millimetre float roundoff.
    // Use one exact prepared centre so every consumer shares the same placement.
    states[body.id] = { ...state, centerPositionM: parentPosition };
  }
  const prepared = prepareWorldContext(source, facts, states, orbitCenters, {
    minimumRadiusShare: SYSTEM_FRAMING_MIN_MOON_RADIUS_SHARE, ...SYSTEM_FRAMING_ANGLES });
  // Browser payload: compact JSON. Indentation was 60% of the fetched bytes.
  await writeIfChanged(options.outputPath, `${JSON.stringify(prepared)}\n`);
  // The browser reads the summary; the planner worker adds each orbit centre's binary bank, which the summary pins by
  // byte length, when that centre's orbits come into view. The full JSON above remains for build-time tools.
  const banks = worldOrbitBanks(prepared), bankDirectory = worldOrbitsDirectory(options.outputPath), keptBanks = new Set<string>();
  // Each bank is packed for delivery (@cssearth/objects prepared-binary.ts); the summary pins its unpacked bytes.
  for (const bank of banks) {
    keptBanks.add(`${bank.id}.bin`);
    await writeIfChanged(resolve(bankDirectory, `${bank.id}.bin`), packPreparedBinary(bank.bytes, worldOrbitBankRegions(bank.bytes, `world-orbits/${bank.id}.bin`), `world-orbits/${bank.id}.bin`));
  }
  for (const name of await readdir(bankDirectory).catch(() => [] as string[])) if (!keptBanks.has(name)) await rm(resolve(bankDirectory, name));
  await rm(resolve(dirname(options.outputPath), 'world-orbits.bin'), { force: true });
  // Every page reads the summary: the Sun's own system and the bodies that orbit nothing. Each other star is a holder, its
  // own file with the bodies that orbit it, read when a page shows that system or the camera approaches it (summarizeWorldContext).
  const { summary, systems, index, plainStars } = summarizeWorldContext(prepared, Object.fromEntries(banks.map(bank => [bank.id, bank.bytes.byteLength])), ASTEROID_DOT_BANK);
  // The map draws those stars as dots, not as bodies. A star of the Milky Way is one of the galaxy's own dots
  // (src/objects/milky-way-volume/source/packaged-stars, written by paged-star-dot-positions.mts); the world's own banks
  // (`/world/dots/<id>.bin`) hold only the stars that table does not name: the ones in other galaxies.
  const galaxyStars = await packagedGalaxyStars(dirname(dirname(dirname(options.outputPath))));
  const dotBanks = plainStarDotBanks(plainStars.filter(body => !galaxyStars.has(body.id)).map(body => ({ id: body.id, positionM: body.positionM, color: body.color })), prepared.frame);
  for (const id of PLAIN_STAR_DOT_BANK_IDS) if (!dotBanks.some(bank => bank.id === id)) await rm(resolve(dirname(options.outputPath), `${id}.bin`), { force: true });
  for (const bank of dotBanks) {
    await writeCatalogueBank({ objectDirectory: resolve(dirname(options.outputPath), '..'), id: bank.id, bank, published: true, inventory: async () => undefined });
  }
  // The summary names the banks this bake wrote, so the site asks for no other.
  await writeIfChanged(worldContextSummaryPath(options.outputPath), `${JSON.stringify({ ...summary, ...(dotBanks.length ? { dotBanks: dotBanks.map(bank => bank.id) } : {}) })}\n`);
  // Read by the build and Node tools only: which holder has each body, which the page reads from the body's own object entry.
  await writeIfChanged(worldIndexPath(options.outputPath), `${JSON.stringify(index)}\n`);
  await rm(resolve(dirname(options.outputPath), 'world-stars.json'), { force: true });
  const systemDirectory = worldSystemsDirectory(options.outputPath), keptSystems = new Set<string>();
  for (const system of systems) {
    keptSystems.add(`${system.id}.json`);
    await writeIfChanged(resolve(systemDirectory, `${system.id}.json`), `${JSON.stringify(system.file)}\n`);
  }
  for (const name of await readdir(systemDirectory).catch(() => [] as string[])) if (!keptSystems.has(name)) await rm(resolve(systemDirectory, name));
  // System framing's camera candidates, one file per host, read when navigation frames that system.
  const directory = worldSystemViewsDirectory(options.outputPath), views = worldSystemViews(prepared), kept = new Set<string>();
  for (const view of views) { kept.add(`${view.id}.json`); await writeIfChanged(resolve(directory, `${view.id}.json`), `${JSON.stringify(view)}\n`); }
  for (const name of await readdir(directory).catch(() => [] as string[])) if (!kept.has(name)) await rm(resolve(directory, name));
  await rm(resolve(dirname(options.outputPath), 'world-system-views.json'), { force: true });
}

/** The dot bank the paged asteroids are dots of (paged-asteroid-dot-positions.mts writes their places into it): the
 * holder of every asteroid the map draws as a plain dot. */
const ASTEROID_DOT_BANK = 'catalogue-asteroids';

/** `world-context.json` → `system-views/`, beside it: `<host id>.json` per system. */
export function worldSystemViewsDirectory(outputPath: string): string {
  return resolve(dirname(outputPath), 'system-views');
}

/** The star packages that are dots of the Milky Way's own bank, by id: the names of its tracked table. An object folder
 * without the table (a fixture) has none. */
async function packagedGalaxyStars(objectsRoot: string): Promise<ReadonlySet<string>> {
  const path = resolve(objectsRoot, 'milky-way-volume/source/packaged-stars/positions.csv.gz');
  const bytes = await readFile(path).catch((error: unknown) => { if (isMissingFile(error)) return null; throw error; });
  if (bytes === null) return new Set();
  const [header, ...rows] = gunzipSync(bytes).toString('utf8').trim().split('\n');
  if (header !== 'name,xKpc,yKpc,zKpc,color') throw new TypeError(`${path}: the header is ${JSON.stringify(header)}, not name,xKpc,yKpc,zKpc,color.`);
  return new Set(rows.map(row => row.slice(0, row.indexOf(','))));
}

/** `world-context.json` → `world-index.json`, beside it: the build's table of which holder has each body. */
export function worldIndexPath(outputPath: string): string {
  return resolve(dirname(outputPath), 'world-index.json');
}

/** `world-context.json` → `world-systems/`, beside it: `<star id>.json` per system other than the focus's. */
export function worldSystemsDirectory(outputPath: string): string {
  return resolve(dirname(outputPath), 'world-systems');
}

/** `world-context.json` → `world-orbits/`, beside it: `<orbit centre id>.bin` per centre. */
export function worldOrbitsDirectory(outputPath: string): string {
  return resolve(dirname(outputPath), 'world-orbits');
}

/** `world-context.json` → `world-context-summary.json`, beside it. */
export function worldContextSummaryPath(outputPath: string): string {
  return outputPath.replace(/\.json$/, '-summary.json');
}

async function writeIfChanged(path: string, contents: string | Uint8Array): Promise<void> {
  const bytes = typeof contents === 'string' ? Buffer.from(contents) : Buffer.from(contents.buffer, contents.byteOffset, contents.byteLength);
  try { if (Buffer.compare(await readFile(path), bytes) === 0) return; }
  catch (error: unknown) { if (!isMissingFile(error)) throw error; }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

/** A migrated object's prepared frame is authoritative when it names this exact physical epoch and centre. */
async function preparedRadius(id: string, originM: Vector3, referenceFrame: string, epochJdTt: number,
  descriptorPath: string): Promise<number | undefined> {
  let raw: unknown;
  try { raw = JSON.parse(await readFile(descriptorPath, 'utf8')); }
  catch (error: unknown) {
    if (isMissingFile(error)) return undefined;
    throw error;
  }
  const descriptor = parseObjectDescriptor(raw);
  if (descriptor.id !== id) throw new TypeError(`Prepared descriptor identity differs for ${id}.`);
  const value = descriptor.properties.worldFrame;
  if (value === undefined) return undefined;
  const frame = record(value, `${id} prepared world frame`);
  const frameReference = text(frame.referenceFrame, `${id} prepared world frame reference`);
  const frameEpoch = number(frame.epochJdTt, `${id} prepared world frame epoch`);
  const frameOrigin = vector3(frame.originM, `${id} prepared world frame origin`);
  const radiusM = positive(frame.bodyRadiusM, `${id} prepared world frame radius`);
  // Saved frames and reconstructed positions can differ by millimetres after
  // matrix roundoff at outer-planet distances. Use the orbit-centre allowance.
  if (frameReference !== referenceFrame || frameEpoch !== epochJdTt ||
      Math.hypot(...frameOrigin.map((value, axis) => value - originM[axis]!)) > positionToleranceM(frameOrigin, originM)) {
    throw new TypeError(`Prepared world frame is incompatible with solar context for ${id}.`);
  }
  return radiusM;
}

function positionToleranceM(a: Vector3, b: Vector3): number {
  return Math.max(.001, 8 * Number.EPSILON * Math.max(...a.map(Math.abs), ...b.map(Math.abs)));
}

/** Presentation choices, not measurements: a star of a thousand Suns or more draws its full color, one of ten or fewer this
 * share of it, and the magnitudes between fall evenly. Over the black sky, scaling the color is the dot at that opacity. */
const STAR_DOT_FULL_LUMINOSITY = 1000, STAR_DOT_FLOOR_LUMINOSITY = 10, STAR_DOT_FLOOR_BRIGHTNESS = 0.6;
function starDotBrightness(luminositySolar: number): number {
  const fall = Math.max(0, Math.min(1, Math.log10(STAR_DOT_FULL_LUMINOSITY / luminositySolar) / Math.log10(STAR_DOT_FULL_LUMINOSITY / STAR_DOT_FLOOR_LUMINOSITY)));
  return 1 - (1 - STAR_DOT_FLOOR_BRIGHTNESS) * fall;
}
function dimHex(hex: string, brightness: number): string {
  return `#${[1, 3, 5].map(at => Math.round(parseInt(hex.slice(at, at + 2), 16) * brightness).toString(16).padStart(2, '0')).join('')}`;
}
function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

async function loadSolarGeometry(path: string): Promise<SolarGeometry> {
  const module: unknown = await import(pathToFileURL(path).href);
  const input = record(module, 'Solar geometry module');
  const geometry: SolarGeometry = {
    SOLAR_GEOMETRY_EPOCH_JD_TT: number(input.SOLAR_GEOMETRY_EPOCH_JD_TT, 'Solar geometry epoch'),
    ASTRONOMICAL_UNIT_KILOMETERS: number(input.ASTRONOMICAL_UNIT_KILOMETERS, 'Solar geometry astronomical unit'),
    BODY_FIXED_SUN_DIRECTIONS: vectors(input.BODY_FIXED_SUN_DIRECTIONS, 'Solar geometry Sun directions'),
    BODY_FIXED_ORBIT_NORMAL_DIRECTIONS: vectors(input.BODY_FIXED_ORBIT_NORMAL_DIRECTIONS, 'Solar geometry orbit normals'),
    BODY_FIXED_TO_ICRF_MATRICES: matrices(input.BODY_FIXED_TO_ICRF_MATRICES), BODY_ORBITS: orbits(input.BODY_ORBITS),
    BODY_HELIOCENTRIC_STATES: Object.fromEntries(Object.entries(record(input.BODY_HELIOCENTRIC_STATES ?? {}, 'Primary states')).map(([id, value]) => {
      const state = record(value, `${id} primary state`);
      return [id, { positionKm: vector3(state.positionKm, `${id} primary position`), velocityKmPerDay: vector3(state.velocityKmPerDay, `${id} primary velocity`) }];
    })),
  };
  return geometry;
}

function vectors(value: unknown, name: string): Readonly<Record<string, Vector3>> {
  const input = record(value, name); return Object.freeze(Object.fromEntries(Object.entries(input).map(([id, vector]) => [id, vector3(vector, `${name}.${id}`)])));
}
function matrices(value: unknown): Readonly<Record<string, readonly number[]>> {
  const input = record(value, 'Solar geometry rotations'); return Object.freeze(Object.fromEntries(Object.entries(input).map(([id, matrix]) => {
    if (!Array.isArray(matrix) || matrix.length !== 9 || matrix.some(component => typeof component !== 'number' || !Number.isFinite(component))) throw new TypeError(`Solar geometry rotation ${id} is invalid.`);
    return [id, Object.freeze([...matrix])];
  })));
}
function orbits(value: unknown): Readonly<Record<string, Orbit>> {
  const input = record(value, 'Solar geometry orbits'); return Object.freeze(Object.fromEntries(Object.entries(input).map(([id, value]) => {
    const orbit = record(value, `Solar geometry orbit ${id}`);
    if ((orbit.centerBodyId === undefined) !== (orbit.centerPositionAu === undefined)) throw new TypeError(`${id} orbit parent and centre must be declared together.`);
    const semiMajorAxisAu = number(orbit.semiMajorAxisAu, `${id} semi-major axis`), orbitEccentricity = eccentricity(orbit.eccentricity, id);
    // A straight path (eccentricity exactly 1, a placed body moving along its line of sight or held still) is bound or unbound.
    if (!(orbitEccentricity < 1 ? semiMajorAxisAu > 0 : orbitEccentricity === 1 ? semiMajorAxisAu !== 0 : semiMajorAxisAu < 0)) throw new TypeError(`${id} semi-major axis ${semiMajorAxisAu} AU and eccentricity ${orbitEccentricity} are incompatible.`);
    return [id, { semiMajorAxisAu, eccentricity: orbitEccentricity, // Zero is a scale of the universe centred on the observer: it is nowhere but at the Sun.
      heliocentricDistanceAu: (distance => { if (!(distance >= 0)) throw new TypeError(`${id} distance must not be negative.`); return distance; })(number(orbit.heliocentricDistanceAu, `${id} distance`)),
      perihelionDirection: vector3(orbit.perihelionDirection, `${id} perihelion`), trueAnomalyDegrees: number(orbit.trueAnomalyDegrees, `${id} anomaly`),
      ...(orbit.centerBodyId === undefined ? {} : { centerBodyId: text(orbit.centerBodyId, `${id} orbit parent`), centerPositionAu: vector3(orbit.centerPositionAu, `${id} orbit centre`) }),
      ...(orbit.centerParentBodyId === undefined ? {} : { centerParentBodyId: text(orbit.centerParentBodyId, `${id} orbit centre parent`) }) }];
  })));
}
function apply(matrix: readonly number[], value: Vector3): Vector3 { return [matrix[0]! * value[0] + matrix[1]! * value[1] + matrix[2]! * value[2], matrix[3]! * value[0] + matrix[4]! * value[1] + matrix[5]! * value[2], matrix[6]! * value[0] + matrix[7]! * value[1] + matrix[8]! * value[2]]; }
function scale(value: Vector3, factor: number): Vector3 { return [value[0] * factor, value[1] * factor, value[2] * factor]; }
function add(a: Vector3, b: Vector3): Vector3 { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function unit(value: Vector3): Vector3 { const length = Math.hypot(...value); if (!(length > 0)) throw new TypeError('Solar geometry direction is undefined.'); return scale(value, 1 / length); }
function vector3(value: unknown, name: string): Vector3 { if (!Array.isArray(value) || value.length !== 3 || value.some(component => typeof component !== 'number' || !Number.isFinite(component))) throw new TypeError(`${name} must be a finite vector.`); return [value[0]!, value[1]!, value[2]!]; }
function record(value: unknown, name: string): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} is invalid.`); return value as Record<string, unknown>; }
function text(value: unknown, name: string): string { if (typeof value !== 'string' || value.length === 0) throw new TypeError(`${name} must be text.`); return value; }
function number(value: unknown, name: string): number { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`${name} must be finite.`); return value; }
function positive(value: unknown, name: string): number { const result = number(value, name); if (!(result > 0)) throw new TypeError(`${name} must be positive.`); return result; }
// Eccentricity 1 is a placed source moving straight along its line of sight (prepare-solar-geometry.mts); the world context
// accepts it only for a body it places without drawing a path.
function eccentricity(value: unknown, id: string): number { const result = number(value, `${id} eccentricity`); if (result < 0) throw new TypeError(`${id} eccentricity is invalid.`); return result; }

const invoked = process.argv[1] !== undefined && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (invoked) {
  await prepareSpatialContext(parseSpatialContextCommand(process.argv.slice(2)));
}
