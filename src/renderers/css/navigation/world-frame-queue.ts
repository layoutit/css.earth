import type { WorldFrameRequest } from './world-frame-presenter.js';

export interface PreparedWorldFrame {
  current(): boolean;
  commit(camera: () => void): void;
}

/** Complete views cross the worker boundary together. New input replaces only
 * the pending request; normal motion never starves an already planned frame. */
export function createWorldFrameQueue(prepare: (request: WorldFrameRequest) => Promise<PreparedWorldFrame>) {
  let destroyed = false;
  let running: WorldFrameRequest | null = null;
  let latest: WorldFrameRequest | null = null;
  let pending: WorldFrameRequest | null = null;
  let requested = 0, committed = 0, superseded = 0, discarded = 0;
  const pump = async () => {
    if (destroyed || running || !pending) return;
    const request = pending; pending = null;
    if (!request.current()) { discarded++; return; }
    running = request;
    try {
      const frame = await prepare(request);
      if (!destroyed && request.current()) {
        if (frame.current()) { frame.commit(request.commit); committed++; }
        else { discarded++; pending ??= request; }
      } else discarded++;
    } catch (error) {
      if (!destroyed && request.current()) request.fail(error);
    } finally {
      running = null;
      if (!destroyed) void pump();
    }
  };
  return {
    present(request: WorldFrameRequest) {
      if (destroyed) return;
      latest = request;
      requested++; if (pending) superseded++;
      pending = request; void pump();
    },
    // Initial mounting commits synchronously. Retain that owner's captured
    // camera so an idle hover/selection can use the same worker as motion.
    remember(request: WorldFrameRequest) { if (!destroyed) latest = request; },
    refresh() {
      if (destroyed || !latest?.current()) return false;
      // A changed presentation revision invalidates an in-flight plan. Let it
      // replan the newest input; never replace pending motion with an old eye.
      if (pending || running === latest) return true;
      requested++;
      pending = latest; void pump();
      return true;
    },
    stats: () => ({ requested, committed, superseded, discarded, inFlight: Number(running !== null), pending: Number(pending !== null) }),
    destroy() { destroyed = true; pending = null; latest = null; },
  };
}
