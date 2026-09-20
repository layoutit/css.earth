/** Deduplicate concurrent work without retaining settled values or failures. */
export function createInFlightLoader<Key, Value>(load: (key: Key) => Promise<Value>): (key: Key) => Promise<Value> {
  const pending = new Map<Key, Promise<Value>>();
  return key => {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = Promise.resolve().then(() => load(key));
    pending.set(key, request);
    const release = () => { if (pending.get(key) === request) pending.delete(key); };
    void request.then(release, release);
    return request;
  };
}
