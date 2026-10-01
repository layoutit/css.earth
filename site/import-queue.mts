/** The application's lazily loaded modules load one `import()` at a time.
 *
 * Their graphs overlap (the registry, the world's code and the router share the world plan and the object directory), and
 * Safari on the iPad does not keep two overlapping dynamic imports apart: with both in flight, one ran its module body
 * before a shared dependency's (`WORLD_OBJECTS` undefined in the world's code), its evaluation threw, and the next import
 * of it returned the half-evaluated module. A cold page then failed to start: one load in seven on the live site, and
 * 8 to 15 of 16 with the world summary held back 1.2 s, depending on how many imports overlapped (2026-10-01).
 *
 * Every import below waits for the one before it to settle, whoever asks and in whatever order. Each module is imported
 * once and its promise shared; a failed load is asked for again by the next caller. Headless WebKit and Chrome do not
 * show the fault: only the device does (`labs/performance`, a delayed summary). */
let last: Promise<unknown> = Promise.resolve();
/** `load` as a module loader that waits for every earlier one, runs once, and is asked for again after a failure. */
export function queuedImport<Module>(load: () => Promise<Module>): () => Promise<Module> {
  let pending: Promise<Module> | null = null;
  return () => {
    if (pending) return pending;
    const loading = last.then(load);
    last = loading.catch(() => {});
    pending = loading.catch(error => { pending = null; throw error; });
    return pending;
  };
}

/** The body runtime, shared by the startup prestart and the object directory. */
export const importPackagedObjectRuntime = queuedImport(() => import('./packaged-object-runtime.mts'));
