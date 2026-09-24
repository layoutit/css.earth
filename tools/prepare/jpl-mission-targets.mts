import targets from '../../site/source/jpl-small-body-mission-targets.json' with { type: 'json' };
import { isRecord } from '@cssearth/core';

// This is identity binding, not an editorial selection: membership comes only
// from the vendored JPL target table. Unbound JPL targets are simply not yet
// registered cssEarth objects.
const objectBySbdbId = Object.freeze({
  a0000001: 'ceres',
  a0000004: 'vesta',
  a0000016: 'psyche',
  a0000021: 'lutetia',
  a0000243: 'ida',
  a0000253: 'mathilde',
  a0000443: 'eros',
  a0000617: 'patroclus',
  a0000951: 'gaspra',
  a0002867: 'steins',
  a0003548: 'eurybates',
  a0004179: 'toutatis',
  a0005535: 'annefrank',
  a0009969: 'braille',
  a0011351: 'leucus',
  a0015094: 'polymele',
  a0021900: 'orus',
  a0025143: 'itokawa',
  a0052246: 'donaldjohanson',
  a0065803: 'didymos',
  a0099942: 'apophis',
  a0101955: 'bennu',
  a0152830: 'dinkinesh',
  a0162173: 'ryugu',
  a0486958: 'arrokoth',
} satisfies Readonly<Record<string, string>>);

function sourceTargetIds(source: unknown) {
  if (!isRecord(source) || source.schema !== 'cssearth-jpl-small-body-mission-targets@1' || !Array.isArray(source.targets)) {
    throw new TypeError('Invalid JPL small-body mission-target source.');
  }
  const ids = source.targets.map(target => {
    if (!isRecord(target) || typeof target.sbdbId !== 'string' || typeof target.name !== 'string' ||
        !Array.isArray(target.missions) || !target.missions.every(mission => typeof mission === 'string')) {
      throw new TypeError('Invalid JPL small-body mission target.');
    }
    return target.sbdbId;
  });
  if (new Set(ids).size !== ids.length) throw new TypeError('Duplicate JPL small-body mission target.');
  return new Set(ids);
}

const sourceIds = sourceTargetIds(targets);
for (const sbdbId of Object.keys(objectBySbdbId)) if (!sourceIds.has(sbdbId)) {
  throw new TypeError(`cssEarth mission-target binding is absent from the JPL source: ${sbdbId}.`);
}

export const JPL_MISSION_TARGET_OBJECT_IDS = Object.freeze(Object.values(objectBySbdbId));
const objectIds = new Set<string>(JPL_MISSION_TARGET_OBJECT_IDS);

export function isJplMissionTarget(object: { id: string }): boolean {
  return objectIds.has(object.id);
}
