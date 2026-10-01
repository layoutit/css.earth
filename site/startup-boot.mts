import { prestartPreparedObjectDecoding, prestartWorldContextPlanner } from '@cssearth/renderer';

/** Runs as soon as the page's modules load (`ObjectLayout.astro`), while the router still waits for the world summary
 * (`world-context-plan.mts`). It starts what the cold page's first view will need, each at once instead of after the step
 * before it: the body runtime and both workers' scripts, the registry with this page's entry and system view, and the world's code with its
 * volume and stars. The readers own every failure: a read that fails here is asked for again by the step that needs it. */
export function startFirstView(document: Document) {
  const objectId = document.querySelector<HTMLElement>('.object-stage')?.dataset.objectId;
  if (!objectId) return;
  prestartPreparedObjectDecoding();
  prestartWorldContextPlanner();
  const ignore = () => {};
  void import('./packaged-object-runtime.mts').catch(ignore);
  void import('./scene/scene-registry.mts')
    .then(registry => Promise.all([registry.loadObject(objectId), registry.loadSystemView(objectId)])).catch(ignore);
  void import('./application-world-context.mts').then(world => world.loadApplicationUniverse()).catch(ignore);
}
