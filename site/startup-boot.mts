/** Runs from the page's first script (`ObjectLayout.astro`), as soon as it loads and before the router's module graph
 * (which waits for the world summary, `world-context-plan.mts`). It starts what a cold page's first view needs, each at once
 * instead of after the step before it: the body runtime with its decoding worker, the registry with this page's entry and
 * system view, and the world's code with its planner worker, volume and stars. Everything here is dynamic, so this script
 * runs before any of those modules arrives. The readers own every failure: a read that fails here is asked for again by the
 * step that needs it. */
export function startFirstView(document: Document) {
  const objectId = document.querySelector<HTMLElement>('.object-stage')?.dataset.objectId;
  if (!objectId) return;
  const ignore = () => {};
  void import('./packaged-object-runtime.mts').then(runtime => runtime.prestartObjectDecoding()).catch(ignore);
  // A chunk the registry and the world both import: requested beside them rather than after either.
  void import('./page-datasets.mts').catch(ignore);
  void import('./scene/scene-registry.mts')
    .then(registry => Promise.all([registry.loadObject(objectId), registry.loadSystemView(objectId)])).catch(ignore);
  void import('./application-world-context.mts').then(world => {
    world.prestartWorldPlanner();
    return world.loadApplicationUniverse();
  }).catch(ignore);
}
