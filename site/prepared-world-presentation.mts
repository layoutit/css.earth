// Written by site/build/prepare/prepare-world-presentation.mts from the moon groups, the JPL mission targets and the galaxy
// and cluster presentation recipes; the browser only validates it. It lists no system: a page reads a system's members
// and framing from the bodies its world holds (site/object-systems.mts, site/system-framing.mts).
import prepared from './prepared-world-presentation.json' with { type: 'json' };
import { requireRecord, requireString, isRecord } from '@cssearth/core';

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

/** Each category's framed box (prepareCategoryFrames), by classification: a centre and two corners relative to it, in metres. */
function categoryFrames(value: unknown) {
  if (!isRecord(value)) throw new TypeError(`Prepared world presentation categoryFrames must map classifications to boxes; got ${typeof value}.`);
  const vector = (input: unknown, name: string): readonly [number, number, number] => {
    if (!Array.isArray(input) || input.length !== 3 || !input.every(Number.isFinite)) {
      throw new TypeError(`Prepared world presentation categoryFrames.${name} must be three finite numbers; got ${JSON.stringify(input)}.`);
    }
    return Object.freeze([input[0], input[1], input[2]] as const);
  };
  return new Map(Object.entries(value).map(([classification, frame]) => {
    if (!isRecord(frame)) throw new TypeError(`Prepared world presentation categoryFrames.${classification} must be a box.`);
    const minimumM = vector(frame.minimumM, `${classification}.minimumM`), maximumM = vector(frame.maximumM, `${classification}.maximumM`);
    if (minimumM.some((value, axis) => value > maximumM[axis]!)) throw new TypeError(`Prepared world presentation categoryFrames.${classification} has a minimum beyond its maximum.`);
    // Present when the pill marks and frames only the category's notable members.
    const memberIds = frame.memberIds === undefined ? undefined : new Set(ids(frame.memberIds, `categoryFrames.${classification}.memberIds`));
    // The placed stars that carry the members' mark from afar.
    const hostIds = frame.hostIds === undefined ? undefined : ids(frame.hostIds, `categoryFrames.${classification}.hostIds`);
    return [classification, Object.freeze({ centreM: vector(frame.centreM, `${classification}.centreM`), minimumM, maximumM,
      ...(memberIds ? { memberIds } : {}), ...(hostIds ? { hostIds } : {}) })] as const;
  }));
}

function parseWorldPresentation(value: unknown) {
  if (!isRecord(value) || value.schema !== 'cssearth-world-presentation@5' || !isRecord(value.moons)) {
    throw new TypeError(`site/prepared-world-presentation.json is ${isRecord(value) ? String(value.schema) : typeof value}, not cssearth-world-presentation@5; run pnpm prepare:world-context.`);
  }
  return Object.freeze({
    satelliteSystemIntroductions: Object.freeze(Object.fromEntries(Object.entries(requireRecord(value.satelliteSystemIntroductions)).map(([id, text]) => [id, requireString(text)]))),
    moons: Object.freeze({ major: ids(value.moons.major, 'moons.major'), minor: ids(value.moons.minor, 'moons.minor') }),
    defaultFeatureIds: ids(value.defaultFeatureIds, 'defaultFeatureIds'),
    orbitFeatureIds: ids(value.orbitFeatureIds, 'orbitFeatureIds'),
    hiddenOrbitIds: ids(value.hiddenOrbitIds, 'hiddenOrbitIds'),
    galaxies: distances(value.galaxies, 'galaxies', ['fadeStartDistanceM', 'fullDistanceM', 'maximumDistanceM', 'minimumDistanceRadii', 'defaultFocusRadiusM', 'metersPerParsec']),
    clusters: distances(value.clusters, 'clusters', ['fadeStartDistanceM', 'fullDistanceM']),
    categoryFrames: categoryFrames(value.categoryFrames),
  });
}

export const PREPARED_WORLD_PRESENTATION = parseWorldPresentation(prepared);
