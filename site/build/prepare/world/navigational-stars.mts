import list from '../../../source/usno-navigational-stars.json' with { type: 'json' };
import { isRecord } from '@cssearth/core';

// The famous stars are a published list, not a selection made here: the 57 stars, and Polaris, that the Nautical and Air
// Almanacs print for navigation, as the US Naval Observatory's service returns them. This binds each to its cssEarth object
// by the name the source prints. A star of the list without a binding has no page yet.
const objectByName = Object.freeze({
  'Schedar': 'schedar',
  'Diphda': 'diphda',
  'ACHERNAR': 'achernar',
  'Hamal': 'hamal',
  'Menkar': 'menkar',
  'Mirfak': 'mirfak',
  'ALDEBARAN': 'aldebaran',
  'RIGEL': 'rigel',
  'CAPELLA': 'capella',
  'Bellatrix': 'bellatrix',
  'Elnath': 'elnath',
  'Alnilam': 'alnilam',
  'BETELGEUSE': 'betelgeuse',
  'CANOPUS': 'canopus',
  'SIRIUS': 'sirius',
  'Adhara': 'adhara',
  'PROCYON': 'procyon',
  'POLLUX': 'pollux',
  'Miaplacidus': 'miaplacidus',
  'Alphard': 'alphard',
  'REGULUS': 'regulus',
  'Dubhe': 'dubhe',
  'Denebola': 'denebola',
  'Gienah': 'gienah',
  'Alioth': 'alioth',
  'SPICA': 'spica',
  'Alkaid': 'alkaid',
  'ARCTURUS': 'arcturus',
  'RIGIL KENTAURUS': 'alpha-centauri-a',
  'Kochab': 'kochab',
  'Alphecca': 'alphecca',
  'ANTARES': 'antares',
  'Atria': 'atria',
  'Rasalhague': 'rasalhague',
  'Eltanin': 'eltanin',
  'Kaus Australis': 'kaus-australis',
  'VEGA': 'vega',
  'ALTAIR': 'altair',
  'Peacock': 'peacock',
  'DENEB': 'deneb',
  'Enif': 'enif',
  'Alnair': 'alnair',
  'FOMALHAUT': 'fomalhaut',
  'Markab': 'markab',
  'POLARIS': 'polaris',
} satisfies Readonly<Record<string, string>>);

function sourceNames(source: unknown) {
  if (!isRecord(source) || source.schema !== 'cssearth-usno-navigational-stars@1' || !Array.isArray(source.stars)) {
    throw new TypeError('Invalid navigational-star source.');
  }
  const names = source.stars.map(star => {
    if (!isRecord(star) || typeof star.name !== 'string' || star.number !== undefined && !Number.isInteger(star.number)) {
      throw new TypeError('Invalid navigational star.');
    }
    return star.name;
  });
  if (new Set(names).size !== names.length) throw new TypeError('Duplicate navigational star.');
  return names;
}

/** The names the source prints, in its order. */
export const NAVIGATIONAL_STAR_NAMES: readonly string[] = Object.freeze(sourceNames(list));
for (const name of Object.keys(objectByName)) if (!NAVIGATIONAL_STAR_NAMES.includes(name)) {
  throw new TypeError(`cssEarth navigational-star binding is absent from the source: ${name}.`);
}

export const NAVIGATIONAL_STAR_OBJECT_IDS: readonly string[] = Object.freeze(Object.values(objectByName));
const objectIds = new Set<string>(NAVIGATIONAL_STAR_OBJECT_IDS);

/** The stars of the list that have no page yet, by the source's names. */
export const UNBOUND_NAVIGATIONAL_STARS: readonly string[] = Object.freeze(NAVIGATIONAL_STAR_NAMES.filter(name => !(name in objectByName)));

export function isNavigationalStar(object: { id: string }): boolean {
  return objectIds.has(object.id);
}
