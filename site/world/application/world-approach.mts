import type { PositionM } from '@cssearth/engine';
import { systemFadeDistances } from '@cssearth/renderer/universe/world-context/context-scale.ts';
import { APPLICATION_WORLD_CONTEXT as context, loadWorldHolder, onWorldSystems, worldHolderRead, worldPlacedFiles } from '../../directory/world-context-plan.mts';

/** A system is read this many times farther out than its bodies are drawn, so its file is in before they fade in. */
const APPROACH_LEAD = 2;

/** Reads a system's file when the camera comes near it. The world holds no list of other systems' bodies: each object's file
 * has its children, and an object whose children are systems read on approach has `places.json`
 * (`pages/world/places/[id].json.ts`), each system's place and the range its orbits are authored to. A system's bodies are
 * drawn within its fade distance of its host (`systemFadeDistances`, the renderer's own), so its file is read once the camera
 * is within `APPROACH_LEAD` times that. Navigation reads the files of a body it flies to on its own (world-context-plan.mts). */
export function createWorldApproach() {
  const hosts: { readonly id: string; readonly positionM: PositionM; readonly reachM: number }[] = [];
  const asked = new Set<string>();
  let last: PositionM | null = null, started = false;
  const check = (eyeM: PositionM) => {
    for (const host of hosts) {
      if (worldHolderRead(host.id)) continue;
      const dx = host.positionM[0] - eyeM[0], dy = host.positionM[1] - eyeM[1], dz = host.positionM[2] - eyeM[2];
      if (dx * dx + dy * dy + dz * dz > host.reachM * host.reachM) continue;
      void loadWorldHolder(host.id).catch(error => console.error(`The file of ${host.id} could not be read as the camera came near.`, error));
    }
  };
  /** Reads the places of every file read that has them, once each. */
  const readPlaces = () => {
    for (const id of worldPlacedFiles()) {
      if (asked.has(id)) continue;
      asked.add(id);
      void (async () => {
        const response = await fetch(`/world/places/${id}.json`);
        if (!response.ok) throw new Error(`/world/places/${id}.json request failed: ${response.status}.`);
        const table = await response.json() as { id?: unknown; positionM?: unknown; orbitsWithinM?: unknown };
        const { id: ids, positionM, orbitsWithinM } = table;
        if (!Array.isArray(ids) || !Array.isArray(positionM) || !Array.isArray(orbitsWithinM) || positionM.length !== ids.length || orbitsWithinM.length !== ids.length) {
          throw new TypeError(`/world/places/${id}.json must hold id, positionM and orbitsWithinM columns of one length.`);
        }
        ids.forEach((host: unknown, index) => {
          const at: unknown = positionM[index], range: unknown = orbitsWithinM[index];
          if (typeof host !== 'string' || !Array.isArray(at) || at.length !== 3 || !at.every(Number.isFinite) || !(range === null || typeof range === 'number' && range > 0)) {
            throw new TypeError(`/world/places/${id}.json row ${index} (${String(host)}) must be an id, three finite metres and a range or null.`);
          }
          hosts.push({ id: host, positionM: [at[0], at[1], at[2]] as PositionM,
            reachM: systemFadeDistances(context.system, range ?? undefined).hiddenDistanceM * APPROACH_LEAD });
        });
        if (last) check(last);
      })().catch(error => console.error(`The places of ${id} could not be read; navigation still reads each system it flies to.`, error));
    }
  };
  return {
    /** Read the places, once each: after the page's first view, and of every file read after it. */
    start() {
      if (started) return;
      started = true;
      readPlaces();
      onWorldSystems(readPlaces);
    },
    /** The camera of a published frame, in the world's frame. */
    observe(eyeM: PositionM) {
      last = eyeM;
      check(eyeM);
    },
  };
}
