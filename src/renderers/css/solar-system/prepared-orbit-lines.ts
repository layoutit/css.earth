import { createRetainedLeafPool } from '../rendering/retained-leaf-pool.js';
import type { OrbitSegment } from './heliocentric-view.js';

/** Fixed unit-line instances, bound once. The shared camera planner supplies
 * final clipped transforms; this owner does not parse paths or reconstruct
 * geometry. A patch writes only changed slots, including changes on re-entry. */
export function mountPreparedOrbitLines(host: HTMLElement, capacity: number) {
  // About half a second of publications. Clipped chord counts oscillate across
  // block boundaries while the camera moves; a dip must not rebuild 64 leaf boxes.
  // A full zoom shows about 1.5% of the prepared capacity; the rest is never built.
  const pool = createRetainedLeafPool(host, capacity, 'context-orbit-block', { sparsePrefix: true, retainCommits: 30, lazy: true });
  const transforms = new Array<string>(capacity);
  const weights = new Float64Array(capacity).fill(NaN);
  let count = 0, transformWrites = 0;
  return {
    elements: pool.elements,
    publish(segments: readonly OrbitSegment[], values: readonly string[], indices?: ArrayLike<number>) {
      if (segments.length > capacity || values.length !== segments.length) throw new RangeError('Prepared orbit line capacity or transform count is invalid.');
      for (let cursor = 0; cursor < (indices?.length ?? segments.length); cursor++) {
        const slot = indices ? indices[cursor] : cursor;
        if (!Number.isSafeInteger(slot) || slot < 0 || slot >= segments.length) throw new RangeError('Orbit patch exceeds its prepared line bank.');
        const style = pool.element(slot).style;
        if (transforms[slot] !== values[slot]) {
          style.transform = values[slot]; transforms[slot] = values[slot]; transformWrites++;
        }
        const weight = segments[slot][4];
        if (weights[slot] !== weight) { style.opacity = String(weight); weights[slot] = weight; }
        pool.setVisible(slot, true);
      }
      for (let slot = segments.length; slot < count; slot++) pool.setVisible(slot, false);
      pool.commitVisibility(); count = segments.length;
    },
    stats: () => ({ ...pool.stats(), transformWrites, capacity }),
  };
}
