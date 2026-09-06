export type Cleanup = () => void;
export type WaitResult<T> = { readonly cancelled: true } | { readonly cancelled: false; readonly value: T };
const CANCELLED = Object.freeze({ cancelled: true } as const);

export interface SceneLifetime {
  readonly disposed: boolean;
  onDispose(callback: Cleanup): unknown[];
  wait<T>(promise: T | PromiseLike<T>): Promise<WaitResult<T>>;
  destroy(): unknown[];
  stats(): Readonly<{ disposed: boolean; ownerCount: number; waiterCount: number }>;
}

export function createSceneLifetime(): SceneLifetime {
  let disposed = false;
  const owners: Cleanup[] = [];
  const waiters = new Set<Cleanup>();
  return Object.freeze({
    get disposed() { return disposed; },
    onDispose(callback: Cleanup) {
      if (typeof callback !== 'function') throw new TypeError('Cleanup must be a function.');
      if (disposed) return clean(callback);
      owners.push(callback);
      return [];
    },
    wait<T>(promise: T | PromiseLike<T>): Promise<WaitResult<T>> {
      return new Promise((resolve, reject) => {
        let settled = false;
        const claim = () => {
          if (settled) return false;
          settled = true;
          waiters.delete(cancel);
          return true;
        };
        const cancel = () => { if (claim()) resolve(CANCELLED); };
        if (disposed) cancel();
        else waiters.add(cancel);
        // Observe native rejection even when this owner has already retired.
        Promise.resolve(promise).then(
          value => { if (claim()) resolve({ cancelled: false, value }); },
          error => { if (claim()) reject(error); },
        );
      });
    },
    destroy() {
      if (disposed) return [];
      disposed = true;
      for (const cancel of waiters) cancel();
      const errors: unknown[] = [];
      let owner: Cleanup | undefined;
      while ((owner = owners.pop())) errors.push(...clean(owner));
      return errors;
    },
    stats() { return Object.freeze({ disposed, ownerCount: owners.length, waiterCount: waiters.size }); },
  });
}

function clean(callback: Cleanup): unknown[] {
  try { callback(); return []; } catch (error) { return [error]; }
}
