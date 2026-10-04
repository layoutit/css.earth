import { requireTextureTileLeaves, textureTileLeafStyles, type PreparedTextureTile, type PreparedTextureTileLeaves, type PreparedVariant } from '@cssearth/objects';
import { rebuildPropertyTable } from './property-table.ts';
import { isRecord } from '@cssearth/core';
import { scanCssDeclarations } from './css-declaration-scanner.ts';

// Tiled page leaves as prepared records (the last step of the presentation bindings, prepared-presentation-bindings.ts).
//
// At a small level every page of a bank is one tile of a shared sheet (paged-ellipsoid texture-levels.ts). The node
// builder writes each page leaf's background in a variable form: its offset is `calc(<unit>px * var(<page>-x, 0) - <x>px)`
// and its size `calc(<width>px * var(<page>-scale, 1)) auto`, where the body carries the page's initial tile beside its
// image (paged-ellipsoid presentation.ts). The bindings measure and partition that form in a browser. What ships instead
// is one record per texture write: the unit, the page width, the initial tile, and each leaf's own offset. Every leaf's
// prepared values are literal, resolved at the initial tile; the runtime writes a leaf's final values on each level
// switch (packages/renderer/src/rendering/prepared-texture-levels.ts, createTextureTileWriter), so no variable or
// `calc()` reaches the page. A later bindings run expands the records back to the variable form first.

interface Property { name: string; value: string; custom: boolean }
interface TreeNode { parent: number; style: string; properties: readonly number[] }
interface Tree { nodes: readonly TreeNode[]; properties: readonly Property[]; textureBindings?: readonly { target: number; name: string; leaves: readonly number[] }[] }
interface Definition { id: string; tree: Tree; textureLevels?: unknown; variants: readonly Pick<PreparedVariant, 'writes'>[] }

const AXES = [['x', '0'], ['y', '0'], ['scale', '1']] as const;

/** The custom properties a tiled page's leaves read beside its image in the variable form: the tile's offset and scale, or
 * the page's own (no offset, scale 1). Unitless: the leaves multiply them by inline lengths, which preparation scales
 * with the leaf's raster (projective-layout.ts). */
export function textureTileVariables(name: string, tile: PreparedTextureTile | undefined): readonly (readonly [string, string])[] {
  return [[`${name}-x`, String(tile?.x ?? 0)], [`${name}-y`, String(tile?.y ?? 0)], [`${name}-scale`, String(tile?.scale ?? 1)]];
}

