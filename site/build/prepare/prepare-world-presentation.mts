import { pathToFileURL } from 'node:url';
/** `node site/build/prepare/prepare-world-presentation.mts`: the world view's static presentation facts, prepared once from their
 * sources so the browser reads one small file instead of source tables and recipes: which moons are major, which orbits
 * the default view hides, which objects are default features, the galaxy and cluster fade distances, and which bodies each
 * planetary system holds (read from the world context's orbit graph once here, not by walking it in the browser), and the box
 * each header pill frames. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import majorMoons from '../../source/major-moons.json' with { type: 'json' };
import galaxies from '../../../src/objects/local-group-galaxies/source/presentation.json' with { type: 'json' };
import clusters from '../../../src/objects/galaxy-clusters/source/presentation.json' with { type: 'json' };
import { discoveryVisibility, type ObjectDiscovery } from '@cssearth/objects';
import { WORLD_OBJECTS } from '../../world-objects.mts';
import { APPLICATION_WORLD_CONTEXT, WORLD_SYSTEM_HOSTS } from '../../world-context-plan.mts';
import { systemFramingRadii } from '../../system-framing-radii.mts';
import { planetarySystemMembers } from '../../planetary-system-members.mts';
import { sourceArray, sourceId, sourceObject, sourceUnique } from '@cssearth/objects/sources';
import { isJplMissionTarget } from './jpl-mission-targets.mts';
import systemText from '../../../src/navigation/system-text.json' with { type: 'json' };
import { allSatelliteSystems } from '../../satellite-systems.mts';
import { readSourceCatalog } from '@cssearth/bake/sources';
import { prepareSystemIntroductions } from './system-text.mts';
import { readPreparedObjects } from '@cssearth/objects/node';
import { isExtremeTransNeptunian } from '@cssearth/astronomy';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;

const output = resolve(import.meta.dirname, '../../prepared-world-presentation.json');

const majorByParent = new Map(sourceArray(majorMoons.systems, input => {
  const system = sourceObject(input), ids = sourceArray(system.moons, sourceId);
  sourceUnique(ids, 'major moons');
  return [sourceId(system.id), new Set(ids)] as const;
}));

/** Every planet's major moons, from the sourced groups. */
export function majorMoonIds(): string[] {
  return [...majorByParent.values()].flatMap(moons => [...moons]);
}

/** Moons of a planet with a sourced major group that are not in it. */
export function minorMoonOrbitIds(bodies: readonly { id: string; orbit?: { centerBodyId: string } }[]): string[] {
  return bodies.filter(body => {
    const major = body.orbit && majorByParent.get(body.orbit.centerBodyId);
    return major && !major.has(body.id);
  }).map(body => body.id);
}

/** The default context suppresses distant orbit classes, admits only featured comets, and limits asteroid orbits to JPL spacecraft targets. */
export function showsDefaultContextOrbit(object: { id: string; classification: string; discovery: Pick<ObjectDiscovery, 'featured'> }): boolean {
  if (object.classification === 'comet') return object.discovery.featured;
  if (['trans-neptunian', 'interstellar'].includes(object.classification)) return false;
  return object.classification !== 'asteroid' || isJplMissionTarget(object);
}

/** Discovery prominence describes prepared content. Asteroid context prominence is instead sourced from JPL. */
export function isDefaultContextFeature(object: { id: string; classification: string; discovery: Pick<ObjectDiscovery, 'featured'> }): boolean {
  if (object.classification === 'asteroid') return isJplMissionTarget(object);
  return object.classification === 'dwarf-planet' || object.discovery.featured || orbitFeature(object);
}

/** A body the map shows as a named dot, placed by its measured orbit, even when its page is only an illustration: an extreme
 * trans-Neptunian object. Its orbit stays hidden with the other trans-Neptunian orbits. */
export function orbitFeature(object: { id: string; classification: string }): boolean {
  return object.classification === 'trans-neptunian' && isExtremeTransNeptunian(object.id);
}

