import { isRecord } from '@cssearth/core';

/**
 * A distance an object's zoom facts name, measured from the star the zoom is centred on: a fixed distance, a point of the
 * world plan's fade of the centre's planetary system or of the galaxy (its start, the geometric middle, its end), or the end
 * of the galaxy captions' handoff. The application computes the named ones from the prepared world plan; the object only
 * says which it uses.
 */
export type ZoomDistance =
  | { readonly distancePc: number }
  | { readonly fade: 'system' | 'galaxy'; readonly at: 'start' | 'middle' | 'end' }
  | { readonly labels: 'galaxy-handoff-end' };

/** How an object seen from inside frames the camera on its page: at a distance, at the geometric middle of two, or fitting
 * the galaxies inside it. */
export type ZoomFrame =
  | { readonly distance: ZoomDistance }
  | { readonly between: readonly [ZoomDistance, ZoomDistance] }
  | { readonly fit: 'drawn-galaxies' };

/**
 * The zoom facts of an object seen from inside (the Milky Way, the Local Group, the Nearby and the Observable Universe):
 * backing out of something inside it, the camera hands the view over to it past `enter`, and back below `returnBelow`
 * (lower, so the view does not flicker at the edge); its page frames the camera at `frame`. Which objects the view hands
 * over to, and in what order, is the object tree: the objects a body is inside, nearest first
 * (packages/objects/src/registry/object-tree.ts). Its package authors these under `properties.zoom`.
 */
export interface ObjectZoom { readonly enter: ZoomDistance; readonly returnBelow: ZoomDistance; readonly frame: ZoomFrame }

const only = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));

function distance(value: unknown, at: string): ZoomDistance {
  const fail = (): never => { throw new TypeError(`${at} is a distance: {distancePc > 0}, {fade: system|galaxy, at: start|middle|end} or {labels: galaxy-handoff-end}, not ${JSON.stringify(value)}.`); };
  if (!isRecord(value)) return fail();
  if ('distancePc' in value) return only(value, ['distancePc']) && typeof value.distancePc === 'number' && value.distancePc > 0 && Number.isFinite(value.distancePc)
    ? Object.freeze({ distancePc: value.distancePc }) : fail();
  if ('fade' in value) return only(value, ['fade', 'at']) && (value.fade === 'system' || value.fade === 'galaxy') && (value.at === 'start' || value.at === 'middle' || value.at === 'end')
    ? Object.freeze({ fade: value.fade, at: value.at }) : fail();
  return only(value, ['labels']) && value.labels === 'galaxy-handoff-end' ? Object.freeze({ labels: value.labels }) : fail();
}

/** The zoom facts a package's descriptor authors under `properties.zoom`; null when it authors none. */
export function objectZoom(descriptor: unknown): ObjectZoom | null {
  if (!isRecord(descriptor) || !isRecord(descriptor.properties) || descriptor.properties.zoom === undefined) return null;
  const value = descriptor.properties.zoom, at = `src/objects/${String(descriptor.id)}/object.json properties.zoom`;
  if (!isRecord(value) || !only(value, ['enter', 'returnBelow', 'frame']) || !isRecord(value.frame)) {
    throw new TypeError(`${at} names enter, returnBelow and frame, not ${JSON.stringify(value)}.`);
  }
  const frame = value.frame, frameAt = `${at}.frame`;
  const parsedFrame: ZoomFrame = 'distance' in frame && only(frame, ['distance']) ? Object.freeze({ distance: distance(frame.distance, `${frameAt}.distance`) })
    : 'between' in frame && only(frame, ['between']) && Array.isArray(frame.between) && frame.between.length === 2
      ? Object.freeze({ between: Object.freeze([distance(frame.between[0], `${frameAt}.between[0]`), distance(frame.between[1], `${frameAt}.between[1]`)] as const) })
      : 'fit' in frame && only(frame, ['fit']) && frame.fit === 'drawn-galaxies' ? Object.freeze({ fit: 'drawn-galaxies' as const })
        : (() => { throw new TypeError(`${frameAt} is {distance}, {between: [two distances]} or {fit: drawn-galaxies}, not ${JSON.stringify(frame)}.`); })();
  return Object.freeze({ enter: distance(value.enter, `${at}.enter`), returnBelow: distance(value.returnBelow, `${at}.returnBelow`), frame: parsedFrame });
}