const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?`;
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TILE_VARIABLE = /var\((--[\w-]+)-(?:x|y|scale)\b/;
const STYLE_NAMES: Readonly<Record<string, string>> = { backgroundPosition: 'background-position', backgroundSize: 'background-size' };

// Exact case; historical malformed fragments use slice(0, -1), dropping their final character.
// Preserve that admission policy separately from the leaf-box adapter's colonless retention.
const TEXTURE_DECLARATION_NAME = (part: string, colon: number) => part.slice(0, colon).trim();
/** A static style's declarations, split where CSS splits them: not inside quotes or parentheses (URLs). */
function declarations(style: string, declarationName = TEXTURE_DECLARATION_NAME) {
  return [...scanCssDeclarations(style)].map(part => {
    const colon = part.indexOf(':');
    return { name: declarationName(part, colon), value: part.slice(colon + 1).trim(), text: part };
  });
}

/** The variable form's tiled page leaves as records; every tile variable leaves the tree. */
export function withTextureTileRecords<D extends Definition>(definition: D): D {
  const { tree } = definition;
  const levels = isRecord(definition.textureLevels) ? definition.textureLevels : undefined;
  const reads = (text: string) => TILE_VARIABLE.test(text);
  // No leaf reads a tile: nothing to record (a body without sheets, or one already in record form).
  if (!tree.nodes.some(node => reads(node.style) || node.properties.some(id => reads(tree.properties[id]!.value)))) return definition;
  if (!levels) throw new TypeError(`${definition.id}: leaves read texture tile variables, but the presentation has no texture levels.`);
  const bindingOf = new Map<number, { target: number; name: string }>();
  for (const binding of tree.textureBindings ?? []) for (const leaf of binding.leaves) bindingOf.set(leaf, binding);
  const own = (node: number, name: string) => {
    const id = tree.nodes[node]!.properties.find(at => tree.properties[at]!.name === name);
    return id === undefined ? undefined : tree.properties[id]!.value;
  };
  // The value a leaf's tile variable resolves to in the prepared tree: the nearest carrier's, or the fallback.
  const carriers = new Set<string>();
  const resolved = (leaf: number, name: string, axis: typeof AXES[number]) => {
    for (let cursor = tree.nodes[leaf]!.parent; cursor >= 0; cursor = tree.nodes[cursor]!.parent) {
      const value = own(cursor, `${name}-${axis[0]}`);
      if (value === undefined) continue;
      carriers.add(`${cursor}:${name}`);
      const number = Number(value);
      if (!Number.isFinite(number)) throw new TypeError(`${definition.id}: prepared node ${cursor} ${name}-${axis[0]} is not a number: ${value}`);
      return number;
    }
    return Number(axis[1]);
  };
  const groups = new Map<string, PreparedTextureTileLeaves & { leaves: [number, number, number][] }>();
  const initialTile = (leaf: number, name: string): PreparedTextureTile => ({ x: resolved(leaf, name, AXES[0]), y: resolved(leaf, name, AXES[1]), scale: resolved(leaf, name, AXES[2]) });
  let properties = [...tree.properties];
  const nodes = tree.nodes.map((node, index) => {
    const values = new Map<string, string>();
    for (const { name, value } of declarations(node.style)) if (reads(value)) values.set(name === 'background-position' ? 'backgroundPosition' : name === 'background-size' ? 'backgroundSize' : name, value);
    for (const id of node.properties) { const property = tree.properties[id]!; if (reads(property.value)) values.set(property.name, property.value); }
    if (!values.size) return node;
    const where = (name: string) => `${definition.id}: prepared node ${index} ${name}`;
    const binding = bindingOf.get(index);
    if (!binding) throw new TypeError(`${where('background')}: a leaf reads texture tile variables but draws no bound texture.`);
    const page = escape(binding.name);
    const extra = [...values.keys()].filter(name => !(name in STYLE_NAMES));
    if (extra.length) throw new TypeError(`${where(extra[0]!)}: only the background position and size may read a tile variable: ${values.get(extra[0]!)}`);
    const position = new RegExp(String.raw`^calc\((${NUMBER})px \* var\(${page}-x, 0\) - (${NUMBER})px\) calc\((${NUMBER})px \* var\(${page}-y, 0\) - (${NUMBER})px\)$`).exec(values.get('backgroundPosition') ?? '');
    const size = new RegExp(String.raw`^calc\((${NUMBER})px \* var\(${page}-scale, 1\)\) auto$`).exec(values.get('backgroundSize') ?? '');
    if (!position) throw new TypeError(`${where('backgroundPosition')}: unexpected tiled position for ${binding.name}: ${values.get('backgroundPosition')}`);
    if (!size) throw new TypeError(`${where('backgroundSize')}: unexpected tiled size for ${binding.name}: ${values.get('backgroundSize')}`);
    const unit = Number(position[1]), width = Number(size[1]);
    if (Number(position[3]) !== unit) throw new TypeError(`${where('backgroundPosition')}: the tile offsets use two units: ${values.get('backgroundPosition')}`);
    const key = `${binding.target}:${binding.name}`;
    const group = groups.get(key) ?? { target: binding.target, name: binding.name, unit, width, leaves: [] };
    if (group.unit !== unit || group.width !== width) {
      throw new TypeError(`${where('background')}: ${binding.name} on node ${binding.target} has unit ${group.unit} and width ${group.width}, this leaf ${unit} and ${width}.`);
    }
    const x = Number(position[2]), y = Number(position[4]);
    group.leaves.push([index, x, y]);
    groups.set(key, group);
    // The leaf's prepared values are literal, at the tile the tree resolved it to.
    const literal = new Map(textureTileLeafStyles(group, x, y, initialTile(index, binding.name)));
    const ids = node.properties.filter(id => !(tree.properties[id]!.name in STYLE_NAMES));
    for (const [name, value] of literal) { properties.push({ name, value, custom: false }); ids.push(properties.length - 1); }
    const style = declarations(node.style).filter(part => !Object.values(STYLE_NAMES).includes(part.name)).map(part => `${part.text};`).join('');
    return { ...node, style, properties: ids };
  });
  // The tile variables leave their carriers; a carrier is a write's target, whose group keeps the tile as its initial.
  for (const carrier of carriers) if (!groups.has(carrier)) throw new TypeError(`${definition.id}: prepared node ${carrier.split(':')[0]} carries ${carrier.split(':')[1]}'s tile, but no tiled leaf binds it there.`);
  const stripped = nodes.map((node, index) => {
    const names = [...groups.values()].filter(group => group.target === index).flatMap(group => AXES.map(([axis]) => `${group.name}-${axis}`));
    if (!names.length) return node;
    for (const group of groups.values()) if (group.target === index && group.initial === undefined) {
      const values = AXES.map(([axis]) => own(index, `${group.name}-${axis}`));
      if (values.every(value => value !== undefined)) group.initial = { x: Number(values[0]), y: Number(values[1]), scale: Number(values[2]) };
      else if (values.some(value => value !== undefined)) throw new TypeError(`${definition.id}: prepared node ${index} carries part of ${group.name}'s tile.`);
    }
    if (declarations(node.style).some(part => names.includes(part.name))) throw new TypeError(`${definition.id}: prepared node ${index} writes a tile variable in its static style.`);
    return { ...node, properties: node.properties.filter(id => !names.includes(tree.properties[id]!.name)) };
  });
  const left = stripped.findIndex(node => reads(node.style) || node.properties.some(id => reads(properties[id]!.value)));
  if (left >= 0) throw new TypeError(`${definition.id}: prepared node ${left} keeps a texture tile variable.`);
  const tileLeaves = [...groups.values()].sort((a, b) => a.target - b.target || a.name.localeCompare(b.name, 'en', { numeric: true }))
    .map(({ target, name, unit, width, initial, leaves }) => ({ target, name, unit, width, ...initial ? { initial } : {}, leaves }));
  return { ...definition, tree: rebuildPropertyTable(tree, stripped, properties), textureLevels: { ...levels, tileLeaves } };
}

