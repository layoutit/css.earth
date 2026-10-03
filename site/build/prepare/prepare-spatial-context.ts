import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { BODIES, EXOPLANET_IDS, HOSTED_PLANET_IDS, M_PER_AU, M_PER_KM, SOLAR_EFFECTIVE_TEMPERATURE_K, SOLAR_RADIUS_M, STAR_IDS, isSceneSatellite, sceneSatelliteStateKm, starAstrometry } from '@cssearth/astronomy';
import type { StarId } from '@cssearth/astronomy';
import { isPlacedClassification, mapLabel, NEUTRAL_CATALOGUE_COLOR, OBJECT_TREE_ROOT, parseObjectDescriptor } from '@cssearth/objects';
import { isRecord } from '@cssearth/core';
import { packPreparedBinary, readCatalog, readPreparedObjects } from '@cssearth/objects/node';
import { worldOrbitBankRegions } from '@cssearth/objects';
import { prepareSceneDistance } from '@cssearth/bake/navigation';
import { plainDotBank } from './plain-dot-bank.mts';
import { parseWorldContextSource, PLAIN_STAR_DOT_BANK, RETIRED_PLAIN_STAR_DOT_BANK, plainStarDotBank, prepareWorldContext, summarizeWorldContext, worldSystemViews } from '@cssearth/bake/world-context';
import { writeCatalogueBank } from '@cssearth/bake/volume/node';
import { systemViewFile, worldOrbitBanks } from '@cssearth/objects';
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
  // The browser reads the summary; the planner worker adds each body's binary orbit bank, which the file that has the body
  // pins by byte length, when its orbit comes into view. The full JSON above remains for build-time tools.
  const banks = worldOrbitBanks(prepared);
  // Every page reads the summary: frame, camera and sky facts and the Sun. Every other body is in the file of the object it
  // is inside, by the object tree (summarizeWorldContext). The tree is the checkout's registry, as the bodies'
  // classifications above are: `objectsDirectory` says where each object's files are read and written, not which objects
  // exist or what they are inside.
  const registered = readPreparedObjects(process.cwd()).objects;
  const tree = new Map(registered.map(object => [object.id, { parent: object.parent }] as const));
  // The dot bank the paged asteroids are dots of (paged-asteroid-dot-positions.mts writes their places into it): the holder
  // of every asteroid the map draws as a plain dot. It is the bank the focus hosts that declares them.
  const asteroidDotBank = await plainDotBank(resolve(process.cwd(), 'src/objects'), prepared.focus.id, 'asteroid');
  const { summary, systems, places, index, plainStars, insideOf } = summarizeWorldContext(prepared, Object.fromEntries(banks.map(bank => [bank.id, bank.bytes.byteLength])),
    id => tree.get(id)?.parent, asteroidDotBank);
  // The full context, for build-time tools: compact JSON (indentation was 60% of its bytes). Each row says what its body is
  // inside in the object tree, which a page reads from the file a row is in.
  await writeIfChanged(options.outputPath, `${JSON.stringify({ ...prepared, bodies: prepared.bodies.map(body => ({ ...body, inside: insideOf(body.id) })) })}\n`);
  // Each file is in its own object's package, in the objects directory this bake writes for (a fixture's, or the checkout's).
  const objectsRoot = worldFilesRoot(options);
  // The map draws those stars as dots, not as bodies. A star of a galaxy whose bank merges its star packages (the Milky
  // Way's volume) is one of that galaxy's own dots (`source/packaged-stars`, written by paged-star-dot-positions.mts). The
  // stars no such table names are dots of the object they are inside in the object tree (another galaxy; for a star bound to another,
  // that star's system), in that object's own package (`prepared/plain-stars.bin`, served as `/world/dots/<object id>.bin`),
  // about its centre: a page asks for a bank only while that object or a body inside it is selected. As two banks of the
  // world's own, they were two requests and 5.8 KB on every page (2026-10-03).
  const galaxyStars = await packagedGalaxyStars(objectsRoot);
  const starsInside = new Map<string, { id: string; positionM: typeof prepared.focus.positionM; color: string }[]>();
  for (const body of plainStars) {
    if (galaxyStars.has(body.id)) continue;
    const holder = insideOf(body.id);
    (starsInside.get(holder) ?? starsInside.set(holder, []).get(holder)!).push({ id: body.id, positionM: body.positionM, color: body.color });
  }
  const frames = new Map(registered.map(object => [object.id, object.worldFrame] as const));
  const dotBanks = [...starsInside].sort(([a], [b]) => a.localeCompare(b)).map(([id, stars]) => {
    const centre = frames.get(id);
    if (!centre) throw new TypeError(`${stars[0]!.id} is inside ${id}, which the registry does not place (src/objects/${id}/object.json properties.worldFrame): its dots have no centre.`);
    return { id, bank: plainStarDotBank(id, stars, { referenceFrame: prepared.frame.referenceFrame, epochJdTt: prepared.frame.epochJdTt, originM: centre.originM })! };
  });
  for (const { id, bank } of dotBanks) await writeCatalogueBank({ objectDirectory: resolve(objectsRoot, id), id: bank.id, bank, published: true, inventory: async () => undefined });
  // The Sun's package held the world's own banks before the root's did.
  for (const id of [PLAIN_STAR_DOT_BANK, RETIRED_PLAIN_STAR_DOT_BANK]) await rm(resolve(dirname(options.outputPath), `${id}.bin`), { force: true });
  // The summary and the build's index are in the root object's package, the object nothing is outside of. The summary names
  // the objects this bake wrote a dot bank for, so the site asks for no other.
  await writeIfChanged(worldSummaryPath(objectsRoot), `${JSON.stringify({ ...summary, ...(dotBanks.length ? { dotBanks: dotBanks.map(({ id }) => id) } : {}) })}\n`);
  // Read by the build and Node tools only: every body's place in the world's order, and the rows object entries carry.
  await writeIfChanged(worldIndexPath(objectsRoot), `${JSON.stringify(index)}\n`);
  for (const old of ['world-stars.json', 'world-context-summary.json', 'world-index.json']) await rm(resolve(dirname(options.outputPath), old), { force: true });
  // Each holder is an object: a star's system, or the asteroid dot bank. Its members are its own package's prepared file,
  // published with it; a holder without a package is refused, named.
  const holders = new Set<string>(), placed = new Set<string>();
  // An orbit bank is in the package of the file that pins it, packed for delivery (@cssearth/objects prepared-binary.ts);
  // the pin is of its unpacked bytes.
  const bankOf = new Map(banks.map(bank => [bank.id, bank] as const)), pinnedBy = new Map<string, string>(), orbits = new Map<string, Set<string>>();
  const writeOrbits = async (holderId: string, pins: Readonly<Record<string, number>>) => {
    for (const id of Object.keys(pins)) {
      const bank = bankOf.get(id), other = pinnedBy.get(id);
      if (!bank) throw new TypeError(`World file ${holderId} pins the orbit bank of ${id}, which this bake did not write.`);
      if (other !== undefined) throw new TypeError(`World files ${other} and ${holderId} both pin the orbit bank of ${id}: each orbit's body is in one file.`);
      pinnedBy.set(id, holderId);
      (orbits.get(holderId) ?? orbits.set(holderId, new Set()).get(holderId)!).add(`${id}.bin`);
      const name = `orbits/${id}.bin`;
      await writeIfChanged(orbitBankPath(objectsRoot, holderId, id), packPreparedBinary(bank.bytes, worldOrbitBankRegions(bank.bytes, name), name));
    }
  };
  await writeOrbits(OBJECT_TREE_ROOT, summary.orbitBanks ?? {});
  for (const system of systems) {
    // Every file's object is an object of the registry, or the asteroid dot bank: anything else has no package.
    if (!tree.has(system.id) && system.id !== asteroidDotBank) throw new TypeError(`World file ${system.id} has no package (src/objects/${system.id}/object.json): run node site/build/prepare/system-packages.mts.`);
    holders.add(system.id);
    await writeIfChanged(memberFilePath(objectsRoot, system.id), `${JSON.stringify(system.file)}\n`);
    await writeOrbits(system.id, system.file.orbitBanks);
  }
  const unpinned = banks.filter(bank => !pinnedBy.has(bank.id)).map(bank => bank.id);
  if (unpinned.length) throw new TypeError(`No world file pins the orbit bank of ${unpinned.slice(0, 5).join(', ')}${unpinned.length > 5 ? ` and ${unpinned.length - 5} more` : ''}: each orbit's body is in one file.`);
  for (const table of places) {
    placed.add(table.id);
    await writeIfChanged(placesFilePath(objectsRoot, table.id), `${JSON.stringify(table.file)}\n`);
  }
  // A package that holds no members, places or orbit any more loses its file, and the Sun's old folders of them go.
  for (const entry of await readdir(objectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (!holders.has(entry.name)) await rm(memberFilePath(objectsRoot, entry.name), { force: true });
    if (!placed.has(entry.name)) await rm(placesFilePath(objectsRoot, entry.name), { force: true });
    const directory = resolve(objectsRoot, entry.name, 'prepared', 'orbits'), kept = orbits.get(entry.name);
    for (const name of await readdir(directory).catch(() => [] as string[])) if (!kept?.has(name)) await rm(resolve(directory, name));
    // Only an object with plain stars inside it holds their dot bank.
    if (!starsInside.has(entry.name)) await rm(resolve(objectsRoot, entry.name, 'prepared', `${PLAIN_STAR_DOT_BANK}.bin`), { force: true });
    await rm(resolve(objectsRoot, entry.name, 'prepared', `${RETIRED_PLAIN_STAR_DOT_BANK}.bin`), { force: true });
  }
  for (const old of ['world-systems', 'world-orbits']) await rm(resolve(dirname(options.outputPath), old), { recursive: true, force: true });
  await rm(resolve(dirname(options.outputPath), 'world-orbits.bin'), { force: true });
  // System framing's camera candidates, one file per host, read when navigation frames that system: each in the package of
  // the system the host is inside (its parent), which a host with members always is.
  const owned = new Map<string, Set<string>>();
  for (const view of worldSystemViews(prepared)) {
    const owner = tree.get(view.id)?.parent;
    if (owner === undefined) throw new TypeError(`src/objects/${view.id}/object.json: ${view.id} draws a system, so it is inside its system object, but it names no parent: run node site/build/prepare/system-packages.mts.`);
    const file = resolve(objectsRoot, owner, 'prepared', systemViewFile(view.id));
    if (!tree.has(owner)) throw new TypeError(`The system view of ${view.id} belongs to ${owner}, which has no package (src/objects/${owner}/object.json): run node site/build/prepare/system-packages.mts.`);
    (owned.get(owner) ?? owned.set(owner, new Set()).get(owner)!).add(`${view.id}.json`);
    await writeIfChanged(file, `${JSON.stringify(view)}\n`);
  }
  for (const entry of await readdir(objectsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = resolve(objectsRoot, entry.name, 'prepared', 'views'), kept = owned.get(entry.name);
    for (const name of await readdir(directory).catch(() => [] as string[])) if (!kept?.has(name)) await rm(resolve(directory, name));
  }
  await rm(resolve(dirname(options.outputPath), 'system-views'), { recursive: true, force: true });
  await rm(resolve(dirname(options.outputPath), 'world-system-views.json'), { force: true });
}

/** The star packages that are dots of a galaxy's own bank, by id: the names of each bank's tracked table
 * (`source/packaged-stars/positions.csv.gz`, written by paged-star-dot-positions.mts for the bank that declares one). An
 * objects folder without such a table (a fixture) has none. */
async function packagedGalaxyStars(objectsRoot: string): Promise<ReadonlySet<string>> {
  const folders = (await readdir(objectsRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const tables = await Promise.all(folders.map(async id => {
    const path = resolve(objectsRoot, id, 'source/packaged-stars/positions.csv.gz');
    const bytes = await readFile(path).catch((error: unknown) => { if (isMissingFile(error)) return null; throw error; });
    if (bytes === null) return [];
    const [header, ...rows] = gunzipSync(bytes).toString('utf8').trim().split('\n');
    if (header !== 'name,xKpc,yKpc,zKpc,color') throw new TypeError(`${path}: the header is ${JSON.stringify(header)}, not name,xKpc,yKpc,zKpc,color.`);
    return rows.map(row => row.slice(0, row.indexOf(',')));
  }));
  return new Set(tables.flat());
}

/** The objects directory the world's per-object files are written into: the one given; else the one the output is in, when
 * the output is an object's prepared file (`<objects>/<id>/prepared/world-context.json`); else the output's own folder, so a
 * run that writes its context anywhere else (a test's temporary folder) keeps every file it writes beside it. */
export function worldFilesRoot(options: Pick<SpatialContextPreparationOptions, 'outputPath' | 'objectsDirectory'>): string {
  if (options.objectsDirectory !== undefined) return options.objectsDirectory;
  const folder = dirname(options.outputPath);
  return basename(folder) === 'prepared' ? dirname(dirname(folder)) : folder;
}

/** The world file every page reads: the root object's prepared `world.json` (frame, camera and sky facts and the focus). */
export function worldSummaryPath(objectsRoot: string): string {
  return resolve(objectsRoot, OBJECT_TREE_ROOT, 'prepared', 'world.json');
}

/** The build's table of the world's order and the rows entries carry: the root object's prepared `world-index.json`. */
export function worldIndexPath(objectsRoot: string): string {
  return resolve(objectsRoot, OBJECT_TREE_ROOT, 'prepared', 'world-index.json');
}

/** A holder's members: its own package's prepared file (`src/objects/<holder>/prepared/members.json`). */
export function memberFilePath(objectsRoot: string, holderId: string): string {
  return resolve(objectsRoot, holderId, 'prepared', 'members.json');
}

/** Where an object's children's files read on approach are: its own package's prepared file (`places.json`). */
export function placesFilePath(objectsRoot: string, objectId: string): string {
  return resolve(objectsRoot, objectId, 'prepared', 'places.json');
}

/** A body's orbit bank: in the package of the object whose file pins it (`src/objects/<holder>/prepared/orbits/<body>.bin`). */
export function orbitBankPath(objectsRoot: string, holderId: string, bodyId: string): string {
  return resolve(objectsRoot, holderId, 'prepared', 'orbits', `${bodyId}.bin`);
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
