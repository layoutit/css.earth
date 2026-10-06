import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';

const variableImage = /\bbackground(?:-image)?\s*:[^;]*var\(/iu, imageProperty = /^background(?:-image|Image)?$/u;
/** A custom property's name, as a record's key or value would carry it. */
const customName = /^--[a-zA-Z_]/u;
/** A declaration that sets a custom property, or a value that reads one. */
const customDeclaration = /(?:^|;)\s*--[a-zA-Z_][\w-]*\s*:/u, variableRead = /\bvar\(/u;

type Shipped = Pick<ObjectRuntimeDefinition, 'id' | 'tree' | 'variants'> &
  Partial<Pick<ObjectRuntimeDefinition, 'viewBindings' | 'materials' | 'animations' | 'motion' | 'textureLevels' | 'depthPartitions'>>;

/** A prepared runtime as it ships names no CSS custom property and reads none:
 * - no node style or tree property sets one or reads one through `var()`;
 * - a texture write names a slot that lists its elements, or its own target's `backgroundImage`;
 * - no selection write, view binding, material, animation, texture level or depth partition names one, as a value or a key.
 * The bake's working form does name custom properties, until its last steps turn them into records
 * (packages/bake/src/presentation/records/*-records.ts), and it passes the runtime parser at several stages; this is checked
 * where a runtime is pinned and where the page decodes one. */
export function requireShippedRuntime(definition: Shipped): void {
  const fail = (reason: string): never => { throw new TypeError(`${definition.id}: prepared runtime ${reason}.`); };
  const { tree } = definition, slots = new Set<string>();
  for (const [index, node] of tree.nodes.entries()) {
    if (variableImage.test(node.style)) fail(`node ${index} reads its image from a custom property: ${node.style}`);
    if (customDeclaration.test(node.style) || variableRead.test(node.style)) fail(`node ${index} sets or reads a custom property: ${node.style}`);
  }
  for (const property of tree.properties) {
    if (property.name.startsWith('--')) fail(`tree sets the custom property ${property.name}: ${property.value}`);
    if (imageProperty.test(property.name) && property.value.includes('var(')) fail(`property ${property.name} reads its image from a custom property: ${property.value}`);
    if (variableRead.test(property.value)) fail(`property ${property.name} reads a custom property: ${property.value}`);
  }
  for (const slot of tree.textureBindings ?? []) {
    if (slot.name.startsWith('--')) fail(`texture slot ${slot.name} on node ${slot.target} names a custom property`);
    slots.add(`${slot.target}:${slot.name}`);
  }
  for (const variant of definition.variants) for (const write of variant.writes) {
    if (write.kind === 'texture' && write.name !== 'backgroundImage' && !slots.has(`${write.target}:${write.name}`)) fail(`texture write ${write.name} on node ${write.target} names no texture slot`);
    if (customName.test(write.name)) fail(`${write.kind} write ${write.name} on node ${write.target} names a custom property`);
    if (write.kind === 'style' && variableRead.test(write.value)) fail(`style write ${write.name} on node ${write.target} reads a custom property: ${write.value}`);
  }
  // Everything else the page reads to draw: no key and no value names or reads a custom property.
  const scan = (value: unknown, trail: string): void => {
    if (typeof value === 'string') { if (customName.test(value) || variableRead.test(value)) fail(`${trail} names or reads a custom property: ${value.slice(0, 120)}`); return; }
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { for (const [index, child] of value.entries()) scan(child, `${trail}[${index}]`); return; }
    for (const [key, child] of Object.entries(value)) {
      if (customName.test(key)) fail(`${trail} has the key ${key}, a custom property's name`);
      scan(child, `${trail}.${key}`);
    }
  };
  for (const part of ['viewBindings', 'materials', 'animations', 'motion', 'textureLevels', 'depthPartitions'] as const) scan(definition[part], part);
}
