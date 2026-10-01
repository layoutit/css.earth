/** One `import()` per lazily loaded module, shared by every caller.
 *
 * The registry and the world's code wait on prepared data with a top-level await. In Safari a second `import()` of a module
 * that is still inside that wait resolves at once, with the module half evaluated: its function declarations exist and its
 * constants do not. The page then failed with `WORLD_OBJECTS`, the navigation map or a helper undefined: 8 of 8 cold iPad
 * loads with the world summary held back 1.2 s, and one in seven on the live site (2026-10-01). Callers that want the same
 * module take the same promise, so no module is imported twice. A failed load is asked for again by the next caller. */
function once<Module>(load: () => Promise<Module>): () => Promise<Module> {
  let pending: Promise<Module> | null = null;
  return () => pending ??= load().catch(error => { pending = null; throw error; });
}

export const importSceneRegistry = once(() => import('./scene/scene-registry.mts'));
export const importApplicationWorld = once(() => import('./application-world-context.mts'));
export const importPackagedObjectRuntime = once(() => import('./packaged-object-runtime.mts'));