/** Share of each category's members, nearest to the Sun first, that its header pill frames: a few distant outliers must not
 * shrink the rest to dots. Every member is still highlighted. */
export const CATEGORY_FRAMED_SHARE = .9;
type Position = readonly number[];
export interface CategoryFrame { readonly centreM: Position; readonly minimumM: Position; readonly maximumM: Position }

/** The reference-axis box around the nearest CATEGORY_FRAMED_SHARE of one category's members, centred on itself. Fewer than two
 * members, or members at one point, give no box: there is nothing to fit, and the pill only highlights. */
export function prepareCategoryFrame(positionsM: readonly Position[]): CategoryFrame | null {
  const framed = [...positionsM].sort((a, b) => Math.hypot(...a) - Math.hypot(...b)).slice(0, Math.ceil(positionsM.length * CATEGORY_FRAMED_SHARE));
  if (framed.length < 2) return null;
  const minimum = [0, 1, 2].map(axis => Math.min(...framed.map(position => position[axis]!)));
  const maximum = [0, 1, 2].map(axis => Math.max(...framed.map(position => position[axis]!)));
  if (minimum.every((value, axis) => value === maximum[axis])) return null;
  const centreM = minimum.map((value, axis) => (value + maximum[axis]!) / 2);
  return { centreM, minimumM: minimum.map((value, axis) => value - centreM[axis]!), maximumM: maximum.map((value, axis) => value - centreM[axis]!) };
}

/** Whether a body is notable: featured itself (a featured discovery or a default feature), or anywhere in the orbit tree of a
 * featured body, so every planet of a featured star is notable with it. `centreOf` names each body's orbit centre. */
export function notableBodies(worldObjects: readonly { id: string; discovery: { featured: boolean } }[], defaultFeatures: ReadonlySet<string>,
  centreOf: ReadonlyMap<string, string>) {
  const featured = new Set(worldObjects.filter(object => object.discovery.featured || defaultFeatures.has(object.id)).map(object => object.id));
  const notable = (id: string) => {
    // A cycle in the orbit graph is a preparation error elsewhere; the walk stops at the graph's size either way.
    for (let at: string | undefined = id, steps = 0; at !== undefined && steps <= centreOf.size; at = centreOf.get(at), steps++) if (featured.has(at)) return true;
    return false;
  };
  return new Set(worldObjects.filter(object => notable(object.id)).map(object => object.id));
}

/** Every category's frame, from the members its pill marks: the world's bodies it highlights with the default settings (the same
 * discoveryVisibility the browser runs): the galaxies, clusters and nebulae with a package are bodies among them. A category whose
 * notable bodies (notableBodies) are only some of its members, at least two, is marked and framed by those alone, listed as its
 * memberIds: the 40 notable exoplanets and stars, not all 865 and 2,174. hostIds lists the placed stars whose systems hold the
 * marked members: from afar a planet is drawn inside its star's dot, so the pill marks that star too. */
export function prepareCategoryFrames(worldObjects: typeof WORLD_OBJECTS,
  defaultFeatures: ReadonlySet<string>, orbitFeatures: ReadonlySet<string>, notable: ReadonlySet<string>,
  centreOf: ReadonlyMap<string, string>, worldHostId: string) {
  // Where a member is drawn from afar: inside the dot of the placed star its orbits lead to. The world's own host (the Sun) is
  // never one, so a pill marks another star only for its members' systems.
  const placedStars = new Set(worldObjects.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== worldHostId).map(object => object.id));
  const hostOf = (id: string) => {
    let at = id;
    for (let steps = 0; steps <= centreOf.size && centreOf.has(at); steps++) at = centreOf.get(at)!;
    return at !== id && placedStars.has(at) ? at : null;
  };
  const classifications = [...new Set(worldObjects.map(object => object.classification))].sort();
  return Object.fromEntries(classifications.flatMap(classification => {
    const marked = new Set(discoveryVisibility(worldObjects, { illustrations: false, highlighted: classification, defaultFeatures, orbitFeatures }).highlightedBodies);
    const bodies = worldObjects.filter(object => marked.has(object.id)), notables = bodies.filter(object => notable.has(object.id));
    const narrowed = notables.length >= 2 && notables.length < bodies.length;
    const frame = prepareCategoryFrame((narrowed ? notables : bodies).map(object => {
      // Preparation reads every system's file (site/world-context-plan.mts), so every body is placed.
      if (!object.worldFrame) throw new TypeError(`${object.id} has no world position; the world context read here lacks its system.`);
      return object.worldFrame.originM;
    }));
    const markedBodies = narrowed ? notables : bodies;
    const hostIds = [...new Set(markedBodies.flatMap(object => hostOf(object.id) ?? []))];
    return frame ? [[classification, { ...frame, ...(narrowed ? { memberIds: notables.map(object => object.id) } : {}), ...(hostIds.length ? { hostIds } : {}) }] as const] : [];
  }));
}

