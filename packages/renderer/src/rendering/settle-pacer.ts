import type { CameraMotionSignal } from '../navigation/camera-motion-signal.js';

/**
 * When deferred retained-DOM work runs: after the camera stops, a slice per frame, sized by what the previous slice cost.
 * The runtime contract's "motion freezes membership" (docs/performance/motion-freezes-membership.md) holds reveals,
 * retirements, restacking and level swaps while the camera moves; they land here once it has stopped, without one
 * frame paying for all of them. What to write stays with each owner: the pacer only says when, and how much.
 *
 * Units per frame, to start with: a whole-body leaf-box switch of the Moon's 448 leaves took 300 ms in the iOS
 * simulator, so 16 leaves are about 10 ms there. The budget follows the frames it causes: after a frame longer than
 * SLOW_FRAME_MS it halves and the pacer waits a frame; after a short one it grows back. A frame takes at least one unit.
 */
export const SETTLE_PACING = Object.freeze({ startUnits: 16, maximumUnits: 64, slowFrameMs: 25, quickFrameMs: 20,
  /** Without a motion signal, the camera counts as moving until SETTLE_MS after its last view change. A stepped mouse
   * wheel leaves gaps between notches (up to 666 ms in a recorded Saturn zoom); SETTLE_MS outlasts them. */
  settleMs: 750 });

/** One owner's slice: write up to `budget` units and return how many were written. `moving` is true while the camera
 * moves: a slice then writes only what the contract allows mid-motion (a first step, a staged residency), else 0. */
export type SettleSlice = (budget: number, moving: boolean) => number;

export interface SettlePacerOptions {
  frame: ((callback: (now?: number) => void) => unknown) | null;
  clock?: () => number;
  later?: (callback: () => void, milliseconds: number) => void;
  /** The input surface's motion signal; without it, motion is inferred from `published()` calls. */
  motion?: CameraMotionSignal | null;
  /** What holds the work: any camera motion (a leaf-box repaint waits for the view to stop), or only a coast on inertia
   * (membership: driven motion stays live). */
  holdWhile?: 'motion' | 'coasting';
}

export function createSettlePacer(slice: SettleSlice, { frame, clock = () => globalThis.performance?.now() ?? Date.now(),
  later = (callback, milliseconds) => { globalThis.setTimeout(callback, milliseconds); }, motion = null, holdWhile = 'motion' }: SettlePacerOptions) {
  let budget: number = SETTLE_PACING.startUnits, scheduled = false, wrote = false, last: number | null = null;
  let published = -Infinity, waking = false;
  const moving = () => motion ? (holdWhile === 'coasting' ? motion.coasting : motion.active) : clock() - published < SETTLE_PACING.settleMs;
  const drain = (now?: number) => {
    scheduled = false;
    // The frame since the last slice carried its cost: pace the next slice by it.
    const spent = wrote && last !== null && now !== undefined ? now - last : null;
    last = now ?? null;
    if (spent !== null && spent > SETTLE_PACING.slowFrameMs) { budget = Math.max(1, budget / 2); wrote = false; schedule(); return; }
    if (spent !== null && spent < SETTLE_PACING.quickFrameMs) budget = Math.min(SETTLE_PACING.maximumUnits, budget * 1.5);
    const stillMoving = moving();
    wrote = slice(budget, stillMoving) > 0;
    if (wrote) schedule();
    else if (stillMoving) wakeWhenStill();
  };
  const schedule = () => { if (!scheduled && frame) { scheduled = true; frame(drain); } };
  // With a signal the change to still wakes the pacer; without one, a timer after the last publication.
  const wakeWhenStill = () => {
    if (motion || waking) return;
    waking = true;
    later(() => { waking = false; schedule(); }, Math.max(0, SETTLE_PACING.settleMs - (clock() - published)));
  };
  const unsubscribe = motion?.subscribe(() => { if (!moving()) schedule(); }) ?? (() => {});
  return {
    /** A view was published: without a signal, the camera counts as moving from now. */
    published() { published = clock(); },
    /** Work is pending: a slice runs on the next frame once the camera has stopped. `urgent` work (what the contract lets
     * land mid-motion: a first step, a staged residency) runs on the next frame even while it moves. Without a frame
     * (a native response, a test) everything is written now. */
    request(urgent = false) { if (!frame) { slice(Infinity, false); return; } if (urgent || !moving()) schedule(); else wakeWhenStill(); },
    moving,
    destroy() { unsubscribe(); frame = null; },
  };
}
