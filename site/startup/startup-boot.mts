import { importPackagedObjectRuntime, importSceneRegistry } from '../scene-imports.mts';
import { importApplicationWorld } from '../world-imports.mts';

/** Starts the body runtime and its decoding worker as soon as the page's first script runs, beside the world summary's
 * request instead of after it. Neither depends on the world. The readers own every failure: a read that fails here is
 * asked for again by the step that needs it. */
export function startBodyCode(document: Document) {
  if (!document.querySelector<HTMLElement>('.object-stage')?.dataset.objectId) return;
  void importPackagedObjectRuntime().then(runtime => runtime.prestartObjectDecoding()).catch(() => {});
}

/** Starts the registry with this page's entry and system view, and the world's code with its planner worker, volume and
 * stars, together instead of after the first body's preparation. Both read the world the page loaded before its
 * application (`startup-world.mts`), so this runs once the router has been imported. Each module is imported through
 * the scene/world loader owners, so the router's own later request takes the same promise. */
export function startViewCode(document: Document) {
  const objectId = document.querySelector<HTMLElement>('.object-stage')?.dataset.objectId;
  if (!objectId) return;
  const ignore = () => {};
  void importSceneRegistry()
    .then(registry => Promise.all([registry.loadObject(objectId), registry.loadSystemView(objectId)])).catch(ignore);
  void importApplicationWorld().then(world => {
    world.prestartWorldPlanner();
    return world.loadApplicationUniverse();
  }).catch(ignore);
}
