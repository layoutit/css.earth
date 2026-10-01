import { importApplicationWorld, importPackagedObjectRuntime, importSceneRegistry } from './shared-imports.mts';

/** Starts what a cold page's first view needs at once instead of after the step before it: the body runtime with its
 * decoding worker, the registry with this page's entry and system view, and the world's code with its planner worker,
 * volume and stars. The readers own every failure: a read that fails here is asked for again by the step that needs it.
 *
 * Each module is imported through `shared-imports.mts`, so the router's own later request takes the same promise.
 *
 * It runs only once the router's module graph has evaluated (`ObjectLayout.astro`). That graph waits for the world
 * summary with a top-level await, and any other module import made while that wait was pending let Safari run the router
 * before its dependencies had finished: `WORLD_OBJECTS` or the navigation map was undefined and the page failed. With the
 * summary held back 1.2 s, 8 of 8 cold iPad loads failed with three such imports, 3 of 8 with two, 1 of 8 with one
 * (2026-10-01). The page's data requests still start from the head (`startup-requests.mts`); they are fetches, not imports. */
export function startViewCode(document: Document) {
  const objectId = document.querySelector<HTMLElement>('.object-stage')?.dataset.objectId;
  if (!objectId) return;
  const ignore = () => {};
  void importPackagedObjectRuntime().then(runtime => runtime.prestartObjectDecoding()).catch(ignore);
  void importSceneRegistry()
    .then(registry => Promise.all([registry.loadObject(objectId), registry.loadSystemView(objectId)])).catch(ignore);
  void importApplicationWorld().then(world => {
    world.prestartWorldPlanner();
    return world.loadApplicationUniverse();
  }).catch(ignore);
}