/** The records expanded back to the variable form the bindings measure (the inverse of withTextureTileRecords). */
export function withoutTextureTileRecords<D extends Definition>(definition: D): D {
  const levels = isRecord(definition.textureLevels) ? definition.textureLevels : undefined;
  if (!levels?.tileLeaves) return definition;
  const { tileLeaves, ...rest } = levels;
  requireTextureTileLeaves(tileLeaves, definition.variants);
  const properties = [...definition.tree.properties];
  const add = (property: Property) => { properties.push(property); return properties.length - 1; };
  const leafValues = new Map<number, number[]>(), carried = new Map<number, number[]>();
  for (const group of tileLeaves) {
    const page = group.name;
    for (const [node, x, y] of group.leaves) leafValues.set(node, [
      add({ name: 'backgroundPosition', value: `calc(${group.unit}px * var(${page}-x, 0) - ${x}px) calc(${group.unit}px * var(${page}-y, 0) - ${y}px)`, custom: false }),
      add({ name: 'backgroundSize', value: `calc(${group.width}px * var(${page}-scale, 1)) auto`, custom: false })]);
    if (group.initial) carried.set(group.target, [...carried.get(group.target) ?? [],
      ...textureTileVariables(page, group.initial).map(([name, value]) => add({ name, value, custom: true }))]);
  }
  const nodes = definition.tree.nodes.map((node, index) => {
    const values = leafValues.get(index), variables = carried.get(index);
    if (!values && !variables) return node;
    const kept = values ? node.properties.filter(id => !(definition.tree.properties[id]!.name in STYLE_NAMES)) : node.properties;
    return { ...node, properties: [...kept, ...variables ?? [], ...values ?? []] };
  });
  return { ...definition, tree: rebuildPropertyTable(definition.tree, nodes, properties), textureLevels: rest };
}
