import { isRecord } from '@cssearth/core';
import type { ObjectClassification, ObjectWorldFrame } from './object-schema.js';

/**
 * A distance on the zoom ladder, measured from the star the zoom is centred on: a fixed distance, a point of the world
 * plan's fade of the centre's planetary system or of the galaxy (its start, the geometric middle, its end), or the end of
 * the galaxy captions' handoff. The application computes the named ones from the prepared world plan; the overview only
 * says which it uses.
 */
export type OverviewDistance =
  | { readonly distancePc: number }
  | { readonly fade: 'system' | 'galaxy'; readonly at: 'start' | 'middle' | 'end' }
  | { readonly labels: 'galaxy-handoff-end' };

/** How the page of an overview frames the camera: at a distance, at the geometric middle of two, or fitting the drawn
 * galaxies of the Local Group catalogue. */
export type OverviewFrame =
  | { readonly distance: OverviewDistance }
  | { readonly between: readonly [OverviewDistance, OverviewDistance] }
  | { readonly fit: 'drawn-galaxies' };

/** A level's place on the zoom ladder: the camera enters it past `enter` and falls back below `returnBelow` (lower, so the
 * view does not flicker at the edge). A level with `centreWithin` is only reached from a centre that close to the world's
 * centre (the Milky Way is the view from inside the galaxy). */
export interface OverviewZoom {
  readonly enter: OverviewDistance; readonly returnBelow: OverviewDistance; readonly centreWithin?: OverviewDistance;
  readonly frame: OverviewFrame;
}

/** Registry subjects of these classifications belong to the level: their breadcrumbs lead to it, and with a `list` label
 * its card lists them under that tab. */
export interface OverviewHolding { readonly classifications: readonly string[]; readonly list?: string }

/**
 * A level above the star systems (the Milky Way, the Local Group, the nearby and the observable universe), as the zoom
 * ladder reads it. Each is an object of the registry with a scene of its own, seen from inside around the star the zoom is
 * centred on; its package authors its place on the ladder under `properties.overview`. This is that object's ladder data
 * with the identity the ladder needs.
 */
export interface OverviewObject {
  readonly id: string;
  readonly name: string;
  /** The card's introduction and the page's description. */
  readonly description: string;
  /** Its place on the zoom ladder, from the nearest level out; breadcrumbs list the levels in this order. */
  readonly order: number;
  readonly zoom: OverviewZoom;
  readonly holds: readonly OverviewHolding[];
  /** The context packages the world draws for it (the galaxy's volume, the catalogue of galaxy clusters). */
  readonly packages: readonly string[];
  readonly classification: ObjectClassification;
  readonly classificationLabel?: string;
  /** Where it is: the Galactic centre, the Local Group's barycentre, or the observer. */
  readonly worldFrame: ObjectWorldFrame;
  readonly route: string;
}

const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0;
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]*$/u.test(value);
const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));

function distance(value: unknown, at: string): OverviewDistance {
  const fail = (): never => { throw new TypeError(`${at} is a distance: {distancePc > 0}, {fade: system|galaxy, at: start|middle|end} or {labels: galaxy-handoff-end}, not ${JSON.stringify(value)}.`); };
  if (!isRecord(value)) return fail();
  if ('distancePc' in value) return only(value, ['distancePc']) && typeof value.distancePc === 'number' && value.distancePc > 0 && Number.isFinite(value.distancePc)
    ? Object.freeze({ distancePc: value.distancePc }) : fail();
  if ('fade' in value) return only(value, ['fade', 'at']) && (value.fade === 'system' || value.fade === 'galaxy') && (value.at === 'start' || value.at === 'middle' || value.at === 'end')
    ? Object.freeze({ fade: value.fade, at: value.at }) : fail();
  return only(value, ['labels']) && value.labels === 'galaxy-handoff-end' ? Object.freeze({ labels: value.labels }) : fail();
}

