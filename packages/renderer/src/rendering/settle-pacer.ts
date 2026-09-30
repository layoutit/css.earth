import type { CameraMotionSignal } from '../navigation/camera-motion-signal.js';
import { opacityClockFor, type OpacityWindow } from '../stars/opacity-clock.js';

/**
 * When deferred retained-DOM work runs, and how much of it a frame takes. The runtime contract's "motion freezes
 * membership" (docs/performance/motion-freezes-membership.md) holds reveals, retirements, restacking and level swaps
 * while the camera moves; they land here once it has stopped, without one frame paying for all of them. What to write
 * stays with each owner: the pacer only says when, and how much.
 *
 * A document has one pacer (`framePacerFor`), on its one frame clock (opacity-clock.ts), and one budget a frame shared
 * by every owner: two owners with their own budgets could each spend a full frame's worth in the same frame.
 *
 * Units per frame, to start with: a whole-body leaf-box switch of the Moon's 448 leaves took 300 ms in the iOS
 * simulator, so 16 leaves are about 10 ms there. The budget follows the frames it causes: after a frame longer than
 * SLOW_FRAME_MS it halves and the pacer waits a frame; after a short one it grows back. The first owner a frame serves
 * takes at least one unit, so work always advances.
 */
export const SETTLE_PACING = Object.freeze({ startUnits: 16, maximumUnits: 64, slowFrameMs: 25, quickFrameMs: 20,
  /** Without a motion signal, the camera counts as moving until SETTLE_MS after its last view change. A stepped mouse
   * wheel leaves gaps between notches (up to 666 ms in a recorded Saturn zoom); SETTLE_MS outlasts them. */
  settleMs: 750 });

/** One owner's slice: write up to `budget` units and return how many were written. `moving` is true while the camera
 * moves: a slice then writes only what the contract allows mid-motion (a first step, a staged residency), else 0. */
export type SettleSlice = (budget: number, moving: boolean) => number;

type FrameRequest = (callback: (now?: number) => void) => unknown;
interface PacedOwner { wanted: boolean; run(budget: number): number }

/** The frame loop behind every owner of a document: one request a frame, one budget shared in turn. It holds an owner
 * only while that owner has work waiting, so a retired scene's owners are never kept. */
export function createFramePacer(frame: FrameRequest, pacing: { readonly startUnits: number; readonly maximumUnits: number; readonly slowFrameMs: number; readonly quickFrameMs: number } = SETTLE_PACING) {
  const owners = new Set<PacedOwner>();
  let budget: number = pacing.startUnits, scheduled = false, wrote = false, last: number | null = null, turn = 0;
  const schedule = () => { if (!scheduled) { scheduled = true; frame(drain); } };
  function drain(now?: number) {
    scheduled = false;
    // The frame since the last slice carried its cost: pace the next slice by it.
    const spent = wrote && last !== null && now !== undefined ? now - last : null;
    last = now ?? null;
    if (spent !== null && spent > pacing.slowFrameMs) { budget = Math.max(1, budget / 2); wrote = false; schedule(); return; }
    if (spent !== null && spent < pacing.quickFrameMs) budget = Math.min(pacing.maximumUnits, budget * 1.5);
    wrote = false;
    // Owners take the budget in turn, starting one further each frame, so no owner waits behind another's backlog.
    const waiting = [...owners].filter(owner => owner.wanted);
    let left = budget;
    for (let index = 0; index < waiting.length; index++) {
      const owner = waiting[(turn + index) % waiting.length]!;
      if (left <= 0) break;
      owner.wanted = false;
      const written = owner.run(left);
      if (written > 0) { wrote = true; left -= written; }
    }
    turn++;
    for (const owner of owners) if (!owner.wanted) owners.delete(owner);
    if (owners.size) schedule();
  }
  return {
    /** Ask for an owner's next slice. */
    request(owner: PacedOwner) { owner.wanted = true; owners.add(owner); schedule(); },
    /** Drop an owner's waiting slice. */
    cancel(owner: PacedOwner) { owner.wanted = false; owners.delete(owner); },
  };
}
export type FramePacer = ReturnType<typeof createFramePacer>;

const pacers = new WeakMap<OpacityWindow, FramePacer>();
/** The document's pacer, on its frame clock. */
export function framePacerFor(window: OpacityWindow): FramePacer {
  let pacer = pacers.get(window);
  if (!pacer) {
    const clock = opacityClockFor(window);
    pacers.set(window, pacer = createFramePacer(callback => clock.request(callback)));
  }
  return pacer;
}
const documentPacer = (): FramePacer | null => {
  const view = globalThis as unknown as Partial<OpacityWindow>;
  return typeof view.requestAnimationFrame === 'function' && view.performance ? framePacerFor(view as OpacityWindow) : null;
};

export interface SettlePacerOptions {
  /** The pacer to join: the document's by default. A frame request (a test) gets a pacer of its own; null writes
   * everything at once (a native response, a test). */
  frame?: FrameRequest | FramePacer | null;
  clock?: () => number;
  later?: (callback: () => void, milliseconds: number) => void;
  /** The input surface's motion signal; without it, motion is inferred from `published()` calls. */
  motion?: CameraMotionSignal | null;
  /** What holds the work: any camera motion (a leaf-box repaint waits for the view to stop), only a coast on inertia
   * (membership: driven motion stays live), or nothing (a reveal or a mount that must land during a flight). */
  holdWhile?: 'motion' | 'coasting' | 'never';
}

export function createSettlePacer(slice: SettleSlice, { frame, clock = () => globalThis.performance?.now() ?? Date.now(),
  later = (callback, milliseconds) => { globalThis.setTimeout(callback, milliseconds); }, motion = null, holdWhile = 'motion' }: SettlePacerOptions = {}) {
  const pacer: FramePacer | null = frame === null ? null : frame === undefined ? documentPacer()
    : typeof frame === 'function' ? createFramePacer(frame) : frame;
  let published = -Infinity, waking = false, destroyed = false;
  const moving = () => holdWhile === 'never' ? false : motion ? (holdWhile === 'coasting' ? motion.coasting : motion.active)
    : clock() - published < SETTLE_PACING.settleMs;
  const owner: PacedOwner = { wanted: false, run(budget) {
    if (destroyed) return 0;
    const stillMoving = moving();
    const written = slice(budget, stillMoving);
    if (written > 0) owner.wanted = true;
    else if (stillMoving) wakeWhenStill();
    return written;
  } };
  const schedule = () => { if (!destroyed) pacer?.request(owner); };
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
     * land mid-motion: a first step, a staged residency) runs on the next frame even while it moves. Without a pacer
     * (a native response, a test) everything is written now. */
    request(urgent = false) { if (!pacer) { while (!destroyed && slice(Infinity, false) > 0); return; } if (urgent || !moving()) schedule(); else wakeWhenStill(); },
    moving,
    destroy() { destroyed = true; unsubscribe(); pacer?.cancel(owner); },
  };
}
