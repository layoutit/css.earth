/**
 * Leaf boxes written from their prepared records (packages/bake/src/presentation/leaf-box-records.ts).
 *
 * The bake ships each leaf's full box, background, matrix, seam coefficients and density, with the steps' initial values
 * on their bindings. A step or seam outset change writes the leaf's final `width`, `height`, `background-size`,
 * `background-position` and `transform` directly: no custom property, `calc()` or parse, and each leaf keeps what it
 * last wrote so an unchanged value is never written again.
 *
 * A leaf whose image states its size takes the box that image fills at one texel per device pixel (`leafBoxExact`) and
 * draws the image at its own size. WebKit draws part of an image in one of two ways (GraphicsContextCG.cpp,
 * `shouldUseSubimage`): the whole image under a clip when the scale is the same on both axes and not above one, a
 * cropped copy with interpolation otherwise; and under the clip only a draw at the image's own size is a copy, a smaller
 * one resamples. A dataset switch repaints every face in one frame: on an iPad Io's 448 faces took 185 to 245 ms in the
 * boxes their steps asked for and 45 to 54 ms all in exact ones (2026-10-04, docs/surface-preparation.md).
 *
 * Every length is written in pixels, never as a share of the box: WebKit resolves a share against the box snapped to
 * device pixels, so in a box half a device pixel wide the image misses its own size by a pixel. Titan's faces, 32.25 px
 * wide, repainted in 217 to 246 ms with their background as a share and in 64 to 67 ms with it in pixels.
 */
import { EXTRA_BYTES } from './prepared-leaf-box-blocks.js';
import { LEAF_BOX_PROPERTY as LEAF_BOX_STEP, SURFACE_SEAM_OUTSET_PROPERTY as SEAM_OUTSET, TEXELS_PER_CSS_PIXEL, type LeafBoxComponent, type PreparedLeafBox, type PreparedViewBinding } from '@cssearth/objects';


export { LEAF_BOX_PROPERTY as LEAF_BOX_STEP, SURFACE_SEAM_OUTSET_PROPERTY as SEAM_OUTSET } from '@cssearth/objects';

type StepBinding = Extract<PreparedViewBinding, { kind: 'silhouette-step-property' }>;

const format = (value: number) => String(Math.round(value * 1e6) / 1e6);
const component = (value: LeafBoxComponent, factor: number) => typeof value === 'number' ? `${format(value * factor)}px` : value;

/** WebKit lays out in 1/64 px and drops the rest. */
const LAYOUT_UNITS = 64;

/** The exact box may pass the full one by this share: the bake's ceiling leaves the full box a texel or two short of its
 * widest image (Io's 128 px of 130, Venus's 64 of 66). An image wider than that was capped on purpose (Charon's 13,000
 * texels would take 201 px), and has no exact fit. */
const EXACT_OVER_FULL = 1 + 1 / 16;

/** How a leaf draws an image at one texel per device pixel on both axes: the factor of its full box, the image's own
 * size in CSS pixels, and whether a leaf the view needs less of keeps this box. */
export interface LeafBoxExact { readonly factor: number; readonly tile: readonly [number, number]; readonly kept: boolean }

/** The texels per CSS pixel that are one per device pixel on a screen: its pixel ratio where that is a whole number no
 * less than the bake's two (an iPad's 2, a phone's 3). The copy is by backing pixel: on the iPad with the page scaled
 * to four backing pixels per CSS pixel, Io's faces in the boxes exact for two switched in 215 to 223 ms and in the
 * boxes exact for four in 35 to 44 ms (2026-10-04). Any other screen keeps the bake's density. */
const exactDensity = (devicePixelRatio: number) =>
  Number.isInteger(devicePixelRatio) && devicePixelRatio >= TEXELS_PER_CSS_PIXEL ? devicePixelRatio : TEXELS_PER_CSS_PIXEL;

/** The exact fit of an image of `pixels` in a leaf on a screen of `devicePixelRatio`. The image's width comes from its
 * pixels and the shape of the leaf's background; the factor is that width over the device pixels across the full
 * background, with the box it gives put on the layout grid (a prepared background rounded a hair wide, Titan's
 * 4,127.76 px, would leave the box under a whole texel). None for an image without a stated size, a leaf without a box
 * and background in pixels, or an image wider than the box allows.
 *
 * A leaf the view needs less of (a face behind the body) keeps the exact box while every one of the body's `leaves`
 * could: together their layers stay within the bytes kept beyond the view's need (EXTRA_BYTES). Io's 448 faces at the
 * level it rests on are 30 MB of layers in exact boxes and its switch 45 to 54 ms; with the hidden ones in the 3 px their
 * step asks for it is 103 to 136 ms, and halved to a quarter or a sixteenth of the image 163 to 465 ms more. Only where
 * the box is exact on this screen: elsewhere such a leaf would be resampled at full size. */
