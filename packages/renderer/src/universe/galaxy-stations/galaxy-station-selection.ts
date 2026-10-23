import { eyeDistanceM } from '@cssearth/engine';
import type { VolumeCameraPublication } from '../../volume/types.js';

/** A station is a complete prepared sky plus fixed pieces, not a direction-dependent visibility cut. */
export interface GalaxyStationLocation {
  readonly id: string;
  readonly positionM: readonly [number, number, number];
}
export interface GalaxyStationSelection {
  readonly requestedId: string;
  readonly residentIds: readonly string[];
  readonly backId: string | null;
  readonly frontId: string | null;
  readonly frontOpacity: number;
  readonly requestedIds?: readonly string[];
  readonly weights?: Readonly<Record<string, number>>;
}

/** Position owns the station; time owns its dissolve. Readiness never removes the previous scene. */
export function createGalaxyStationSelection(stations: readonly GalaxyStationLocation[], options: {
  readonly hysteresisM: number;
  readonly fadeMs: number;
  readonly interpolation?: { readonly paths: readonly (readonly string[])[] };
  readonly maximumStations?: number;
}) {
  if (!stations.length || new Set(stations.map(station => station.id)).size !== stations.length ||
    stations.some(station => !station.id || station.positionM.length !== 3 || station.positionM.some(value => !Number.isFinite(value))) ||
    !Number.isFinite(options.hysteresisM) || options.hysteresisM < 0 || !Number.isFinite(options.fadeMs) || options.fadeMs <= 0) {
    throw new TypeError('Galaxy stations need unique ids, finite positions, nonnegative hysteresis and a positive fade time.');
  }
  let back: GalaxyStationLocation | null = null, front: GalaxyStationLocation | null = null, started = 0;
  let lastNow = -Infinity;
  let staged: readonly string[] = [];
  return {
    publish(publication: VolumeCameraPublication, now: number, coasting: boolean, ready: ReadonlySet<string>): GalaxyStationSelection {
      if (!Number.isFinite(now) || now < lastNow) throw new TypeError('Station clock must be finite and monotonic.');
      lastNow = now;
      const distances = new Map(stations.map(station => [station.id, eyeDistanceM(publication.world.pose, station.positionM)]));
      if (options.interpolation) {
        const candidates = options.interpolation.paths.flatMap(path => path.slice(1).map((id, i) => {
          const a = stations.find(s => s.id === path[i])!, b = stations.find(s => s.id === id)!;
          const length = Math.hypot(...a.positionM.map((v, j) => v - b.positionM[j]!));
          const da = distances.get(a.id)!, db = distances.get(b.id)!;
          const t = Math.max(0, Math.min(1, (da * da + length * length - db * db) / (2 * length * length)));
          const distance = Math.max(0, da * da * (1 - t) + db * db * t - length * length * t * (1 - t));
          return { a, b, t, distance, path, index: i };
        }));
        const target = candidates.reduce((a, b) => a.distance <= b.distance ? a : b);
        // Keep the enclosing pair and the closest other route samples. Long driven flights
        // advance this local window; an unsteered coast clamps to its already staged horizon.
        const routeIds = new Set(options.interpolation.paths.flat());
        const nearest = stations.filter(s => routeIds.has(s.id) && s.id !== target.a.id && s.id !== target.b.id)
          .sort((a, b) => distances.get(a.id)! - distances.get(b.id)! || a.id.localeCompare(b.id));
        const maximum = options.maximumStations ?? 4;
        const requestedIds = [target.a.id, target.b.id, ...nearest.slice(0, maximum - 2).map(s => s.id)];
        if (!coasting) {
          const next = requestedIds.filter(id => ready.has(id));
          // Retain the preceding enclosing pair until the incoming pair has decoded.
          if (!ready.has(target.a.id) || !ready.has(target.b.id)) {
            const previous = candidates.filter(c => staged.includes(c.a.id) && staged.includes(c.b.id))
              .sort((a, b) => a.distance - b.distance)[0];
            if (previous) for (const id of [previous.a.id, previous.b.id]) if (!next.includes(id)) next.unshift(id);
          }
          // One old complete scene is sufficient during a teleport. Free the other slot
          // for the incoming pair instead of deadlocking three residents against its decode.
          if ((!ready.has(target.a.id) || !ready.has(target.b.id)) && next.length >= maximum) {
            const targetReady = [target.a.id, target.b.id].filter(id => ready.has(id));
            const held = next.filter(id => !targetReady.includes(id)).sort((a, b) => distances.get(a)! - distances.get(b)!);
            staged = [...targetReady, ...held].slice(0, maximum - 1);
          } else staged = next;
        }
        // Incoming files decode while detached. A coast sees only the segment staged before it began.
        const available = candidates.filter(c => staged.includes(c.a.id) && staged.includes(c.b.id));
        const chosen = available.length ? available.reduce((a, b) => a.distance <= b.distance ? a : b) : null;
        const weights: Record<string, number> = Object.fromEntries(staged.map(id => [id, 0]));
        if (chosen) { weights[chosen.a.id] = 1 - chosen.t; weights[chosen.b.id] = chosen.t; }
        else if (staged.length) weights[staged[0]!] = 1;
        return { requestedId: requestedIds.find(id => !ready.has(id)) ?? target.a.id, requestedIds,
          residentIds: staged, backId: chosen?.a.id ?? null, frontId: chosen?.b.id ?? null, frontOpacity: chosen?.t ?? 0, weights };
      }
      const nearest = [...stations].sort((a, b) => distances.get(a.id)! - distances.get(b.id)! || a.id.localeCompare(b.id))[0]!;
      // A completed dissolve retains both roots through a coast. Detaching waits for stillness.
      if (front && now - started >= options.fadeMs && !coasting) { back = front; front = null; }
      const lead = front ?? back;
      const wanted = lead && distances.get(lead.id)! <= distances.get(nearest.id)! + options.hysteresisM ? lead : nearest;
      if (!back && !coasting && ready.has(wanted.id)) back = wanted;
      else if (back && !front && wanted.id !== back.id && !coasting && ready.has(wanted.id)) { front = wanted; started = now; }
      const t = front ? Math.min(1, Math.max(0, (now - started) / options.fadeMs)) : 0;
      return { requestedId: wanted.id, residentIds: [back?.id, front?.id].filter((id): id is string => id !== undefined),
        backId: back?.id ?? null, frontId: front?.id ?? null, frontOpacity: t * t * (3 - 2 * t) };
    },
  };
}
