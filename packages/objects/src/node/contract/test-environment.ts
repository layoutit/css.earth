/** What node:test does not provide for tests that stand in for browser globals or wait on queued work. */
const restores: (() => void)[] = [];

/** Replace a global for the current test; `unstubAllGlobals` puts every replaced global back. */
export function stubGlobal(name: string, value: unknown): void {
  const had = Object.hasOwn(globalThis, name), previous = Reflect.get(globalThis, name);
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  restores.push(had ? () => Object.defineProperty(globalThis, name, { value: previous, configurable: true, writable: true }) : () => { Reflect.deleteProperty(globalThis, name); });
}

export function unstubAllGlobals(): void {
  while (restores.length) restores.pop()!();
}

/** Retry `check` until it stops throwing, or rethrow its last error after `timeout` milliseconds. */
export async function waitFor<T>(check: () => T | Promise<T>, { timeout = 1000, interval = 10 } = {}): Promise<T> {
  const end = Date.now() + timeout;
  for (;;) {
    try { return await check(); } catch (error) {
      if (Date.now() >= end) throw error;
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
}
