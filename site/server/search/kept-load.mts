const STALLED = Symbol('stalled');

/**
 * A value a function instance loads once and keeps for every later request.
 *
 * The first caller starts the load and later callers wait on it. A host can stop the request that started a load before
 * it settles (a Cloudflare Worker over its CPU or memory limit), and such a load never settles: a caller that has waited
 * `patienceMs` starts the load again, so one stopped request cannot hold every later one. A load that fails is not kept.
 */
export function keptLoad<T>(load: () => Promise<T>, patienceMs = 10_000): () => Promise<T> {
  let ready: { readonly value: T } | undefined, pending: Promise<T> | undefined;
  const start = (): Promise<T> => {
    const mine: Promise<T> = load().then(value => { ready = { value }; return value; },
      (error: unknown) => { if (pending === mine) pending = undefined; throw error; });
    return pending = mine;
  };
  const read = async (): Promise<T> => {
    if (ready) return ready.value;
    const waited = pending;
    if (!waited) return start();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stalled = new Promise<typeof STALLED>(resolve => { timer = setTimeout(resolve, patienceMs, STALLED); });
    try {
      const result = await Promise.race([waited, stalled]);
      if (result !== STALLED) return result;
    } finally { clearTimeout(timer); }
    // Another waiter may have started the load again already; wait on that one.
    return pending === waited ? start() : read();
  };
  return read;
}
