import type { LeafBoxComponent, PreparedLeafBox } from '@cssearth/objects';
import { rebuildPropertyTable } from '../css/property-table.ts';
import { isRecord } from '@cssearth/core';
import { scanCssDeclarations } from '../css/css-declaration-scanner.ts';

// Leaf boxes as prepared records (the last step of the presentation bindings, prepared-presentation-bindings.ts).
//
// The node builder and the bindings work in the variable form leaf-box.ts describes: each leaf's lengths and transform are
// `calc()` over its factor `--leaf-box`, which reads the body's `--silhouette-step`, and a surface leaf's transform reads
// the body's `--surface-seam-outset`. Measuring, depth partitions and the cascade check run on that form in a browser.
// What ships is this record instead: per leaf, its full box, its background size and position, its matrix, its seam
// coefficients and its density, with the steps' initial values on their bindings. The runtime writes a leaf's final
// values from it (packages/renderer/src/rendering/culling/prepared-leaf-box-direct.ts); no variable, `calc()` or parse reaches
// the page. A later bindings run expands the records back to the variable form first, so it measures what it always did.
import { LEAF_BOX_FACTOR, LEAF_BOX_PROPERTY, leafBoxLengths } from '../layout/leaf-box.ts';
import { SURFACE_SEAM_OUTSET_PROPERTY } from '../../scene/index.ts';

interface Property { name: string; value: string; custom: boolean }
interface TreeNode { parent: number; style: string; properties: readonly number[] }
interface Tree { nodes: readonly TreeNode[]; properties: readonly Property[] }
interface Binding { kind: string; target: number; property: string; initial?: string; boxes?: readonly PreparedLeafBox[] }
interface Definition { id: string; tree: Tree; viewBindings: readonly unknown[] }

const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const SCALED = new RegExp(String.raw`^calc\((${NUMBER})px \* var\(${LEAF_BOX_FACTOR}, 1\)\)$`);
const FACTOR = new RegExp(String.raw`^min\(1, var\(${LEAF_BOX_PROPERTY}, 1e6\) \* (${NUMBER})\)$`);
const UNSCALE = ` scale(calc(1 / var(${LEAF_BOX_FACTOR}, 1)))`;
const seamTerm = (k: string) => `calc(1 + var(${SURFACE_SEAM_OUTSET_PROPERTY}, 0) * ${k})`;
const SEAM = new RegExp(String.raw`^ translate\(50%, 50%\) scale\(calc\(1 \+ var\(${SURFACE_SEAM_OUTSET_PROPERTY}, 0\) \* (${NUMBER})\), calc\(1 \+ var\(${SURFACE_SEAM_OUTSET_PROPERTY}, 0\) \* (${NUMBER})\)\) translate\(-50%, -50%\)$`);
/** The properties a record carries; the node's static style drops them too, since the record overrides them. */
const OWNED = ['width', 'height', 'background-size', 'background-position', 'transform', '--polycss-atlas-width', '--polycss-atlas-height'];
const leafBoxBinding = (value: unknown): value is Binding => isRecord(value) && value.kind === 'silhouette-step-property' && value.property === LEAF_BOX_PROPERTY;
const seamBinding = (value: unknown): value is Binding => isRecord(value) && value.kind === 'silhouette-step-property' && value.property === SURFACE_SEAM_OUTSET_PROPERTY;

function pair(value: string, where: () => string): [LeafBoxComponent, LeafBoxComponent] {
  // Two space-separated components at the top level; each is a scaled length or kept as written.
  const parts: string[] = [];
  let depth = 0, start = 0;
  for (let at = 0; at <= value.length; at++) {
    const char = value[at];
    if (char === '(') depth++;
    else if (char === ')') depth--;
    else if ((char === ' ' || at === value.length) && depth === 0) { if (at > start) parts.push(value.slice(start, at)); start = at + 1; }
  }
  if (parts.length !== 2) throw new TypeError(`${where()}: expected two components: ${value}`);
  return parts.map(part => {
    const scaled = SCALED.exec(part);
    if (scaled) return Number(scaled[1]);
    if (part.includes('var(')) throw new TypeError(`${where()}: unexpected leaf-box component: ${part}`);
    return part;
  }) as [LeafBoxComponent, LeafBoxComponent];
}
function length(value: string, where: () => string) {
  const scaled = SCALED.exec(value);
  if (!scaled) throw new TypeError(`${where()}: unexpected leaf-box length: ${value}`);
  return Number(scaled[1]);
}
// Exact, case-sensitive exclusion; no colon means no declaration name and the fragment stays.
const LEAF_BOX_DECLARATION_NAME = (part: string, colon: number) => colon < 0 ? undefined : part.slice(0, colon).trim();
/** A static style without the named declarations. Semicolons inside quotes or parentheses (URLs) do not split. */
function withoutDeclarations(style: string, names: readonly string[], declarationName = LEAF_BOX_DECLARATION_NAME) {
  return [...scanCssDeclarations(style)].filter(part => {
    const colon = part.indexOf(':');
    const name = declarationName(part, colon);
    return name === undefined || !names.includes(name);
  }).map(part => `${part};`).join('');
}

