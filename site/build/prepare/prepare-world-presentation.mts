import { pathToFileURL } from 'node:url';
/** `node site/build/prepare/prepare-world-presentation.mts`: the world view's static presentation facts, prepared once from their
 * sources so the browser reads one small file instead of source tables and recipes: which moons are major, which orbits
 * the default view hides, which objects are default features, and the galaxy and cluster fade distances. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import majorMoons from '../../source/major-moons.json' with { type: 'json' };
import galaxies from '../../../src/objects/local-group/source/presentation.json' with { type: 'json' };
import clusters from '../../../src/objects/galaxy-clusters/source/presentation.json' with { type: 'json' };
import type { ObjectDiscovery } from '@cssearth/objects';
import { APPLICATION_WORLD_CONTEXT } from '../../world-context-plan.mts';
import { sourceArray, sourceId, sourceObject, sourceUnique } from '@cssearth/objects/sources';
import { isJplMissionTarget } from './jpl-mission-targets.mts';
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

/** The default context suppresses distant orbit classes and limits asteroid orbits to JPL spacecraft targets. */
export function showsDefaultContextOrbit(object: { id: string; classification: string }): boolean {
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

export function prepareWorldPresentation() {
  const minor = minorMoonOrbitIds(APPLICATION_WORLD_CONTEXT.bodies);
  return {
    schema: 'cssearth-world-presentation@1',
    moons: { major: majorMoonIds(), minor },
    defaultFeatureIds: SCENE_OBJECTS.filter(isDefaultContextFeature).map(object => object.id),
    orbitFeatureIds: SCENE_OBJECTS.filter(orbitFeature).map(object => object.id),
    // A trans-Neptunian object drawn from its record alone (tools/objects/prepare-spatial-context.ts) hides its orbit like a packaged one.
    hiddenOrbitIds: [...SCENE_OBJECTS.filter(object => !showsDefaultContextOrbit(object)).map(object => object.id), ...minor,
      ...APPLICATION_WORLD_CONTEXT.bodies.filter(body => 'unpackaged' in body && body.unpackaged === true && 'orbit' in body && body.orbit?.centerBodyId === 'sun').map(body => body.id)],
    galaxies: { fadeStartDistanceM: galaxies.fadeStartDistanceM, fullDistanceM: galaxies.fullDistanceM, maximumDistanceM: galaxies.maximumDistanceM,
      minimumDistanceRadii: galaxies.minimumDistanceRadii, defaultFocusRadiusM: galaxies.defaultFocusRadiusM, metersPerParsec: galaxies.metersPerParsec },
    clusters: { fadeStartDistanceM: clusters.fadeStartDistanceM, fullDistanceM: clusters.fullDistanceM },
  };
}

/** Write site/prepared-world-presentation.json, leaving an unchanged file untouched. */
export async function writeWorldPresentation() {
  const text = `${JSON.stringify(prepareWorldPresentation())}\n`;
  await mkdir(dirname(output), { recursive: true });
  if (await readFile(output, 'utf8').catch(() => null) !== text) await writeFile(output, text);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await writeWorldPresentation();
}
