import type { PositionM } from '@cssearth/engine';
import { systemFadeDistances } from '@cssearth/renderer/universe/world-context/context-scale.ts';
import { APPLICATION_WORLD_CONTEXT as context, loadWorldHolder, worldSystemHeld } from './world-context-plan.mts';

/** A system is read this many times farther out than its bodies are drawn, so its file is in before they fade in. */
const APPROACH_LEAD = 2;

/** Reads a star's holder when the camera comes near it. The world holds no list of other systems' bodies: each star
 * something orbits is a holder, its own file, and `/world/hosts.json` gives every such star's place and the range its
 * orbits are authored to. A system's bodies are drawn within its fade distance of its star (`systemFadeDistances`, the
 * renderer's own), so a holder is read once the camera is within `APPROACH_LEAD` times that. Navigation reads the holder
 * of the body it flies to on its own (world-context-plan.mts). */
export function createWorldApproach() {
  let hosts: { readonly id: string; readonly positionM: PositionM; readonly reachM: number }[] | null = null;
  let last: PositionM | null = null, started = false;
  const check = (eyeM: PositionM) => {
    if (!hosts) return;
    let pending = 0;
    for (const host of hosts) {
      if (worldSystemHeld(host.id)) continue;
      pending++;
      const dx = host.positionM[0] - eyeM[0], dy = host.positionM[1] - eyeM[1], dz = host.positionM[2] - eyeM[2];
      if (dx * dx + dy * dy + dz * dz > host.reachM * host.reachM) continue;
      void loadWorldHolder(host.id).catch(error => console.error(`The holder of ${host.id} could not be read as the camera came near.`, error));
    }
    if (!pending) hosts = [];
  };
  return {
    /** Read the stars' places, once: after the page's first view. */
    start() {
      if (started) return;
      started = true;
      void (async () => {
        const response = await fetch('/world/hosts.json');
        if (!response.ok) throw new Error(`/world/hosts.json request failed: ${response.status}.`);
        const table = await response.json() as { id?: unknown; positionM?: unknown; orbitsWithinM?: unknown };
        const { id, positionM, orbitsWithinM } = table;
        if (!Array.isArray(id) || !Array.isArray(positionM) || !Array.isArray(orbitsWithinM) || positionM.length !== id.length || orbitsWithinM.length !== id.length) {
          throw new TypeError('/world/hosts.json must hold id, positionM and orbitsWithinM columns of one length.');
        }
        hosts = id.map((host, index) => {
          const at: unknown = positionM[index], range: unknown = orbitsWithinM[index];
          if (typeof host !== 'string' || !Array.isArray(at) || at.length !== 3 || !at.every(Number.isFinite) || !(range === null || typeof range === 'number' && range > 0)) {
            throw new TypeError(`/world/hosts.json row ${index} (${String(host)}) must be an id, three finite metres and a range or null.`);
          }
          return { id: host, positionM: [at[0], at[1], at[2]] as PositionM,
            reachM: systemFadeDistances(context.system, range ?? undefined).hiddenDistanceM * APPROACH_LEAD };
        });
        if (last) check(last);
      })().catch(error => console.error('The stars whose systems load on approach could not be read; navigation still reads each system it flies to.', error));
    },
    /** The camera of a published frame, in the world's frame. */
    observe(eyeM: PositionM) {
      last = eyeM;
      check(eyeM);
    },
  };
}