export function leafBoxExact(leaf: PreparedLeafBox, pixels: number | undefined, leaves = 1, devicePixelRatio: number = TEXELS_PER_CSS_PIXEL): LeafBoxExact | undefined {
  const [width, height] = leaf.backgroundSize ?? [], box = leaf.box;
  if (pixels === undefined || typeof width !== 'number' || typeof height !== 'number' || box === undefined || !(width > 0) || !(height > 0) || !(box[0] > 0)) return undefined;
  const imageWidth = Math.round(Math.sqrt(pixels * width / height)), imageHeight = Math.round(pixels / imageWidth);
  const density = exactDensity(devicePixelRatio);
  const factor = Math.round(box[0] * imageWidth / (density * width) * LAYOUT_UNITS) / LAYOUT_UNITS / box[0];
  if (factor > EXACT_OVER_FULL) return undefined;
  const layerBytes = box[0] * box[1] * factor ** 2 * devicePixelRatio ** 2 * 4;
  return { factor, tile: [imageWidth / density, imageHeight / density], kept: density === devicePixelRatio && layerBytes * leaves <= EXTRA_BYTES };
}

/** A leaf's factor: what its step needs of the full box, up to the whole. Showing an image with an exact fit, that box
 * once the step needs the whole image, or while the leaf keeps it. */
export function leafBoxFactor(leaf: PreparedLeafBox, step: number, exact?: LeafBoxExact) {
  if (leaf.density === undefined) return 1;
  const need = Math.min(1, step * leaf.density);
  return exact && (exact.kept || need >= Math.min(1, exact.factor)) ? exact.factor : need;
}

/** A leaf's final style values at a step and seam outset, showing an image whose exact fit is `exact`. */
export function leafBoxStyles(leaf: PreparedLeafBox, step: number, outset: number, seamOnly = false, exact?: LeafBoxExact): [string, string][] {
  const factor = leafBoxFactor(leaf, step, exact);
  const transform = `${leaf.matrix} scale(${format(1 / factor)})` + (leaf.seam
    ? ` translate(50%, 50%) scale(${format(1 + outset * leaf.seam[0])}, ${format(1 + outset * leaf.seam[1])}) translate(-50%, -50%)` : '');
  if (seamOnly) return leaf.seam ? [['transform', transform]] : [];
  const styles: [string, string][] = [];
  // The background in pixels. A leaf in its exact box draws the image at its own size; any other scales its prepared
  // lengths by its factor. A component kept as written stays as written.
  const lengths = (axis: 0 | 1) => {
    const size = leaf.backgroundSize?.[axis], position = leaf.backgroundPosition?.[axis];
    const scale = exact && factor === exact.factor && typeof size === 'number' && size > 0 ? exact.tile[axis] / size : factor;
    return { size: size === undefined ? undefined : component(size, scale), position: position === undefined ? undefined : component(position, scale) };
  };
  const x = lengths(0), y = lengths(1);
  if (leaf.backgroundPosition) styles.push(['backgroundPosition', `${x.position} ${y.position}`]);
  if (leaf.backgroundSize) styles.push(['backgroundSize', `${x.size} ${y.size}`]);
  styles.push(['transform', transform]);
  if (leaf.box) styles.push(['width', `${format(leaf.box[0] * factor)}px`], ['height', `${format(leaf.box[1] * factor)}px`]);
  return styles;
}

/** The leaf-box and seam-outset bindings of a presentation, with their prepared initial values. */
export function leafBoxBindings(bindings: readonly PreparedViewBinding[]) {
  const steps = bindings.find((binding): binding is StepBinding => binding.kind === 'silhouette-step-property' && binding.property === LEAF_BOX_STEP);
  const seam = bindings.find((binding): binding is StepBinding => binding.kind === 'silhouette-step-property' && binding.property === SEAM_OUTSET);
  return { steps, seam, boxes: [...steps?.boxes ?? [], ...seam?.boxes ?? []], step: Number(steps?.initial ?? 1e6), outset: Number(seam?.initial ?? 0) };
}

