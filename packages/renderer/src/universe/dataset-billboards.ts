import { PREPARED_VOLUME_IMPOSTORS_SCHEMA, type DatasetBankBillboard, type DatasetBillboards, type DensityVolumeFrame, type VolumeVector, type PreparedVolumeImpostors } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';

import { writeStyle } from '../rendering/retained-write.js';

import type { WorldCameraViewport } from '../navigation/world-camera.js';

import { projectVolumeImpostors } from '../volume/volume-impostor-projection.js';

/** One retained leaf per billboard, drawing the bank's own image. The image is requested only when its billboard first
 * shows; the impostor projection places, sizes and orients it like the bank's own impostors. */
export function mountDatasetBillboards({ host, before, imageUrl, imagePx, entries, prepareImage }: {
  host: HTMLElement; before: Node | null; imagePx: DatasetBillboards['imagePx'];
  /** Where a bank's billboard image is served. */
  imageUrl: (id: string) => string;
  /** Shared universe lease: transport and decode finish before an image reaches CSS. */
  prepareImage: (url: string) => boolean;
  entries: readonly { readonly id: string; readonly frame: DensityVolumeFrame; readonly billboard: NonNullable<DatasetBankBillboard['billboard']> }[];
}) {
  const document = host.ownerDocument;
  const layer = document.createElement('div');
  layer.className = 'prepared-dataset-billboards';
  // Zero-size root at the stage centre, children placed from it (volume.css): a full-screen box above the globe became a
  // full-screen layer.
  host.insertBefore(layer, before);
  // A fixed box, sized once, scaled by its transform: camera motion changes only transform and opacity
  // (docs/performance/motion-freezes-membership.md). Two image texels per CSS pixel, the texture rule of
  // packages/bake/src/scene/projective-surface-raster.ts: the image holds no more detail than that, and the layer's backing
  // stays this size however large the billboard shows.
  const box = imagePx / 2;
  type Entry = (typeof entries)[number];
  const makeLeaf = (entry: Entry) => {
    const node = document.createElement('s');
    node.dataset.datasetBillboard = entry.id;
    // The leaf's fixed placement and the image's fit are volume.css rules; its box is inline.
    node.style.cssText = `width:${box}px;height:${box}px;display:none`;
    layer.append(node);
    const bank: PreparedVolumeImpostors = { schema: PREPARED_VOLUME_IMPOSTORS_SCHEMA, radiusUnits: entry.billboard.radiusUnits,
      // A billboard never hands over to a volume here; the bank's own fetch gate decides that.
      fullBelowDiameterPixels: 0, volumeAboveDiameterPixels: 1,
      views: [{ id: entry.id, texturePath: '', back: entry.billboard.back as unknown as VolumeVector,
        right: entry.billboard.right as unknown as VolumeVector, down: entry.billboard.down as unknown as VolumeVector }] };
    return { node, frame: entry.frame, bank, url: imageUrl(entry.id), shown: false, style: '' };
  };
  const leaves = entries.map(makeLeaf);
  // While the camera coasts a billboard is neither revealed nor hidden: a shown one fades, the rest wait for the coast
  // to stop (motion-freezes-membership.md).
  let coasting = false;
  return {
    root: layer,
    /** Add the billboard of a bank declared after mount (its host's entry brought it); returns its index. */
    add(entry: Entry) { return leaves.push(makeLeaf(entry)) - 1; },
    setCoasting(active: boolean) { coasting = active; },
    /** Show billboard `index` at `opacity` (0 hides it) for this camera. */
    publish(index: number, opacity: number, world: WorldCameraPose, viewport: WorldCameraViewport) {
      const leaf = leaves[index]!;
      const projection = opacity > 0 ? projectVolumeImpostors({ world, viewport }, leaf.frame, leaf.bank, true) : null;
      const view = projection?.visible ? projection.views[0] : undefined;
      if (!projection || !view) {
        if (leaf.shown && coasting) { writeStyle(leaf.node, 'opacity', '0'); leaf.style = ''; }
        else if (leaf.shown) { leaf.node.style.display = 'none'; leaf.shown = false; }
        return;
      }
      if (!leaf.shown && coasting) return;
      if (!prepareImage(leaf.url)) return;
      if (!leaf.node.style.backgroundImage) leaf.node.style.backgroundImage = `url("${leaf.url.replace(/["\\]/g, '\\$&')}")`;
      const d = projection.diameterPixels;
      const style = `${d}|${projection.x}|${projection.y}|${view.matrix.join(',')}|${opacity}`;
      if (style !== leaf.style) {
        leaf.style = style;
        // The view matrix orients the billboard about its centre: scale the box to `d` first, then move its centre there.
        leaf.node.style.transform = `translate(${projection.x}px,${projection.y}px) matrix(${view.matrix.join(',')},0,0) ` +
          `scale(${d / box}) translate(${-box / 2}px,${-box / 2}px)`;
        writeStyle(leaf.node, 'opacity', String(opacity));
      }
      if (!leaf.shown) { leaf.node.style.display = 'block'; leaf.shown = true; }
    },
    destroy() { layer.remove(); },
  };
}
