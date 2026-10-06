/** `node site/build/prepare/prepare-world-presentation.mts`: the world view's static presentation facts, prepared once from their
 * sources so the browser reads one small file instead of source tables and recipes: which moons are major, which orbits
 * the default view hides, which objects are default features, the galaxy and cluster fade distances, and which bodies each
 * planetary system holds (read from the world context's orbit graph once here, not by walking it in the browser), and the box
 * each header pill frames. */
import { readCataloguePresentationDistances, discoveryVisibility, type ObjectDiscovery } from '@cssearth/objects';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import majorMoons from '../../source/major-moons.json' with { type: 'json' };
import catalogueIds from '../../prepared/prepared-dot-catalogues.json' with { type: 'json' };
import { WORLD_OBJECTS } from '../../world/world-objects.mts';
import { ancestorsOf } from '../../directory/objects.mts';
import { APPLICATION_WORLD_CONTEXT } from '../../directory/world-context-plan.mts';
import { worldFilesOf } from '../../server/world-places.mts';
import { sourceArray, sourceId, sourceObject, sourceUnique } from '@cssearth/objects/sources';
import { isJplMissionTarget } from './jpl-mission-targets.mts';
import { readPreparedObjects } from '@cssearth/objects/node';
import { isExtremeTransNeptunian } from '@cssearth/astronomy';

const SCENE_OBJECTS = readPreparedObjects(resolve(import.meta.dirname, '../../..')).sceneObjects;

const output = resolve(import.meta.dirname, '../../prepared/prepared-world-presentation.json');

/** A dot layer's presentation record, with the distances named in `fields`. Its catalogue is the one context object of its
 * type (prepare-catalog.mts dotCatalogueIds), so no catalogue is named here. */
function layerPresentation<Field extends string>(layer: 'galaxies' | 'clusters', fields: readonly Field[]): Record<Field, number> {
  const id: unknown = (catalogueIds as Record<string, unknown>)[layer];
  if (typeof id !== 'string') throw new TypeError(`site/prepared/prepared-dot-catalogues.json names no catalogue for the ${layer} dot layer. Run pnpm prepare:catalog.`);
  const path = `src/objects/${id}/source/presentation.json`;
  return readCataloguePresentationDistances(JSON.parse(readFileSync(resolve(import.meta.dirname, '../../..', path), 'utf8')), fields);
}

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

/** The default context draws no orbit for an asteroid, a comet or a distant orbit class, and admits only featured dwarf planets. */
export function showsDefaultContextOrbit(object: { id: string; classification: string; discovery: Pick<ObjectDiscovery, 'featured'> }): boolean {
  if (object.classification === 'dwarf-planet') return object.discovery.featured;
  return !['asteroid', 'comet', 'trans-neptunian', 'interstellar'].includes(object.classification);
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

/** The members a pill frames: those inside the smallest region of the zoom (an object seen from inside: the Milky Way, the
 * Local Group, the Nearby Universe) that holds more than half of them; `regionsOf` names the regions a body is inside. A view
 * draws a category's markers at their own scale only: fitted around every star, the 21 in other galaxies put the camera 67
 * million light-years out, where the markers are galaxies and no star is drawn, and the galaxies' box reached the quasar
 * 3C 273, where the markers are clusters (css.earth 0.6928, 2026-10-06). Every member is still highlighted. Without a region
 * that holds most of them, every member is framed. */
export function framedMembers<Member extends { readonly id: string }>(members: readonly Member[], regionsOf: (id: string) => readonly string[]): readonly Member[] {
  const regions = new Map(members.map(member => [member.id, new Set(regionsOf(member.id))]));
  const held = new Map<string, number>();
  for (const inside of regions.values()) for (const region of inside) held.set(region, (held.get(region) ?? 0) + 1);
  // Regions nest, so of those holding most members the one holding the fewest is the smallest.
  const smallest = [...held].filter(([, count]) => count > members.length / 2).sort((a, b) => a[1] - b[1])[0]?.[0];
  return smallest === undefined ? members : members.filter(member => regions.get(member.id)!.has(smallest));
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
 * marked members: from afar a planet is drawn inside its star's dot, so the pill marks that star too. holderIds lists the
 * holder files that have marked members the summary does not. The box is fitted to the marked members `framedMembers` keeps. */
export function prepareCategoryFrames(worldObjects: typeof WORLD_OBJECTS,
  defaultFeatures: ReadonlySet<string>, orbitFeatures: ReadonlySet<string>, notable: ReadonlySet<string>,
  centreOf: ReadonlyMap<string, string>, worldHostId: string, holderFilesOf: (ids: readonly string[]) => readonly string[] = () => [],
  regionsOf: (id: string) => readonly string[] = () => []) {
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
    const markedBodies = narrowed ? notables : bodies;
    const frame = prepareCategoryFrame(framedMembers(markedBodies, regionsOf).map(object => {
      // Preparation reads every system's file (site/directory/world-context-plan.mts), so every body is placed.
      if (!object.worldFrame) throw new TypeError(`${object.id} has no world position; the world context read here lacks its system.`);
      return object.worldFrame.originM;
    }));
    const hostIds = [...new Set(markedBodies.flatMap(object => hostOf(object.id) ?? []))];
    // The holder files that have marked members the summary does not: a page reads them when the pill is highlighted.
    const holderIds = holderFilesOf(markedBodies.map(object => object.id));
    return frame ? [[classification, { ...frame, ...(narrowed ? { memberIds: notables.map(object => object.id) } : {}), ...(hostIds.length ? { hostIds } : {}),
      ...(holderIds.length ? { holderIds } : {}) }] as const] : [];
  }));
}