/** Each body's orbit centre, and each named centre's own (a circumbinary planet's barycentre leads to its host star). */
function orbitCentres(context: typeof APPLICATION_WORLD_CONTEXT): ReadonlyMap<string, string> {
  return new Map([...context.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []),
    ...Object.entries(context.orbitCenters ?? {}).map(([id, centre]) => [id, centre.centerBodyId] as const)]);
}

export function prepareWorldPresentation(satelliteSystemIntroductions: Readonly<Record<string, string>>) {
  const minor = minorMoonOrbitIds(APPLICATION_WORLD_CONTEXT.bodies);
  const defaultFeatureIds = SCENE_OBJECTS.filter(isDefaultContextFeature).map(object => object.id);
  const orbitFeatureIds = SCENE_OBJECTS.filter(orbitFeature).map(object => object.id);
  return {
    schema: 'cssearth-world-presentation@4',
    satelliteSystemIntroductions,
    moons: { major: majorMoonIds(), minor },
    defaultFeatureIds,
    orbitFeatureIds,
    hiddenOrbitIds: [...SCENE_OBJECTS.filter(object => !showsDefaultContextOrbit(object)).map(object => object.id), ...minor],
    planetarySystems: planetarySystemMembers(APPLICATION_WORLD_CONTEXT),
    galaxies: { fadeStartDistanceM: galaxies.fadeStartDistanceM, fullDistanceM: galaxies.fullDistanceM, maximumDistanceM: galaxies.maximumDistanceM,
      minimumDistanceRadii: galaxies.minimumDistanceRadii, defaultFocusRadiusM: galaxies.defaultFocusRadiusM, metersPerParsec: galaxies.metersPerParsec },
    clusters: { fadeStartDistanceM: clusters.fadeStartDistanceM, fullDistanceM: clusters.fullDistanceM },
    categoryFrames: prepareCategoryFrames(WORLD_OBJECTS, new Set(defaultFeatureIds), new Set(orbitFeatureIds),
      notableBodies(WORLD_OBJECTS, new Set(defaultFeatureIds), orbitCentres(APPLICATION_WORLD_CONTEXT)), orbitCentres(APPLICATION_WORLD_CONTEXT),
      APPLICATION_WORLD_CONTEXT.focus.id),
    // Every system whose bodies are their own file, framed before a page reads it (site/system-framing.mts).
    systemFramingRadii: Object.fromEntries([...systemFramingRadii(APPLICATION_WORLD_CONTEXT)].filter(([id]) => WORLD_SYSTEM_HOSTS.includes(id))),
  };
}

/** Write site/prepared-world-presentation.json, leaving an unchanged file untouched. */
export async function writeWorldPresentation() {
  const catalogue = await readSourceCatalog(resolve(import.meta.dirname, '../../..'));
  const introductions = prepareSystemIntroductions(systemText, allSatelliteSystems().map(system => system.hostId), new Set(catalogue.records.map(record => record.id)));
  const text = `${JSON.stringify(prepareWorldPresentation(introductions))}\n`;
  await mkdir(dirname(output), { recursive: true });
  if (await readFile(output, 'utf8').catch(() => null) !== text) await writeFile(output, text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeWorldPresentation();
}
