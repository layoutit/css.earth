import { PREPARED_VOLUME_IMPOSTORS_SCHEMA, type DatasetBankBillboard, type DatasetBillboardView, type DatasetBillboards, type DensityVolumeFrame, type VolumeVector, type PreparedVolumeImpostors } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';

import { writeStyle } from '../rendering/retained-write.js';

import type { WorldCameraViewport } from '../navigation/world-camera.js';

import { projectVolumeImpostors } from '../volume/volume-impostor-projection.js';

/** One retained leaf per bank, drawing an image of the dataset that is selected: the bank's own image for its default
 * dataset, and one named by the bank and the dataset for each other dataset that has a view. An image is requested only
 * when its billboard first shows; the impostor projection places, sizes and orients it like the bank's own impostors. */
export function mountDatasetBillboards({ host, before, imageUrl, imagePx, entries, prepareImage }: {
  host: HTMLElement; before: Node | null; imagePx: DatasetBillboards['imagePx'];
  /** Where a bank's billboard image is served: its default dataset's, or the named dataset's. */
  imageUrl: (id: string, dataset?: string) => string;
  /** Shared universe lease: transport and decode finish before an image reaches CSS. */
  prepareImage: (url: string) => boolean;
  entries: readonly { readonly id: string; readonly frame: DensityVolumeFrame; readonly billboard?: DatasetBankBillboard['billboard'];
    readonly defaultDataset?: string; readonly datasets?: DatasetBankBillboard['datasets'] }[];
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
    const picture = (view: DatasetBillboardView, dataset?: string) => {
      const bank: PreparedVolumeImpostors = { schema: PREPARED_VOLUME_IMPOSTORS_SCHEMA, radiusUnits: view.radiusUnits,
        // A billboard never hands over to a volume here; the bank's own fetch gate decides that.
        fullBelowDiameterPixels: 0, volumeAboveDiameterPixels: 1,
        views: [{ id: entry.id, texturePath: '', back: view.back as unknown as VolumeVector,
          right: view.right as unknown as VolumeVector, down: view.down as unknown as VolumeVector }] };
      return { bank, url: imageUrl(entry.id, dataset) };
    };
    const standard = entry.billboard ? picture(entry.billboard) : null;
    const others = new Map([...entry.datasets ?? []].map(([dataset, view]) => [dataset, picture(view, dataset)] as const));
    /** The picture of `dataset`: the bank's own for its default dataset or when none is named, and none for a dataset
     * without a view, which no other dataset's picture may stand for. */
    const pictureOf = (dataset: string | undefined) => dataset === undefined || dataset === entry.defaultDataset ? standard : others.get(dataset) ?? null;
    return { node, frame: entry.frame, pictureOf, drawn: null as ReturnType<typeof picture> | null, shown: false, style: '' };
  };
  const leaves = entries.map(makeLeaf);
  // While the camera coasts a billboard is neither revealed nor hidden: a shown one fades, the rest wait for the coast
  // to stop (motion-freezes-membership.md).
  let coasting = false;
  const hide = (leaf: (typeof leaves)[number]) => {
    if (leaf.shown && coasting) { writeStyle(leaf.node, 'opacity', '0'); leaf.style = ''; }
    else if (leaf.shown) { leaf.node.style.display = 'none'; leaf.shown = false; }
  };
  return {
    root: layer,
    /** Add the billboard of a bank declared after mount (its host's entry brought it); returns its index. */
    add(entry: Entry) { return leaves.push(makeLeaf(entry)) - 1; },
    setCoasting(active: boolean) { coasting = active; },
    /** The radius of the view that pictures `dataset` for billboard `index`, or none when no view does. */
    radiusUnits(index: number, dataset?: string) { return leaves[index]!.pictureOf(dataset)?.bank.radiusUnits; },
    /** Show billboard `index` at `opacity` (0 hides it) for this camera, picturing `dataset` (the bank's default when none is named). */
    publish(index: number, opacity: number, world: WorldCameraPose, viewport: WorldCameraViewport, dataset?: string) {
      const leaf = leaves[index]!, picture = opacity > 0 ? leaf.pictureOf(dataset) : null;
      const projection = picture ? projectVolumeImpostors({ world, viewport }, leaf.frame, picture.bank, true) : null;
      const view = projection?.visible ? projection.views[0] : undefined;
      if (!picture || !projection || !view) { hide(leaf); return; }
      if (!leaf.shown && coasting) return;
      if (leaf.drawn !== picture) {
        // The leaf holds the picture of a dataset no longer selected (or none yet): it hides, and takes the selected
        // dataset's picture at rest, once that has decoded.
        hide(leaf);
        if (coasting || !prepareImage(picture.url)) return;
        leaf.node.style.backgroundImage = `url("${picture.url.replace(/["\\]/g, '\\$&')}")`;
        leaf.drawn = picture;
      }
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
