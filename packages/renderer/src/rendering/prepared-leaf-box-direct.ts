import type { PreparedTree } from './prepared-presentation.js';

/**
 * Leaf boxes written as final values on each leaf (packages/bake/src/presentation/leaf-box.ts).
 *
 * Preparation publishes every leaf-box leaf with its lengths and transform as `calc()` over custom properties: the leaf's
 * factor `--leaf-box: min(1, var(--silhouette-step) × density)`, and the body's `--surface-seam-outset`, inherited from
 * the mesh. A step or outset write then made the browser resolve that chain on every leaf it reached (the outset on all
 * of a body's leaves at once). Here the same arithmetic is done once per write, and the leaf receives plain values:
 * `width`, `height`, `background-position`, `background-size` and `transform`. No custom property is read or written.
 *
 * The prepared values keep their exact form: a leaf's matrix, its lengths and its seam coefficients are the prepared
 * numbers. Only the three substitutions the prepared `calc()` expressions name are evaluated, and anything else that
 * reads one of these variables is refused, naming the object, node, property and value.
 */

const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const LENGTH = new RegExp(String.raw`calc\((${NUMBER})px \* var\(--leaf-box, 1\)\)`, 'g');
const INVERSE = /calc\(1 \/ var\(--leaf-box, 1\)\)/g;
const OUTSET = new RegExp(String.raw`calc\(1 \+ var\(--surface-seam-outset, 0\) \* (${NUMBER})\)`, 'g');
const FACTOR = new RegExp(String.raw`^min\(1, var\(--silhouette-step, 1e6\) \* (${NUMBER})\)$`);
const TOKEN = new RegExp(`${LENGTH.source}|${INVERSE.source}|${OUTSET.source}`, 'g');
/** The variables a leaf box reads; a value that still names one after compilation is refused. */
const LEAF_BOX_VARIABLES = /var\(--(?:leaf-box|silhouette-step|surface-seam-outset)\b/;

export const LEAF_BOX_STEP = '--silhouette-step';
export const SEAM_OUTSET = '--surface-seam-outset';
/** The leaf's own custom properties that preparation publishes; the direct values replace them. Stylesheets read the
 * atlas sizes as the leaf's `width` and `height` (every surfaces stylesheet and PolyCSS). */
const REPLACED: Readonly<Record<string, string | null>> = {
  '--leaf-box': null, '--polycss-atlas-width': 'width', '--polycss-atlas-height': 'height',
};

type Part = string | { length: number } | { inverse: true } | { outset: number };
interface Template { property: string; parts: readonly Part[]; seam: boolean }
export interface LeafBoxLeaf {
  readonly index: number;
  readonly density: number;
  readonly templates: readonly Template[];
  /** The node whose step and outset this leaf follows until its own step is written. */
  readonly stepOwner: number; readonly outsetOwner: number;
}

const format = (value: number) => String(Math.round(value * 1e6) / 1e6);

function compileValue(value: string, where: () => string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const match of value.matchAll(TOKEN)) {
    if (match.index! > last) parts.push(value.slice(last, match.index));
    if (match[1] !== undefined) parts.push({ length: Number(match[1]) });
    else if (match[2] !== undefined) parts.push({ outset: Number(match[2]) });
    else parts.push({ inverse: true });
    last = match.index! + match[0].length;
  }
  if (last < value.length) parts.push(value.slice(last));
  if (parts.some(part => typeof part === 'string' && LEAF_BOX_VARIABLES.test(part)))
    throw new TypeError(`${where()}: a leaf-box value reads a variable this runtime does not resolve: ${value}`);
  return parts;
}

const ownerOf = (tree: PreparedTree, index: number, name: string) => {
  for (let at = index; at !== -1; at = tree.nodes[at]!.parent)
    if (tree.nodes[at]!.properties.some(id => tree.properties[id]!.name === name)) return at;
  return -1;
};
const valueOf = (tree: PreparedTree, index: number, name: string) => {
  const id = tree.nodes[index]?.properties.find(id => tree.properties[id]!.name === name);
  return id === undefined ? null : tree.properties[id]!.value;
};

