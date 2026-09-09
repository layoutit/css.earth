import type { WorldFrameRequest } from './world-frame-presenter.js';

export interface PreparedWorldFrame {
  current(): boolean;
  commit(camera: () => void): void;
}

/** Complete views cross the worker boundary together. New input replaces only
 * the pending request; normal motion never starves an already planned frame. */
export function createWorldFrameQueue(prepare: (request: WorldFrameRequest) => Promise<PreparedWorldFrame>) {
  let destroyed = false, running = false;
  let pending: WorldFrameRequest | null = null;
  let requested = 0, committed = 0, superseded = 0, discarded = 0;
  const pump = async () => {
    if (destroyed || running || !pending) return;
    const request = pending; pending = null;
    if (!request.current()) { discarded++; return; }
    running = true;
    try {
      const frame = await prepare(request);
      if (!destroyed && request.current()) {
        if (frame.current()) { frame.commit(request.commit); committed++; }
        else { discarded++; pending ??= request; }
      } else discarded++;
    } catch (error) {
      if (!destroyed && request.current()) request.fail(error);
    } finally {
      running = false;
      if (!destroyed) void pump();
    }
  };
  return {
    present(request: WorldFrameRequest) {
      if (destroyed) return;
      requested++; if (pending) superseded++;
      pending = request; void pump();
    },
    stats: () => ({ requested, committed, superseded, discarded, inFlight: Number(running), pending: Number(pending !== null) }),
    destroy() { destroyed = true; pending = null; },
  };
}
