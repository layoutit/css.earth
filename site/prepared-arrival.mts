import type { SceneFactory, MountOptions } from './browser/browser-types.mts';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
import type { ObjectPreparationView } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
import type { WorldHandoff } from './navigation/navigation-types.mts';
import type { prepareArrivalBillboard } from './arrival-billboard.mts';
import { createPreparedSceneOwnership } from './prepared-scene-ownership.mts';

type Navigation = NonNullable<SceneFactory['navigation']>;
type Preparation = Parameters<Navigation['prepare']>[0];
type Cover = Awaited<ReturnType<typeof prepareArrivalBillboard>>;

/** Startup is an arrival already at its destination. Travel supplies camera
 * samples, but never owns a second resource, activation or reveal policy. */
export function createPreparedArrival(signal: AbortSignal, cover: Cover | null = null,
  onReveal: () => void = () => {}, inputSurface?: HTMLElement | null) {
  const ownership = createPreparedSceneOwnership(signal);
  let lease: Awaited<ReturnType<Navigation['prepare']>> | null = null;
  let preparing = false, coverRemoved = false;
  const previousInert = inputSurface?.inert ?? false;
  if (inputSurface) inputSurface.inert = true;
  function removeCover() {
    if (coverRemoved) return;
    coverRemoved = true;
    cover?.destroy();
    if (inputSurface) inputSurface.inert = previousInert;
  }
  ownership.signal.addEventListener('abort', removeCover, { once: true });
  if (ownership.signal.aborted) removeCover();
  return {
    signal: ownership.signal,
    dispose: ownership.dispose,
    async prepare(factory: SceneFactory | Promise<SceneFactory>, options: Omit<Preparation, 'signal'>) {
      if (preparing) throw new Error('An arrival prepares its scene once.');
      preparing = true;
      try {
        const navigation = (await factory).navigation;
        if (!navigation) throw new TypeError('Destination has no prepared navigation.');
        lease = await navigation.prepare({ ...options, signal: ownership.signal });
        ownership.own(lease);
        ownership.signal.throwIfAborted();
        return lease;
      } catch (error) { ownership.dispose(); throw error; }
    },
    handoff(getView: () => ObjectPreparationView, options: Partial<MountOptions> = {}, hooks: {
      beforePublish?(mount: ObjectSceneLifecycle): void;
      afterPublish?(mount: ObjectSceneLifecycle): Promise<void>;
    } = {},
    /** A stationary startup behind its photograph activates every texture together: nothing is seen until the reveal.
     * A flight, and a startup whose mesh is in view while it fills, pace activation an atlas a frame. */
    activation: 'paced' | 'whole' = 'paced'): WorldHandoff {
      if (!lease) throw new Error('Arrival resources must be ready before mounting.');
      ownership.signal.throwIfAborted();
      cover?.mounting();
      const view = getView();
      return {
        transferTo: ownership.transferTo,
        mountOptions: {
          arriving: true,
          preparedResources: lease.resources, preparedTree: lease.tree,
          initialWorldCamera: view.world, initialProjection: lease.projection(view),
          ...options,
          progressiveActivation: activation === 'paced',
        },
        async afterMount(mount) {
          let failure: unknown;
          try {
            ownership.signal.throwIfAborted();
            const owner = mount.navigation;
            if (!owner) throw new Error('The destination camera is unavailable.');
            hooks.beforePublish?.(mount);
            const publication = owner.apply(getView().world, { signal: ownership.signal });
            // A publication that settles false either lost its ownership (the arrival is cancelled) or was replaced by a newer
            // view: the reader's drag or zoom (world-frame-queue.ts). That view owns the camera now, and the arrival reveals under it.
            if (publication && !(await publication)) ownership.signal.throwIfAborted();
            cover?.publish(owner.capture(), owner.optics());
            // Preserve the proven fly-to boundary in both modes: activation has
            // completed, the destination camera is acknowledged, then reveal.
            // Startup is stationary; flight resumes its existing clock afterward.
            removeCover();
            onReveal();
            await hooks.afterPublish?.(mount);
            ownership.signal.throwIfAborted();
          } catch (error) { failure = error; removeCover(); throw error; }
          finally {
            const reason = failure ?? ownership.signal.reason;
            mount.features?.setNavigationInFlight?.(false, !failure && !ownership.signal.aborted ||
              (reason instanceof Error && 'preserveView' in reason && reason.preserveView === true));
          }
        },
      };
    },
  };
}
