import type { PreparedViewBinding } from './prepared-presentation.js';

/**
 * Leaf boxes written from their prepared records (packages/bake/src/presentation/leaf-box-records.ts).
 *
 * The bake ships each leaf's full box, background, matrix, seam coefficients and density, with the steps' initial values
 * on their bindings. A step or seam outset change writes the leaf's final `width`, `height`, `background-size`,
 * `background-position` and `transform` directly: no custom property, `calc()` or parse, and each leaf keeps what it
 * last wrote so an unchanged value is never written again.
 */

export const LEAF_BOX_STEP = '--silhouette-step';
export const SEAM_OUTSET = '--surface-seam-outset';

export type LeafBoxComponent = number | string;
export interface PreparedLeafBox {
  /** Absent on a seam-only leaf, whose box factor is always 1. */
  readonly node: number; readonly density?: number;
  readonly box?: readonly [number, number]; readonly atlas?: true;
  readonly backgroundSize?: readonly [LeafBoxComponent, LeafBoxComponent];
  readonly backgroundPosition?: readonly [LeafBoxComponent, LeafBoxComponent];
  readonly matrix: string; readonly seam?: readonly [number, number];
}
type StepBinding = Extract<PreparedViewBinding, { kind: 'silhouette-step-property' }>;

const format = (value: number) => String(Math.round(value * 1e6) / 1e6);
const component = (value: LeafBoxComponent, factor: number) => typeof value === 'number' ? `${format(value * factor)}px` : value;

/** A leaf's final style values at a step and seam outset. */
export function leafBoxStyles(leaf: PreparedLeafBox, step: number, outset: number, seamOnly = false): [string, string][] {
  const factor = leaf.density === undefined ? 1 : Math.min(1, step * leaf.density);
  const transform = `${leaf.matrix} scale(${format(1 / factor)})` + (leaf.seam
    ? ` translate(50%, 50%) scale(${format(1 + outset * leaf.seam[0])}, ${format(1 + outset * leaf.seam[1])}) translate(-50%, -50%)` : '');
  if (seamOnly) return leaf.seam ? [['transform', transform]] : [];
  const styles: [string, string][] = [];
  if (leaf.backgroundPosition) styles.push(['backgroundPosition', leaf.backgroundPosition.map(part => component(part, factor)).join(' ')]);
  if (leaf.backgroundSize) styles.push(['backgroundSize', leaf.backgroundSize.map(part => component(part, factor)).join(' ')]);
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
  write: (element: HTMLElement, name: string, value: string) => void) {
  const { steps, seam, boxes, step, outset } = leafBoxBindings(bindings);
  const state = new Map(boxes.map(leaf => [leaf.node, { leaf, step, written: new Map<string, string>() }]));
  let currentOutset = outset, writes = 0;
  const cssName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  const publish = (current: { leaf: PreparedLeafBox; step: number; written: Map<string, string> }, seamOnly = false, adopting = false) => {
    const element = nodes[current.leaf.node]!;
    for (const [property, value] of leafBoxStyles(current.leaf, current.step, currentOutset, seamOnly)) {
      if (current.written.get(property) === value) continue;
      // A server-rendered leaf already carries these exact values.
      if (!(adopting && element.style.getPropertyValue(cssName(property)) === value)) { write(element, property, value); writes++; }
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
