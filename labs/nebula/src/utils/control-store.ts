/** Small external controller store consumed by React controls through useSyncExternalStore. */
export function createControlStore<T>(initial: T) {
  let current = initial;
  const listeners = new Set<() => void>();
  return {
    snapshot: () => current,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    set(next: T) { current = next; for (const listener of listeners) listener(); },
  };
}
