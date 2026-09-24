export function createConcurrencyLimit(concurrency: number) {
  let active = 0; const queue: (() => void)[] = [];
  return async <T>(run: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) await new Promise<void>(done => queue.push(done)); else active++;
    try { return await run(); } finally { const next = queue.shift(); if (next) next(); else active--; }
  };
}
