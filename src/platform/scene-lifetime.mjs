const CANCELLED = Object.freeze({ cancelled: true });

// Owns cleanup, not rendering, readiness policy, or browser playback policy.
export function createSceneLifetime() {
  let disposed = false;
  const owners = [];
  const waiters = new Set();
  return Object.freeze({
    get disposed() { return disposed; },
    onDispose(callback) {
      if (typeof callback !== "function") throw new TypeError("Cleanup must be a function.");
      if (disposed) return clean(callback);
      owners.push(callback);
      return [];
    },
    wait(promise) {
      return new Promise((resolve, reject) => {
        let settled = false;
        const cancel = () => settle(resolve, CANCELLED);
        function settle(finish, value) {
          if (settled) return;
          settled = true;
          waiters.delete(cancel);
          finish(value);
        }
        if (disposed) cancel();
        else waiters.add(cancel);
        // Observe even a disposed wait: native work can still reject later.
        Promise.resolve(promise).then(
          (value) => settle(resolve, { cancelled: false, value }),
          (error) => settle(reject, error),
        );
      });
    },
    destroy() {
      if (disposed) return [];
      disposed = true;
      for (const cancel of waiters) cancel();
      const errors = [];
      while (owners.length) errors.push(...clean(owners.pop()));
      return errors;
    },
    stats() {
      return Object.freeze({ disposed, ownerCount: owners.length, waiterCount: waiters.size });
    },
  });
}

function clean(callback) {
  try { callback(); return []; } catch (error) { return [error]; }
}

// These are startup waits: one bounded owner per mount, not per animation frame.
export function waitForScenePaint(lifetime, windowTarget = window) {
  if (lifetime.disposed) return Promise.resolve();
  return new Promise((resolve) => {
    let frame = 0;
    lifetime.onDispose(() => {
      if (frame) windowTarget.cancelAnimationFrame(frame);
      frame = 0;
      resolve();
    });
    frame = windowTarget.requestAnimationFrame(() => {
      frame = 0;
      if (lifetime.disposed) return;
      frame = windowTarget.requestAnimationFrame(() => { frame = 0; resolve(); });
    });
  });
}

export function waitForSceneDocument(lifetime, documentTarget = document) {
  if (lifetime.disposed || documentTarget.readyState !== "loading") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      documentTarget.removeEventListener("DOMContentLoaded", done);
      resolve();
    };
    lifetime.onDispose(done);
    documentTarget.addEventListener("DOMContentLoaded", done, { once: true });
  });
}
