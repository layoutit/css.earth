import { rebuildPropertyTable } from './property-table.ts';
import { isRecord } from '@cssearth/core';
import { scanCssDeclarations } from './css-declaration-scanner.ts';

// Selected images as prepared records (the last step of the presentation bindings, prepared-presentation-bindings.ts).
//
// The node builder names each selected image as a custom property: an element that draws it reads
// `background-image:var(--<slot>)`, a texture write sets `--<slot>` on a carrier above it, and the carrier may hold the
// slot's first image as a property. The bindings resolve that form in a browser (prepared-texture-bindings.ts). What
// ships names no custom property:
// - a slot lists the elements that draw it under its plain name, and a write names the slot;
// - each listed element holds the slot's first image as its own `background-image` and reads no variable;
// - an image a container draws itself is a write of that container's `backgroundImage`;
// - a write whose elements a depth partition moved to its carriers keeps its slot, which lists none: the bindings
//   restore the source branch from that write (prepared-depth-partitions.ts).
// The page writes `background-image` on each listed element, and its served markup does the same
// (packages/renderer/src/rendering/prepared-presentation.ts, prepared-scene-serialization.ts). A later bindings run
// expands the records back to the variable form first.

interface Property { name: string; value: string; custom: boolean }
interface TreeNode { parent: number; style: string; properties: readonly number[] }
interface Slot { target: number; name: string; leaves: readonly number[] }
interface Tree { nodes: readonly TreeNode[]; properties: readonly Property[]; textureBindings?: readonly Slot[] }
interface Write { kind: string; target: number; name: string }
interface Definition { id: string; tree: Tree; textureLevels?: unknown; variants: readonly { writes: readonly Write[] }[] }
/** A container that draws a texture write's image itself, as the bindings' browser found it. */
export interface TextureContainer { target: number; name: string; node: number }

const IMAGE = 'backgroundImage';
const variable = (name: string) => name.startsWith('--');
const imageProperty = (property: Property) => !property.custom && (property.name === IMAGE || property.name === 'background-image');
const key = (entry: { target: number; name: string }) => `${entry.target}:${entry.name}`;
/** An element's read of its slot, as the expansion writes it at the head of the static style. */
const tag = (name: string) => `background-image:var(${name});`;
const declarations = (style: string) => [...scanCssDeclarations(style)].map(text => {
  const colon = text.indexOf(':');
  return { name: text.slice(0, colon).trim().toLowerCase(), value: text.slice(colon + 1).trim(), text };
});
/** The texture levels name a write in two places: each tile leaf group, and each page's placement. */
const levelNames = (definition: Definition, name: (from: string) => string): Pick<Definition, 'textureLevels'> => {
  const levels = definition.textureLevels;
  if (!isRecord(levels)) return {};
  const groups = Array.isArray(levels.tileLeaves)
    ? { tileLeaves: levels.tileLeaves.map((group: unknown) => isRecord(group) && typeof group.name === 'string' ? { ...group, name: name(group.name) } : group) } : {};
  const placed = isRecord(levels.placements) && isRecord(levels.placements.writes)
    ? { placements: { ...levels.placements, writes: Object.fromEntries(Object.entries(levels.placements.writes).map(([write, placement]) => [name(write), placement])) } } : {};
  return { textureLevels: { ...levels, ...groups, ...placed } };
};

