import { writeStyle } from '../rendering/dom/retained-write.js';
import { revealLayer } from '../rendering/dom/layer-reveal.js';
import type { SceneLifetime, WorldCameraPose } from '@cssearth/engine';
import { type DensityVolumeFrame, type PreparedGalaxyBacking } from '@cssearth/objects';
import type { WorldCameraViewport } from '../navigation/camera/world-camera.js';
import { projectVolumeSphere, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';

import { mountGalaxyBacking } from './galaxy-backing.js';
import type { PreparedUniverseOptions } from './prepared-universe-types.js';

/** A bank's backing plane (DatasetBankBillboard.backing): its far picture, fixed in its frame as the Milky Way's is. */
export interface FarBackingPlane {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  /** The plane's reach for visibility: the framing radius of the declared bounds. */
  readonly radiusUnits: number;
  loaded: { payload: PreparedGalaxyBacking; resolveResource(path: string): string } | null;
  loading: boolean;
  plane: ReturnType<typeof mountGalaxyBacking> | null;
  /** The image the plane draws, and whether it is on screen. */
  texture: string | null;
  shown: boolean;
}

/** The backing planes of one layer of banks (volume dataset banks, or image-layer banks): each bank whose prepared
 * billboard facts say `backing` is drawn from afar on that one image, fixed in its frame, in place of a camera-facing
 * billboard. The planes' host, as the Milky Way's (universe-background.ts), is made with the first plane, `before` the
 * place where that layer's billboards go, so the planes paint as the billboards they replace did. */
export function createFarBackingPlanes({ root, before, lifetime, load, requestPublication }: {
  root: HTMLElement; before: Element; lifetime: SceneLifetime;
  load?: PreparedUniverseOptions['loadBacking'];
  requestPublication?: () => boolean;
}) {
  let host: HTMLElement | null = null;
  const planes: FarBackingPlane[] = [];
  lifetime.onDispose(() => { for (const far of planes) { far.plane?.destroy(); far.plane = null; } host?.remove(); });
  return {
    /** The plane of a bank declared with a backing. */
    add(id: string, frame: DensityVolumeFrame): FarBackingPlane {
      if (!host) {
        host = root.ownerDocument.createElement('div');
        host.className = 'prepared-galaxy-backing';
        host.style.cssText = 'position:absolute;inset:0;pointer-events:none';
        root.insertBefore(host, before);
      }
      const far: FarBackingPlane = { id, frame, radiusUnits: volumeFramingRadiusUnits(frame), loaded: null, loading: false, plane: null, texture: null, shown: false };
      planes.push(far);
      return far;
    },
    /** Show a bank's backing plane at `opacity` (0 hides it), picturing `selection`, its selected dataset (none: the
     * leaf's own image). It mounts, shows and changes image only at rest; while the camera coasts a shown plane moves and
     * fades (motion-freezes-membership.md). */
    publish(far: FarBackingPlane, opacity: number, world: WorldCameraPose, viewport: WorldCameraViewport, coasting: boolean, selection?: string) {
      if (lifetime.disposed) return;
      const hide = () => {
        if (far.shown && coasting) writeStyle(far.plane!.root, 'opacity', '0');
        else if (far.shown) { far.plane!.root.style.display = 'none'; far.shown = false; }
      };
      if (!(opacity > 0) || !projectVolumeSphere(world, viewport, far.frame, far.radiusUnits).visible) { hide(); return; }
      if (!far.loaded) {
        if (far.loading || !load) return;
        far.loading = true;
        void load(far.id).then(loaded => {
          if (lifetime.disposed) return;
          // Every image the plane may draw must resolve before it mounts: a failure leaves no plane behind.
          const { payload, resolveResource } = loaded;
          for (const path of [payload.leaf.texturePath, ...payload.datasets?.values() ?? []]) resolveResource(path);
          far.loaded = loaded;
          requestPublication?.();
        // A backing that cannot be read is not asked for again: the bank itself still draws once large, as the Milky
        // Way's still draws without its backing.
        }, (error: unknown) => { console.error(`Bank ${far.id}: its backing could not be loaded.`, error); });
        return;
      }
      const { payload } = far.loaded;
      // The plane pictures the selected dataset; a dataset with no image of its own draws none.
      const texture = selection === undefined || !payload.datasets ? payload.leaf.texturePath : payload.datasets.get(selection) ?? null;
      if (texture === null) { hide(); return; }
      if (!far.plane) {
        if (coasting) return;
        far.plane = mountGalaxyBacking({ host: host!, before: null, payload, resolveResource: far.loaded.resolveResource });
        far.plane.root.style.display = 'none';
        far.plane.root.dataset.galaxyBacking = far.id;
        far.texture = payload.leaf.texturePath;
      }
      if (!far.shown && coasting) return;
      if (far.texture !== texture) {
        // Another dataset's image: the plane hides, and takes it at rest once it has decoded (layer-reveal.ts).
        hide();
        if (coasting) return;
        far.texture = texture;
        far.plane.setTexture(texture);
      }
      const { root: layer } = far.plane;
      // The camera first, then the plane shows: it never paints before it is placed.
      far.plane.publish({ world, viewport });
      writeStyle(layer, 'opacity', String(opacity));
      if (!far.shown) {
        // A plane switching on waits for its decoded image and its own frame.
        revealLayer(layer, far.plane.setTexture(texture));
        layer.style.display = ''; far.shown = true;
      }
    },
  };
}
