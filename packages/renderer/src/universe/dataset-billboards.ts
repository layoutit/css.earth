import { type DensityVolumeFrame, array, finite, positive, record, text } from '@cssearth/objects';

import { writeStyle } from '../rendering/retained-write.js';

import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';

import { projectVolumeImpostors } from '../volume/volume-impostor-projection.js';
import type { VolumeVector } from '../volume/types.js';

type Vector = readonly [number, number, number];
/** What the universe knows about a volume dataset bank before fetching its datasets: prepared by
 * `pnpm prepare:dataset-billboards` from the bank's prepared payload. */
export interface DatasetBankBillboard {
  readonly id: string;
  readonly contextVisibility: 'galactic' | 'independent';
  /** A cloud that accompanies a body stays dark until that body's dataset asks for it. */
  readonly attached: boolean;
  /** A volume bank's authored framing radius, in its frame's units: its caption hangs under this sphere. */
  readonly framingRadiusUnits?: number;
  /** The default dataset's impostor view that faces the Sun, as one cell of the shared atlas. */
  readonly billboard?: { readonly cell: number; readonly radiusUnits: number; readonly back: Vector; readonly right: Vector; readonly down: Vector };
}
export interface DatasetBillboards {
  readonly atlas: { readonly columns: number; readonly rows: number; readonly cellPx: number };
  readonly banks: ReadonlyMap<string, DatasetBankBillboard>;
}

const vector = (value: unknown, label: string): Vector => {
  const values = array(value, label);
  if (values.length !== 3) throw new TypeError(`${label} must have three components.`);
  return Object.freeze(values.map(item => finite(item, label))) as unknown as Vector;
};
const count = (value: unknown, label: string) => {
  const number = finite(value, label);
  if (!Number.isSafeInteger(number) || number < 0) throw new TypeError(`${label} must be a non-negative integer.`);
  return number;
};

export function parseDatasetBillboards(value: unknown): DatasetBillboards {
  const input = record(value, 'dataset billboards', ['schema', 'atlas', 'banks']);
  if (input.schema !== 'cssearth-dataset-billboards@1') throw new TypeError('Unsupported dataset billboards.');
  const atlasInput = record(input.atlas, 'dataset billboard atlas', ['columns', 'rows', 'cellPx']);
  const atlas = Object.freeze({ columns: count(atlasInput.columns, 'atlas columns'), rows: count(atlasInput.rows, 'atlas rows'),
    cellPx: positive(atlasInput.cellPx, 'atlas cell size') });
  if (atlas.columns < 1 || atlas.rows < 1) throw new TypeError(`Dataset billboard atlas needs at least one column and row, not ${atlas.columns} x ${atlas.rows}.`);
  const banks = new Map<string, DatasetBankBillboard>();
  for (const value of array(input.banks, 'dataset billboard banks')) {
    const bank = record(value, 'dataset billboard bank', ['id', 'contextVisibility', 'attached', 'framingRadiusUnits', 'billboard']);
    const id = text(bank.id, 'dataset billboard bank id');
    if (banks.has(id)) throw new TypeError(`Dataset billboard bank ${id} is listed twice.`);
    if (bank.contextVisibility !== 'galactic' && bank.contextVisibility !== 'independent') throw new TypeError('Unsupported dataset context visibility.');
    if (typeof bank.attached !== 'boolean') throw new TypeError('Dataset billboard bank must state whether it is attached.');
    let billboard: DatasetBankBillboard['billboard'];
    if (bank.billboard !== undefined) {
      const input = record(bank.billboard, 'dataset billboard', ['cell', 'radiusUnits', 'back', 'right', 'down']);
      const cell = count(input.cell, 'dataset billboard cell');
      if (cell >= atlas.columns * atlas.rows) throw new TypeError('Dataset billboard cell is outside its atlas.');
      billboard = Object.freeze({ cell, radiusUnits: positive(input.radiusUnits, 'dataset billboard radius'),
        back: vector(input.back, 'dataset billboard back'), right: vector(input.right, 'dataset billboard right'), down: vector(input.down, 'dataset billboard down') });
    }
    const framingRadiusUnits = bank.framingRadiusUnits === undefined ? undefined : positive(bank.framingRadiusUnits, 'dataset billboard framing radius');
    banks.set(id, Object.freeze({ id, contextVisibility: bank.contextVisibility, attached: bank.attached,
      ...(framingRadiusUnits === undefined ? {} : { framingRadiusUnits }), ...(billboard ? { billboard } : {}) }));
  }
  return Object.freeze({ atlas, banks });
}

/** One retained leaf per billboard, sampling its cell of the shared atlas. The atlas is requested only when a
 * billboard first shows; the impostor projection places, sizes and orients it like the bank's own impostors. */
export function mountDatasetBillboards({ host, before, atlasUrl, atlas, entries, prepareAtlas }: {
  host: HTMLElement; before: Node | null; atlasUrl: string; atlas: DatasetBillboards['atlas'];
  /** Shared universe lease: transport and decode finish before the atlas reaches CSS. */
  prepareAtlas: () => boolean;
  entries: readonly { readonly id: string; readonly frame: DensityVolumeFrame; readonly billboard: NonNullable<DatasetBankBillboard['billboard']> }[];
}) {
  const document = host.ownerDocument;
  const layer = document.createElement('div');
  layer.className = 'prepared-dataset-billboards';
  // Zero-size root at the stage centre, children placed from it (volume.css): a full-screen box above the globe became a
  // full-screen layer.
  host.insertBefore(layer, before);
  // A fixed box, sized once, scaled by its transform: camera motion changes only transform and opacity
  // (docs/performance/motion-freezes-membership.md). Two atlas texels per CSS pixel, the texture rule of
  // packages/bake/src/scene/projective-surface-raster.ts: the cell holds no more detail than that, and the layer's backing stays
  // this size however large the billboard shows.
  const box = atlas.cellPx / 2;
  const leaves = entries.map(entry => {
    const node = document.createElement('s');
    node.dataset.datasetBillboard = entry.id;
    const column = entry.billboard.cell % atlas.columns, row = Math.floor(entry.billboard.cell / atlas.columns);
    const percent = (index: number, cells: number) => cells > 1 ? `${index / (cells - 1) * 100}%` : '0%';
    // The leaf's fixed placement is a volume.css rule; its atlas cell and the atlas-sized box are inline.
    node.style.cssText = `width:${box}px;height:${box}px;display:none;` +
      `background-size:${atlas.columns * 100}% ${atlas.rows * 100}%;background-position:${percent(column, atlas.columns)} ${percent(row, atlas.rows)}`;
    layer.append(node);
    const bank = { schema: 'cssearth-volume-impostors@1' as const, radiusUnits: entry.billboard.radiusUnits,
      // A billboard never hands over to a volume here; the bank's own fetch gate decides that.
      fullBelowDiameterPixels: 0, volumeAboveDiameterPixels: 1,
      views: [{ id: entry.id, texturePath: '', back: entry.billboard.back as unknown as VolumeVector,
        right: entry.billboard.right as unknown as VolumeVector, down: entry.billboard.down as unknown as VolumeVector }] };
    return { node, frame: entry.frame, bank, shown: false, style: '' };
  });
  // While the camera coasts a billboard is neither revealed nor hidden: a shown one fades, the rest wait for the coast
  // to stop (motion-freezes-membership.md).
  let coasting = false;
  return {
    root: layer,
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
      if (!prepareAtlas()) return;
      if (!leaf.node.style.backgroundImage) leaf.node.style.backgroundImage = `url("${atlasUrl.replace(/["\\]/g, '\\$&')}")`;
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
