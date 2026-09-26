import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { array, finite, positive, record, text } from '../validation/guards.js';
import { projectVolumeImpostors } from '../volume/volume-impostor-projection.js';
import type { VolumeVector } from '../volume/types.js';

type Vector = readonly [number, number, number];
/** What the universe knows about a volume lens bank before fetching its lenses: prepared by
 * `pnpm prepare:lens-billboards` from the pinned payload whose sha256 it records. */
export interface LensBankBillboard {
  readonly id: string;
  readonly payloadSha256: string;
  readonly contextVisibility: 'galactic' | 'independent';
  /** A cloud that accompanies a body stays dark until that body's dataset asks for it. */
  readonly attached: boolean;
  /** The default lens's impostor view that faces the Sun, as one cell of the shared atlas. */
  readonly billboard?: { readonly cell: number; readonly radiusUnits: number; readonly back: Vector; readonly right: Vector; readonly down: Vector };
}
export interface LensBillboards {
  readonly atlas: { readonly columns: number; readonly rows: number; readonly cellPx: number; readonly sha256: string };
  readonly banks: ReadonlyMap<string, LensBankBillboard>;
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

export function parseLensBillboards(value: unknown): LensBillboards {
  const input = record(value, 'lens billboards', ['schema', 'atlas', 'banks']);
  if (input.schema !== 'cssearth-lens-billboards@1') throw new TypeError('Unsupported lens billboards.');
  const atlasInput = record(input.atlas, 'lens billboard atlas', ['columns', 'rows', 'cellPx', 'sha256']);
  const atlas = Object.freeze({ columns: count(atlasInput.columns, 'atlas columns'), rows: count(atlasInput.rows, 'atlas rows'),
    cellPx: positive(atlasInput.cellPx, 'atlas cell size'), sha256: text(atlasInput.sha256, 'atlas sha256') });
  if (!/^[a-f0-9]{64}$/.test(atlas.sha256) || atlas.columns < 1 || atlas.rows < 1) throw new TypeError('Lens billboard atlas is invalid.');
  const banks = new Map<string, LensBankBillboard>();
  for (const value of array(input.banks, 'lens billboard banks')) {
    const bank = record(value, 'lens billboard bank', ['id', 'payloadSha256', 'contextVisibility', 'attached', 'billboard']);
    const id = text(bank.id, 'lens billboard bank id'), payloadSha256 = text(bank.payloadSha256, 'lens billboard payload sha256');
    if (banks.has(id) || !/^[a-f0-9]{64}$/.test(payloadSha256)) throw new TypeError('Lens billboard banks must be unique and pinned.');
    if (bank.contextVisibility !== 'galactic' && bank.contextVisibility !== 'independent') throw new TypeError('Unsupported lens context visibility.');
    if (typeof bank.attached !== 'boolean') throw new TypeError('Lens billboard bank must state whether it is attached.');
    let billboard: LensBankBillboard['billboard'];
    if (bank.billboard !== undefined) {
      const input = record(bank.billboard, 'lens billboard', ['cell', 'radiusUnits', 'back', 'right', 'down']);
      const cell = count(input.cell, 'lens billboard cell');
      if (cell >= atlas.columns * atlas.rows) throw new TypeError('Lens billboard cell is outside its atlas.');
      billboard = Object.freeze({ cell, radiusUnits: positive(input.radiusUnits, 'lens billboard radius'),
        back: vector(input.back, 'lens billboard back'), right: vector(input.right, 'lens billboard right'), down: vector(input.down, 'lens billboard down') });
    }
    banks.set(id, Object.freeze({ id, payloadSha256, contextVisibility: bank.contextVisibility, attached: bank.attached, ...(billboard ? { billboard } : {}) }));
  }
  return Object.freeze({ atlas, banks });
}

/** One retained leaf per billboard, sampling its cell of the shared atlas. The atlas is requested only when a
 * billboard first shows; the impostor projection places, sizes and orients it like the bank's own impostors. */
export function mountLensBillboards({ host, before, atlasUrl, atlas, entries }: {
  host: HTMLElement; before: Node | null; atlasUrl: string; atlas: LensBillboards['atlas'];
  entries: readonly { readonly id: string; readonly frame: DensityVolumeFrame; readonly billboard: NonNullable<LensBankBillboard['billboard']> }[];
}) {
  const document = host.ownerDocument;
  const layer = document.createElement('div');
  layer.className = 'prepared-lens-billboards';
  // Zero-size root at the stage centre, children placed from it: a full-screen box above the globe became a full-screen layer.
  layer.style.cssText = 'position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none';
  host.insertBefore(layer, before);
  // A fixed box, sized once, scaled by its transform: camera motion changes only transform and opacity
  // (docs/performance/motion-freezes-membership.md). Two atlas texels per CSS pixel, the texture rule of
  // packages/bake/src/scene/projective-surface-raster.ts: the cell holds no more detail than that, and the layer's backing stays
  // this size however large the billboard shows.
  const box = atlas.cellPx / 2;
  const leaves = entries.map(entry => {
    const node = document.createElement('s');
    node.dataset.lensBillboard = entry.id;
    const column = entry.billboard.cell % atlas.columns, row = Math.floor(entry.billboard.cell / atlas.columns);
    const percent = (index: number, cells: number) => cells > 1 ? `${index / (cells - 1) * 100}%` : '0%';
    node.style.cssText = `position:absolute;left:0;top:0;width:${box}px;height:${box}px;display:none;pointer-events:none;transform-origin:0 0;background-repeat:no-repeat;` +
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
        if (leaf.shown && coasting) { if (leaf.node.style.opacity !== '0') leaf.node.style.opacity = '0'; leaf.style = ''; }
        else if (leaf.shown) { leaf.node.style.display = 'none'; leaf.shown = false; }
        return;
      }
      if (!leaf.shown && coasting) return;
      if (!leaf.node.style.backgroundImage) leaf.node.style.backgroundImage = `url("${atlasUrl.replace(/["\\]/g, '\\$&')}")`;
      const d = projection.diameterPixels;
      const style = `${d}|${projection.x}|${projection.y}|${view.matrix.join(',')}|${opacity}`;
      if (style !== leaf.style) {
        leaf.style = style;
        // The view matrix orients the billboard about its centre: scale the box to `d` first, then move its centre there.
        leaf.node.style.transform = `translate(${projection.x}px,${projection.y}px) matrix(${view.matrix.join(',')},0,0) ` +
          `scale(${d / box}) translate(${-box / 2}px,${-box / 2}px)`;
        leaf.node.style.opacity = String(opacity);
      }
      if (!leaf.shown) { leaf.node.style.display = 'block'; leaf.shown = true; }
    },
    destroy() { layer.remove(); },
  };
}
