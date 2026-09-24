// Written by tools/prepare/prepare-world-presentation.mts from the moon groups, the JPL mission targets and the galaxy and
// cluster presentation recipes; the browser only validates it.
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

function parseWorldPresentation(value: unknown) {
  if (!isRecord(value) || value.schema !== 'cssearth-world-presentation@1' || !isRecord(value.moons)) {
    throw new TypeError('site/prepared-world-presentation.json is not cssearth-world-presentation@1; run pnpm prepare:world-context.');
  }
  return Object.freeze({
    moons: Object.freeze({ major: ids(value.moons.major, 'moons.major'), minor: ids(value.moons.minor, 'moons.minor') }),
    defaultFeatureIds: ids(value.defaultFeatureIds, 'defaultFeatureIds'),
    hiddenOrbitIds: ids(value.hiddenOrbitIds, 'hiddenOrbitIds'),
    galaxies: distances(value.galaxies, 'galaxies', ['fadeStartDistanceM', 'fullDistanceM', 'maximumDistanceM', 'minimumDistanceRadii', 'defaultFocusRadiusM', 'metersPerParsec']),
    clusters: distances(value.clusters, 'clusters', ['fadeStartDistanceM', 'fullDistanceM']),
  });
}

export const PREPARED_WORLD_PRESENTATION = parseWorldPresentation(prepared);