function zoom(value: unknown, at: string): OverviewZoom {
  if (!isRecord(value) || !only(value, ['enter', 'returnBelow', 'centreWithin', 'frame']) || !isRecord(value.frame)) {
    throw new TypeError(`${at} names enter, returnBelow, an optional centreWithin and frame, not ${JSON.stringify(value)}.`);
  }
  const frame = value.frame, frameAt = `${at}.frame`;
  const parsedFrame: OverviewFrame = 'distance' in frame && only(frame, ['distance']) ? Object.freeze({ distance: distance(frame.distance, `${frameAt}.distance`) })
    : 'between' in frame && only(frame, ['between']) && Array.isArray(frame.between) && frame.between.length === 2
      ? Object.freeze({ between: Object.freeze([distance(frame.between[0], `${frameAt}.between[0]`), distance(frame.between[1], `${frameAt}.between[1]`)] as const) })
      : 'fit' in frame && only(frame, ['fit']) && frame.fit === 'drawn-galaxies' ? Object.freeze({ fit: 'drawn-galaxies' as const })
        : (() => { throw new TypeError(`${frameAt} is {distance}, {between: [two distances]} or {fit: drawn-galaxies}, not ${JSON.stringify(frame)}.`); })();
  return Object.freeze({ enter: distance(value.enter, `${at}.enter`), returnBelow: distance(value.returnBelow, `${at}.returnBelow`),
    ...(value.centreWithin === undefined ? {} : { centreWithin: distance(value.centreWithin, `${at}.centreWithin`) }), frame: parsedFrame });
}

function holds(value: unknown, at: string): readonly OverviewHolding[] {
  if (!Array.isArray(value)) throw new TypeError(`${at} lists the classifications the level holds, not ${JSON.stringify(value)}.`);
  const seen = new Set<string>();
  return Object.freeze(value.map((group: unknown, index) => {
    if (!isRecord(group) || !only(group, ['classifications', 'list']) || !Array.isArray(group.classifications) || !group.classifications.length
      || !group.classifications.every(identifier) || (group.list !== undefined && !text(group.list))) {
      throw new TypeError(`${at}[${index}] names its classifications and an optional list label, not ${JSON.stringify(group)}.`);
    }
    for (const classification of group.classifications) {
      if (seen.has(classification)) throw new TypeError(`${at}[${index}] repeats the classification ${classification}.`);
      seen.add(classification);
    }
    return Object.freeze({ classifications: Object.freeze([...group.classifications]), ...(group.list === undefined ? {} : { list: group.list as string }) });
  }));
}

/** The ladder data a package's descriptor authors under `properties.overview`: its order, zoom, what it holds and the
 * context packages the world draws for it. Null when it authors none. Its name and description are its catalogue entry's. */
export function overviewLevel(descriptor: unknown): { readonly order: number; readonly zoom: OverviewZoom;
  readonly holds: readonly OverviewHolding[]; readonly packages: readonly string[] } | null {
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.overview === undefined) return null;
  const overview = descriptor.properties.overview, id = String(descriptor.id);
  if (!isRecord(overview) || !only(overview, ['order', 'zoom', 'holds', 'packages']) || !Number.isSafeInteger(overview.order) || Number(overview.order) < 1
      || (overview.packages !== undefined && !(Array.isArray(overview.packages) && overview.packages.every(identifier)))) {
    throw new TypeError(`Invalid overview metadata: ${id}; it names its order (from 1), zoom and holds, with optional packages.`);
  }
  return Object.freeze({ order: overview.order as number, zoom: zoom(overview.zoom, `${id} zoom`), holds: holds(overview.holds, `${id} holds`),
    packages: Object.freeze([...(overview.packages ?? []) as string[]]) });
}

/** The level that holds registry subjects of `classification`, among `overviews`; undefined when none does. */
export function overviewHolding<Level extends Pick<OverviewObject, 'holds'>>(overviews: readonly Level[], classification: string): Level | undefined {
  return overviews.find(overview => overview.holds.some(group => group.classifications.includes(classification)));
}