/** Owns the leaf-box leaves of one mounted tree: a step written on a leaf is that leaf's own; a seam outset written on
 * the seam binding's target reaches every leaf with seam coefficients. */
export function createLeafBoxWriter(bindings: readonly PreparedViewBinding[], nodes: readonly HTMLElement[],
  write: (element: HTMLElement, name: string, value: string) => void, devicePixelRatio: number = globalThis.devicePixelRatio ?? TEXELS_PER_CSS_PIXEL) {
  const { steps, seam, boxes, step, outset } = leafBoxBindings(bindings);
  const state = new Map(boxes.map(leaf => [leaf.node, { leaf, step, pixels: undefined as number | undefined, written: new Map<string, string>() }]));
  let currentOutset = outset, writes = 0;
  const sized = boxes.filter(leaf => leaf.density !== undefined).length;
  const cssName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  const publish = (current: { leaf: PreparedLeafBox; step: number; pixels: number | undefined; written: Map<string, string> }, seamOnly = false, adopting = false) => {
    const element = nodes[current.leaf.node]!;
    for (const [property, value] of leafBoxStyles(current.leaf, current.step, currentOutset, seamOnly, leafBoxExact(current.leaf, current.pixels, sized, devicePixelRatio))) {
      if (current.written.get(property) === value) continue;
      // A server-rendered leaf already carries its values, for the image the markup shows
      // (prepared-scene-serialization.ts): they stand until the first image lands.
      const served = adopting ? element.style.getPropertyValue(cssName(property)) : '';
      if (served) { current.written.set(property, served); continue; }
      write(element, property, value); writes++;
      current.written.set(property, value);
    }
  };
  for (const current of state.values()) publish(current, false, true);
  const seamed = [...state.values()].filter(current => current.leaf.seam);
  let seamCursor = seamed.length;
  const outsetNumber = (value: string) => {
    const number = Number(value);
    if (!Number.isFinite(number)) throw new TypeError(`Prepared seam outset is not a number: ${value}`);
    return number;
  };
  return {
    /** Whether a write of `name` on node `index` is a leaf-box step or seam outset this writer owns. */
    owns(index: number, name: string) {
      return name === LEAF_BOX_STEP ? state.has(index) || index === steps?.target : name === SEAM_OUTSET && index === seam?.target;
    },
    /** The step or outset in force on node `index`, as the binding reads it. */
    read(index: number, name: string) {
      if (name === SEAM_OUTSET) return String(currentOutset);
      return String(state.get(index)?.step ?? step);
    },
    /** Moves the seam outset to `value` a slice at a time: up to `budget` leaves take it, and the return is how many
     * did. An outset change rewrites every seamed leaf's transform (448 on Saturn and Jupiter, 31–49 ms of script in one
     * iPad frame at rest, 2026-09-30); the settle pacer spreads them as it spreads leaf-box steps. 0 once all show it. */
    drainOutset(value: string, budget: number) {
      const number = outsetNumber(value);
      if (number !== currentOutset) { currentOutset = number; seamCursor = 0; }
      let leaves = 0;
      while (seamCursor < seamed.length && leaves < budget) {
        const before = writes;
        publish(seamed[seamCursor++]!, true);
        if (writes > before) leaves++;
      }
      return leaves;
    },
    /** The leaf on node `index` now shows an image of `pixels` (none stated: the box its step asks for). Written with the
     * image, so the leaf repaints once; returns the number of style writes. */
    image(index: number, pixels: number | undefined) {
      const current = state.get(index);
      if (!current || current.leaf.density === undefined || current.pixels === pixels) return 0;
      const before = writes;
      current.pixels = pixels; publish(current);
      return writes - before;
    },
    set(index: number, name: string, value: string) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new TypeError(`Prepared node ${index} ${name} is not a number: ${value}`);
      const before = writes;
      if (name === SEAM_OUTSET) {
        currentOutset = number; seamCursor = seamed.length;
        for (const current of seamed) publish(current, true);
      } else {
        const current = state.get(index);
        if (!current || current.leaf.density === undefined) throw new TypeError(`Prepared node ${index} is not a leaf box.`);
        current.step = number; publish(current);
      }
      return writes - before;
    },
  };
}