/** The leaf-box leaves of a prepared tree, by node index. */
export function compileLeafBoxes(tree: PreparedTree, objectId: string): ReadonlyMap<number, LeafBoxLeaf> {
  const leaves = new Map<number, LeafBoxLeaf>();
  for (const [index, node] of tree.nodes.entries()) {
    const factor = valueOf(tree, index, '--leaf-box');
    if (factor === null) continue;
    const where = (property: string) => () => `${objectId}: prepared node ${index} ${property}`;
    const density = FACTOR.exec(factor)?.[1];
    if (density === undefined) throw new TypeError(`${where('--leaf-box')()}: unexpected leaf-box factor: ${factor}`);
    const templates: Template[] = [];
    for (const id of node.properties) {
      const { name, value } = tree.properties[id]!;
      if (name === '--leaf-box' || !/var\(--(?:leaf-box|surface-seam-outset)\b/.test(value)) continue;
      const property = name in REPLACED ? REPLACED[name] : name;
      if (property === null || property === undefined) throw new TypeError(`${where(name)()}: unexpected leaf-box property.`);
      const parts = compileValue(value, where(name));
      templates.push({ property, parts, seam: parts.some(part => typeof part === 'object' && 'outset' in part) });
    }
    leaves.set(index, { index, density: Number(density), templates,
      stepOwner: ownerOf(tree, index, LEAF_BOX_STEP), outsetOwner: ownerOf(tree, index, SEAM_OUTSET) });
  }
  return leaves;
}

/** The leaf's box factor at a silhouette step, as `--leaf-box` defines it. */
export const leafBoxFactor = (leaf: LeafBoxLeaf, step: number) => Math.min(1, step * leaf.density);

/** A leaf's final style values at a step and seam outset. */
export function leafBoxStyles(leaf: LeafBoxLeaf, step: number, outset: number, seamOnly = false): [string, string][] {
  const factor = leafBoxFactor(leaf, step);
  const styles: [string, string][] = [];
  for (const template of leaf.templates) {
    if (seamOnly && !template.seam) continue;
    let value = '';
    for (const part of template.parts) value += typeof part === 'string' ? part
      : 'length' in part ? `${format(part.length * factor)}px` : 'inverse' in part ? format(1 / factor) : format(1 + outset * part.outset);
    styles.push([template.property, value]);
  }
  return styles;
}

/** Whether a prepared property is one the direct values replace on a leaf-box leaf. */
export const replacedByLeafBox = (leaf: LeafBoxLeaf, name: string) =>
  name in REPLACED || leaf.templates.some(template => template.property === name);

/** The step and outset a leaf starts with: the prepared values on its owners. */
export function initialLeafBox(tree: PreparedTree, leaf: LeafBoxLeaf) {
  const step = leaf.stepOwner === -1 ? null : Number(valueOf(tree, leaf.stepOwner, LEAF_BOX_STEP));
  const outset = leaf.outsetOwner === -1 ? 0 : Number(valueOf(tree, leaf.outsetOwner, SEAM_OUTSET));
  return { step: step !== null && Number.isFinite(step) ? step : 1e6, outset: Number.isFinite(outset) ? outset : 0 };
}

/**
 * Owns the leaf-box leaves of one mounted tree. It takes each leaf over once, writing its final values and removing its
 * prepared variables, then answers the step and outset writes the presentation makes: a step written on a leaf is that
 * leaf's own, as an inline `--silhouette-step` was; a step or outset written on an ancestor reaches the leaves that
 * inherited it. Each leaf keeps the values it last wrote, so an unchanged value is never written again.
 */
export function createLeafBoxWriter(tree: PreparedTree, objectId: string, nodes: readonly HTMLElement[],
  write: (element: HTMLElement, name: string, value: string) => void) {
  const leaves = compileLeafBoxes(tree, objectId);
  const state = new Map<number, { step: number; outset: number; own: boolean; written: Map<string, string> }>();
  const byStepOwner = new Map<number, LeafBoxLeaf[]>(), byOutsetOwner = new Map<number, LeafBoxLeaf[]>();
  const ownerValues = new Map<string, string>();
  let writes = 0;
  const cssName = (name: string) => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
  const publish = (leaf: LeafBoxLeaf, seamOnly = false, adopting = false) => {
    const current = state.get(leaf.index)!, element = nodes[leaf.index]!;
    for (const [property, value] of leafBoxStyles(leaf, current.step, current.outset, seamOnly)) {
      if (current.written.get(property) === value) continue;
      // A server-rendered leaf already carries these exact values.
      if (!(adopting && element.style.getPropertyValue(cssName(property)) === value)) { write(element, property, value); writes++; }
      current.written.set(property, value);
    }
  };
  for (const leaf of leaves.values()) {
    state.set(leaf.index, { ...initialLeafBox(tree, leaf), own: leaf.stepOwner === leaf.index, written: new Map() });
    for (const [owners, owner] of [[byStepOwner, leaf.stepOwner], [byOutsetOwner, leaf.outsetOwner]] as const)
      if (owner !== -1) owners.set(owner, [...owners.get(owner) ?? [], leaf]);
    publish(leaf, false, true);
    const element = nodes[leaf.index]!;
    for (const name of Object.keys(REPLACED)) if (element.style.getPropertyValue(name)) element.style.removeProperty(name);
    if (leaf.stepOwner === leaf.index) element.style.removeProperty(LEAF_BOX_STEP);
  }
  for (const [owners, name] of [[byStepOwner, LEAF_BOX_STEP], [byOutsetOwner, SEAM_OUTSET]] as const)
    for (const owner of owners.keys()) if (owner !== -1 && !leaves.has(owner)) ownerValues.set(`${owner}:${name}`, valueOf(tree, owner, name) ?? '');
  return {
    leaves,
    /** Whether a write of `name` on node `index` is a leaf-box step or outset this writer owns. */
    owns(index: number, name: string) {
      return name === LEAF_BOX_STEP ? leaves.has(index) || byStepOwner.has(index) : name === SEAM_OUTSET && byOutsetOwner.has(index);
    },
    /** The step or outset last written on node `index`, as the prepared variable read would give it; '' when none. */
    read(index: number, name: string) {
      const leaf = state.get(index);
      if (leaf && name === LEAF_BOX_STEP) return leaf.own ? String(leaf.step) : '';
      return ownerValues.get(`${index}:${name}`) ?? '';
    },
    set(index: number, name: string, value: string) {
      const number = Number(value);
      if (!Number.isFinite(number)) throw new TypeError(`${objectId}: prepared node ${index} ${name} is not a number: ${value}`);
      const before = writes;
      if (name === LEAF_BOX_STEP) {
        const own = state.get(index);
        if (own) { own.step = number; own.own = true; publish(leaves.get(index)!); return writes - before; }
        ownerValues.set(`${index}:${name}`, value);
        for (const leaf of byStepOwner.get(index) ?? []) {
          const current = state.get(leaf.index)!;
          if (current.own) continue;
          current.step = number; publish(leaf);
        }
      } else {
        ownerValues.set(`${index}:${name}`, value);
        for (const leaf of byOutsetOwner.get(index) ?? []) { state.get(leaf.index)!.outset = number; publish(leaf, true); }
      }
      return writes - before;
    },
    writes: () => writes,
  };
}