/** Static atlas sizes as the leaf's own width and height: every stylesheet reads --polycss-atlas-width/-height as exactly
 * that (the surfaces stylesheets and PolyCSS), so the variable only cost a lookup per leaf. */
function staticSizes(style: string) {
  return style.replace(/(^|;)\s*--polycss-atlas-width\s*:/g, '$1width:').replace(/(^|;)\s*--polycss-atlas-height\s*:/g, '$1height:');
}

/** The variable form's leaf boxes as records; every leaf-box variable leaves the tree. */
export function withLeafBoxRecords<D extends Definition>(definition: D): D {
  const { tree } = definition;
  const binding = definition.viewBindings.find(leafBoxBinding);
  const seam = definition.viewBindings.find(seamBinding);
  const valueOn = (node: number, name: string) => {
    const id = tree.nodes[node]?.properties.find(at => tree.properties[at]!.name === name);
    return id === undefined ? undefined : tree.properties[id]!.value;
  };
  const boxes: PreparedLeafBox[] = [];
  let properties = tree.properties;
  const constant = (node: TreeNode, index: number): TreeNode => {
    // A leaf the bindings never measured (a hidden cutaway) reads the factor's fallback, 1, and no step or outset ever
    // reaches it: its values are constants, written as such. A constant atlas size set after the style overrides the
    // style's (Saturn's material leaves shrink their frame box to their tile), so it folds in as the leaf's own length.
    const sizes = node.properties.filter(id => /^--polycss-atlas-(?:width|height)$/.test(tree.properties[id]!.name) && !tree.properties[id]!.value.includes('var('));
    let style = staticSizes(node.style);
    for (const id of sizes) {
      const { name, value } = tree.properties[id]!, length = name === '--polycss-atlas-width' ? 'width' : 'height';
      style = `${withoutDeclarations(style, [length])}${value ? `${length}:${value};` : ''}`;
    }
    if (sizes.length) node = { ...node, properties: node.properties.filter(id => !sizes.includes(id)) };
    if (!node.properties.some(id => /var\(--(?:leaf-box|surface-seam-outset)\b/.test(tree.properties[id]!.value))) return style === node.style ? node : { ...node, style };
    // A leaf the seam outset reaches but no step does (a body without measured leaf boxes): its record, box factor 1.
    if (seam && node.properties.some(id => tree.properties[id]!.value.includes(`var(${SURFACE_SEAM_OUTSET_PROPERTY}`))) return leafRecord(node, index, undefined, seamBoxes);
    const ids = node.properties.map(id => {
      const property = tree.properties[id]!;
      if (!/var\(--(?:leaf-box|surface-seam-outset)\b/.test(property.value)) return id;
      const value = property.value.replace(new RegExp(SCALED.source.slice(1, -1), 'g'), (_match, number: string) => `${number}px`)
        .replaceAll(UNSCALE, ' scale(1)').replace(new RegExp(String.raw`calc\(1 \+ var\(${SURFACE_SEAM_OUTSET_PROPERTY}, 0\) \* ${NUMBER}\)`, 'g'), '1');
      if (/var\(--(?:leaf-box|surface-seam-outset|silhouette-step)\b/.test(value)) throw new TypeError(`${definition.id}: prepared node ${index} ${property.name} keeps a leaf-box variable: ${value}`);
      properties = [...properties, { ...property, name: property.name === '--polycss-atlas-width' ? 'width' : property.name === '--polycss-atlas-height' ? 'height' : property.name, value, custom: property.name.startsWith('--polycss-atlas') ? false : property.custom }];
      return properties.length - 1;
    });
    return { ...node, style, properties: ids };
  };
  const seamBoxes: PreparedLeafBox[] = [];
  function leafRecord(node: TreeNode, index: number, density: number | undefined, into: PreparedLeafBox[]): TreeNode {
    const where = (name: string) => () => `${definition.id}: prepared node ${index} ${name}`;
    const box: { -readonly [K in keyof PreparedLeafBox]?: PreparedLeafBox[K] } & { node: number } = { node: index };
    let width: number | undefined, height: number | undefined, atlas = false, matrix: string | undefined;
    const kept: number[] = [];
    for (const id of node.properties) {
      const { name, value } = tree.properties[id]!;
      if (name === LEAF_BOX_FACTOR || name === LEAF_BOX_PROPERTY) continue;
      if (!value.includes(`var(${LEAF_BOX_FACTOR}`) && !value.includes(`var(${SURFACE_SEAM_OUTSET_PROPERTY}`)) { kept.push(id); continue; }
      if (name === '--polycss-atlas-width' || name === 'width') { width = length(value, where(name)); atlas ||= name.startsWith('--'); }
      else if (name === '--polycss-atlas-height' || name === 'height') { height = length(value, where(name)); atlas ||= name.startsWith('--'); }
      else if (name === 'backgroundSize') box.backgroundSize = pair(value, where(name));
      else if (name === 'backgroundPosition') box.backgroundPosition = pair(value, where(name));
      else if (name === 'transform') {
        const at = value.indexOf(UNSCALE);
        if (at < 0) throw new TypeError(`${where(name)()}: the transform has no box-factor inverse: ${value}`);
        matrix = value.slice(0, at);
        const rest = value.slice(at + UNSCALE.length);
        if (rest) {
          const seamed = SEAM.exec(rest);
          if (!seamed) throw new TypeError(`${where(name)()}: unexpected transform after the box factor: ${rest}`);
          box.seam = [Number(seamed[1]), Number(seamed[2])];
        }
      } else throw new TypeError(`${where(name)()}: a property reads a leaf-box variable: ${value}`);
    }
    if (matrix === undefined) throw new TypeError(`${where('transform')()}: a leaf box has no transform.`);
    if ((width === undefined) !== (height === undefined)) throw new TypeError(`${where('box')()}: a leaf box needs both lengths.`);
    into.push({ node: index, ...density === undefined ? {} : { density }, ...width !== undefined ? { box: [width, height!] as const } : {}, ...atlas ? { atlas: true as const } : {},
      ...box.backgroundSize ? { backgroundSize: box.backgroundSize } : {}, ...box.backgroundPosition ? { backgroundPosition: box.backgroundPosition } : {},
      matrix, ...box.seam ? { seam: box.seam } : {} });
    return { ...node, style: withoutDeclarations(node.style, OWNED), properties: kept };
  }
  const nodes = tree.nodes.map((node, index) => {
    const factor = valueOn(index, LEAF_BOX_FACTOR);
    if (factor === undefined) return constant(node, index);
    const density = FACTOR.exec(factor)?.[1];
    if (density === undefined) throw new TypeError(`${definition.id}: prepared node ${index} ${LEAF_BOX_FACTOR}: unexpected factor: ${factor}`);
    return leafRecord(node, index, Number(density), boxes);
  });
  if (!boxes.length && !seamBoxes.length) return nodes.every((node, index) => node === tree.nodes[index]) ? definition : { ...definition, tree: rebuildPropertyTable({ ...tree, properties }, nodes) };
  if (boxes.length && !binding) throw new TypeError(`${definition.id}: leaf boxes have no ${LEAF_BOX_PROPERTY} binding.`);
  const initial = binding ? valueOn(binding.target, LEAF_BOX_PROPERTY) : undefined;
  if (boxes.length && initial === undefined) throw new TypeError(`${definition.id}: the ${LEAF_BOX_PROPERTY} binding target ${binding!.target} carries no initial step.`);
  const seamInitial = seam ? valueOn(seam.target, SURFACE_SEAM_OUTSET_PROPERTY) : undefined;
  if (seam && seamInitial === undefined) throw new TypeError(`${definition.id}: the seam outset binding target ${seam.target} carries no initial outset.`);
  // The steps' initial values move from their targets onto the bindings.
  const stripped = nodes.map((node, index) => index === binding?.target || index === seam?.target
    ? { ...node, properties: node.properties.filter(id => ![LEAF_BOX_PROPERTY, SURFACE_SEAM_OUTSET_PROPERTY].includes(tree.properties[id]!.name)) } : node);
  const bindings = definition.viewBindings.map(entry => entry === binding && boxes.length ? { ...binding, initial, boxes }
    : entry === seam ? { ...seam, initial: seamInitial, ...seamBoxes.length ? { boxes: seamBoxes } : {} } : entry);
  return { ...definition, tree: rebuildPropertyTable({ ...tree, properties }, stripped), viewBindings: bindings };
}

/** What withLeafBoxRecords leaves of a leaf the bindings did not measure: its matrix and the factor's inverse at one. A
 * seam term is not restored: its coefficients are not in the constant form. */
const UNMEASURED = /^matrix3d\([^)]*\) scale\(1\)$/;
/** The lengths the node builder scales by the leaf's factor (prepared-node-tree.ts). */
const BOXED = ['width', 'height', 'backgroundSize', 'backgroundPosition'];

/** Leaves stored as constants, back in the variable form: the next bindings run measures those that render by then, and
 * the others become the same constants again. A leaf missed once otherwise keeps its full box for good. Dione, Rhea and
 * Enceladus held their 452 leaves in full boxes this way, whatever the image's size, and an iPad took 189 to 289 ms to
 * switch between Enceladus's quarter-size datasets (2026-10-05). */
function withVariableConstants<D extends Definition>(definition: D): D {
  const { tree } = definition, properties = [...tree.properties];
  let restored = false;
  const nodes = tree.nodes.map(node => {
    if (!node.properties.some(id => tree.properties[id]!.name === 'transform' && UNMEASURED.test(tree.properties[id]!.value))) return node;
    restored = true;
    return { ...node, properties: node.properties.map(id => {
      const property = tree.properties[id]!;
      const value = property.name === 'transform' ? `${property.value.slice(0, -' scale(1)'.length)}${UNSCALE}` : BOXED.includes(property.name) ? leafBoxLengths(property.value) : property.value;
      return value === property.value ? id : properties.push({ ...property, value }) - 1;
    }) };
  });
  return restored ? { ...definition, tree: rebuildPropertyTable({ ...tree, properties }, nodes) } : definition;
}

/** The records expanded back to the variable form the bindings measure (the inverse of withLeafBoxRecords). */
export function withoutLeafBoxRecords<D extends Definition>(stored: D): D {
  const definition = withVariableConstants(stored);
  const binding = definition.viewBindings.find(leafBoxBinding);
  const seam = definition.viewBindings.find(seamBinding);
  if (!binding?.boxes && !seam?.boxes) return definition;
  const properties = [...definition.tree.properties];
  const add = (property: Property) => { properties.push(property); return properties.length - 1; };
  const scaled = (component: LeafBoxComponent) => typeof component === 'number' ? `calc(${component}px * var(${LEAF_BOX_FACTOR}, 1))` : component;
  const extra = new Map<number, number[]>();
  for (const box of [...binding?.boxes ?? [], ...seam?.boxes ?? []]) {
    const ids: number[] = [];
    if (box.backgroundPosition) ids.push(add({ name: 'backgroundPosition', value: box.backgroundPosition.map(scaled).join(' '), custom: false }));
    if (box.backgroundSize) ids.push(add({ name: 'backgroundSize', value: box.backgroundSize.map(scaled).join(' '), custom: false }));
    ids.push(add({ name: 'transform', value: `${box.matrix}${UNSCALE}${box.seam ? ` translate(50%, 50%) scale(${seamTerm(String(box.seam[0]))}, ${seamTerm(String(box.seam[1]))}) translate(-50%, -50%)` : ''}`, custom: false }));
    if (box.box) for (const [at, name] of [[0, 'width'], [1, 'height']] as const)
      ids.push(add({ name: box.atlas ? `--polycss-atlas-${name}` : name, value: scaled(box.box[at]), custom: Boolean(box.atlas) }));
    if (box.density !== undefined) ids.push(add({ name: LEAF_BOX_FACTOR, value: `min(1, var(${LEAF_BOX_PROPERTY}, 1e6) * ${box.density})`, custom: true }));
    extra.set(box.node, ids);
  }
  const initials = new Map<number, number[]>();
  const push = (node: number, id: number) => initials.set(node, [...initials.get(node) ?? [], id]);
  if (binding?.boxes) push(binding.target, add({ name: LEAF_BOX_PROPERTY, value: String(binding.initial), custom: true }));
  if (seam?.initial !== undefined) push(seam.target, add({ name: SURFACE_SEAM_OUTSET_PROPERTY, value: seam.initial, custom: true }));
  const nodes = definition.tree.nodes.map((node, index) => extra.has(index) || initials.has(index)
    ? { ...node, properties: [...initials.get(index) ?? [], ...node.properties, ...extra.get(index) ?? []] } : node);
  const bindings = definition.viewBindings.map(entry => {
    if (binding && entry === binding && binding.boxes) { const { boxes: _boxes, initial: _initial, ...rest } = binding; return rest; }
    if (seam && entry === seam) { const { initial: _initial, boxes: _boxes, ...rest } = seam; return rest; }
    return entry;
  });
  return { ...definition, tree: rebuildPropertyTable({ ...definition.tree, properties }, nodes), viewBindings: bindings };
}

/** withoutLeafBoxRecords for a value read from disk: checks the shape it reads before expanding, so a reader needs no cast. */
export function expandLeafBoxRecords(value: unknown): unknown {
  if (!isRecord(value) || typeof value.id !== 'string' || !Array.isArray(value.viewBindings) || !isRecord(value.tree) ||
      !Array.isArray(value.tree.nodes) || !Array.isArray(value.tree.properties)) return value;
  return withoutLeafBoxRecords(value as unknown as Definition);
}