/** The variable form's selected images as records; every image variable leaves the tree and the writes. */
export function withTextureImageRecords<D extends Definition>(definition: D, containers: readonly TextureContainer[] = []): D {
  const { tree } = definition, slots = tree.textureBindings ?? [];
  const written = definition.variants.flatMap(variant => variant.writes.filter(write => write.kind === 'texture' && variable(write.name)));
  // Nothing names a variable: a body without selected images, or one already in record form.
  if (!written.length && !slots.some(slot => variable(slot.name))) return definition;
  const names = new Set([...written, ...slots].map(entry => entry.name).filter(variable));
  const slotOf = new Map<number, Slot>();
  for (const slot of slots) if (variable(slot.name)) for (const leaf of slot.leaves) slotOf.set(leaf, slot);
  const own = (node: number, name: string) => {
    const id = tree.nodes[node]!.properties.findLast(at => tree.properties[at]!.custom && tree.properties[at]!.name === name);
    return id === undefined ? undefined : tree.properties[id]!.value;
  };
  // The image an element's variable resolves to in the prepared tree: the nearest carrier's.
  const first = (element: number, name: string) => {
    for (let cursor = element; cursor >= 0; cursor = tree.nodes[cursor]!.parent) { const value = own(cursor, name); if (value !== undefined) return value; }
    return undefined;
  };
  const properties = [...tree.properties];
  const nodes = tree.nodes.map((node, index) => {
    const slot = slotOf.get(index);
    let ids = node.properties.filter(id => !(tree.properties[id]!.custom && names.has(tree.properties[id]!.name)));
    let style = node.style;
    if (slot) {
      const reads = `var(${slot.name})`;
      ids = ids.filter(id => !(imageProperty(tree.properties[id]!) && tree.properties[id]!.value === reads));
      // The expansion writes the read first, so the rest of the style returns byte for byte; a builder's sits anywhere.
      if (style.startsWith(tag(slot.name))) style = style.slice(tag(slot.name).length);
      else {
        const parts = declarations(style), kept = parts.filter(part => !(part.name === 'background-image' && part.value === reads));
        if (kept.length !== parts.length) style = kept.map(part => `${part.text};`).join('');
      }
      const image = first(index, slot.name);
      if (image !== undefined) { properties.push({ name: IMAGE, value: image, custom: false }); ids.push(properties.length - 1); }
    }
    return style === node.style && ids.length === node.properties.length && ids.every((id, at) => id === node.properties[at]) ? node : { ...node, style, properties: ids };
  });
  const touched = properties.length !== tree.properties.length || nodes.some((node, index) => node.properties.length !== tree.nodes[index]!.properties.length);
  const left = nodes.findIndex(node => [node.style, ...node.properties.map(id => properties[id]!.value)].some(text => [...names].some(name => text.includes(`var(${name})`) || text.includes(`var(${name},`))));
  if (left >= 0) throw new TypeError(`${definition.id}: prepared node ${left} reads a selected image's variable, but no texture slot lists it: ${nodes[left]!.style}`);
  const bound = new Set(slots.map(key)), drawn = new Map<string, number[]>();
  for (const container of containers) drawn.set(key(container), [...drawn.get(key(container)) ?? [], container.node]);
  // A write nothing draws here keeps an empty slot, in the order the variants first name it.
  const empty = new Map<string, Slot>();
  for (const write of written) if (!bound.has(key(write)) && !drawn.has(key(write))) empty.set(key(write), { target: write.target, name: write.name, leaves: [] });
  const plain = (name: string) => variable(name) ? name.slice(2) : name;
  return { ...definition, ...levelNames(definition, plain),
    // A table nothing was added to or dropped from stays as it is: the depth restore reads the camera's last entry by position.
    tree: { ...(touched ? rebuildPropertyTable(tree, nodes, properties) : { ...tree, nodes }), textureBindings: [...slots, ...empty.values()].map(slot => ({ ...slot, name: plain(slot.name) })) },
    variants: definition.variants.map(variant => ({ ...variant, writes: variant.writes.flatMap(write => {
      if (write.kind !== 'texture' || !variable(write.name)) return [write];
      const nodes = bound.has(key(write)) ? undefined : drawn.get(key(write));
      return nodes ? nodes.map(node => ({ ...write, target: node, name: IMAGE })) : [{ ...write, name: plain(write.name) }];
    }) })) };
}

/** The records expanded back to the variable form the bindings measure (the inverse of withTextureImageRecords). Each
 * listed element reads its slot at the head of its static style; the property table changes only where a slot's first
 * image returns to its carrier, so a depth partition's camera property stays the last entry its restore reads. */
export function withoutTextureImageRecords<D extends Definition>(definition: D): D {
  const { tree } = definition, slots = (tree.textureBindings ?? []).filter(slot => !variable(slot.name));
  if (!slots.length) return definition;
  const named = new Set(slots.map(key)), properties = [...tree.properties];
  const reads = new Map<number, string>(), carried = new Map<number, number[]>();
  for (const slot of slots) {
    const name = `--${slot.name}`, images = new Set<string | undefined>();
    for (const leaf of slot.leaves) {
      const id = tree.nodes[leaf]!.properties.findLast(at => imageProperty(tree.properties[at]!));
      images.add(id === undefined ? undefined : tree.properties[id]!.value);
      reads.set(leaf, name);
    }
    if (images.size > 1) throw new TypeError(`${definition.id}: texture slot ${slot.name} on node ${slot.target} has elements with different first images: ${[...images].join(', ')}`);
    const [image] = images;
    if (image !== undefined) { properties.push({ name, value: image, custom: true }); carried.set(slot.target, [...carried.get(slot.target) ?? [], properties.length - 1]); }
  }
  const nodes = tree.nodes.map((node, index) => {
    const read = reads.get(index), carry = carried.get(index);
    if (read === undefined && !carry) return node;
    const kept = read === undefined ? node.properties : node.properties.filter(id => !imageProperty(tree.properties[id]!));
    return { ...node, ...(read === undefined ? {} : { style: tag(read) + node.style }), properties: carry ? [...kept, ...carry] : kept };
  });
  const custom = (entry: { target: number; name: string }) => named.has(key(entry)) ? `--${entry.name}` : entry.name;
  const groups = new Map(slots.map(slot => [slot.name, `--${slot.name}`]));
  return { ...definition, ...levelNames(definition, name => groups.get(name) ?? name),
    tree: { ...(carried.size ? rebuildPropertyTable(tree, nodes, properties) : { ...tree, nodes }), textureBindings: (tree.textureBindings ?? []).map(slot => ({ ...slot, name: custom(slot) })) },
    variants: definition.variants.map(variant => ({ ...variant, writes: variant.writes.map(write => write.kind === 'texture' ? { ...write, name: custom(write) } : write) })) };
}