/** Each body's orbit centre, and each named centre's own (a circumbinary planet's barycentre leads to its host star). */
function orbitCentres(context: typeof APPLICATION_WORLD_CONTEXT): ReadonlyMap<string, string> {
  return new Map([...context.bodies.flatMap(body => body.orbit ? [[body.id, body.orbit.centerBodyId] as const] : []),
    ...Object.entries(context.orbitCenters ?? {}).map(([id, centre]) => [id, centre.centerBodyId] as const)]);
}

export function prepareWorldPresentation() {
  const minor = minorMoonOrbitIds(APPLICATION_WORLD_CONTEXT.bodies);
  const defaultFeatureIds = SCENE_OBJECTS.filter(isDefaultContextFeature).map(object => object.id);
  const orbitFeatureIds = SCENE_OBJECTS.filter(orbitFeature).map(object => object.id);
  return {
    schema: 'cssearth-world-presentation@6',
    moons: { major: majorMoonIds(), minor },
    defaultFeatureIds,
    orbitFeatureIds,
    hiddenOrbitIds: [...SCENE_OBJECTS.filter(object => !showsDefaultContextOrbit(object)).map(object => object.id), ...minor],
    galaxies: layerPresentation('galaxies', ['fadeStartDistanceM', 'fullDistanceM', 'maximumDistanceM', 'minimumDistanceRadii', 'defaultFocusRadiusM', 'metersPerParsec']),
    clusters: layerPresentation('clusters', ['fadeStartDistanceM', 'fullDistanceM']),
    categoryFrames: prepareCategoryFrames(WORLD_OBJECTS, new Set(defaultFeatureIds), new Set(orbitFeatureIds),
      notableBodies(WORLD_OBJECTS, new Set(defaultFeatureIds), orbitCentres(APPLICATION_WORLD_CONTEXT)), orbitCentres(APPLICATION_WORLD_CONTEXT),
      APPLICATION_WORLD_CONTEXT.focus.id, worldFilesOf,
      // The objects seen from inside that a body is inside (their `zoom` facts make them the zoom's regions).
      id => ancestorsOf(id).filter(object => object.zoom !== undefined).map(object => object.id)),
  };
}

/** Write site/prepared/prepared-world-presentation.json, leaving an unchanged file untouched. */
export async function writeWorldPresentation() {
  const text = `${JSON.stringify(prepareWorldPresentation())}\n`;
  await mkdir(dirname(output), { recursive: true });
  if (await readFile(output, 'utf8').catch(() => null) !== text) await writeFile(output, text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeWorldPresentation();
}
