// Written by site/build/prepare/prepare-world-presentation.mts from the moon groups, the JPL mission targets, the galaxy and
// cluster presentation recipes and the world context's orbit graph; the browser only validates it.
import prepared from './prepared-world-presentation.json' with { type: 'json' };
import { isRecord } from '@cssearth/core';

const ids = (value: unknown, name: string): readonly string[] => {
  if (!Array.isArray(value) || !value.every(id => typeof id === 'string' && id.length > 0)) throw new TypeError(`Prepared world presentation ${name} must list object ids.`);
  return Object.freeze([...value] as string[]);
};
const distances = <K extends string>(value: unknown, name: string, keys: readonly K[]): Readonly<Record<K, number>> => {
  if (!isRecord(value)) throw new TypeError(`Prepared world presentation ${name} is missing.`);
  for (const key of keys) if (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || (value[key] as number) <= 0) {
    throw new TypeError(`Prepared world presentation ${name}.${key} must be a positive number; got ${String(value[key])}.`);
  }
  return Object.freeze(Object.fromEntries(keys.map(key => [key, value[key] as number]))) as Readonly<Record<K, number>>;
};

/** Each candidate system host with its members (site/planetary-system-members.mts); every id is listed once. */
function planetarySystems(value: unknown) {
  if (!Array.isArray(value)) throw new TypeError(`Prepared world presentation planetarySystems must be a list; got ${typeof value}.`);
  const seen = new Set<string>();
  return Object.freeze(value.map((input, index) => {
    if (!isRecord(input) || typeof input.id !== 'string' || !input.id) {
      throw new TypeError(`Prepared world presentation planetarySystems[${index}].id must be an object id; got ${JSON.stringify(isRecord(input) ? input.id : input)}.`);
    }
    const memberIds = ids(input.memberIds, `planetarySystems[${index}] (${input.id}).memberIds`);
    for (const id of [input.id, ...memberIds]) {
      if (seen.has(id)) throw new TypeError(`Prepared world presentation planetarySystems[${index}] (${input.id}) lists ${id}, which another system already lists.`);
      seen.add(id);
    }
    return Object.freeze({ id: input.id, memberIds });
  }));
}

function parseWorldPresentation(value: unknown) {
  if (!isRecord(value) || value.schema !== 'cssearth-world-presentation@2' || !isRecord(value.moons)) {
    throw new TypeError(`site/prepared-world-presentation.json is ${isRecord(value) ? String(value.schema) : typeof value}, not cssearth-world-presentation@2; run pnpm prepare:world-context.`);
  }
  return Object.freeze({
    moons: Object.freeze({ major: ids(value.moons.major, 'moons.major'), minor: ids(value.moons.minor, 'moons.minor') }),
    defaultFeatureIds: ids(value.defaultFeatureIds, 'defaultFeatureIds'),
    orbitFeatureIds: ids(value.orbitFeatureIds, 'orbitFeatureIds'),
    hiddenOrbitIds: ids(value.hiddenOrbitIds, 'hiddenOrbitIds'),
    planetarySystems: planetarySystems(value.planetarySystems),
    galaxies: distances(value.galaxies, 'galaxies', ['fadeStartDistanceM', 'fullDistanceM', 'maximumDistanceM', 'minimumDistanceRadii', 'defaultFocusRadiusM', 'metersPerParsec']),
    clusters: distances(value.clusters, 'clusters', ['fadeStartDistanceM', 'fullDistanceM']),
  });
}

export const PREPARED_WORLD_PRESENTATION = parseWorldPresentation(prepared);
