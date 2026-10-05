import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';

const variableImage = /\bbackground(?:-image)?\s*:[^;]*var\(/iu, imageProperty = /^background(?:-image|Image)?$/u;

/** A prepared runtime as it ships: its tree sets no custom property, no element reads its image from one, and a texture
 * write names a slot that lists its elements, or its own target's `backgroundImage`. The bake's working form does name
 * custom properties, until its last steps turn them into records (packages/bake/src/presentation/*-records.ts), and it
 * passes the runtime parser at several stages; this is checked where a runtime is pinned and where the page decodes one. */
export function requireShippedRuntime(definition: Pick<ObjectRuntimeDefinition, 'id' | 'tree' | 'variants'>): void {
  const fail = (reason: string): never => { throw new TypeError(`${definition.id}: prepared runtime ${reason}.`); };
  const { tree } = definition, slots = new Set<string>();
  for (const [index, node] of tree.nodes.entries()) if (variableImage.test(node.style)) fail(`node ${index} reads its image from a custom property: ${node.style}`);
  for (const property of tree.properties) {
    if (property.name.startsWith('--')) fail(`tree sets the custom property ${property.name}: ${property.value}`);
    if (imageProperty.test(property.name) && property.value.includes('var(')) fail(`property ${property.name} reads its image from a custom property: ${property.value}`);
  }
  for (const slot of tree.textureBindings ?? []) {
    if (slot.name.startsWith('--')) fail(`texture slot ${slot.name} on node ${slot.target} names a custom property`);
    slots.add(`${slot.target}:${slot.name}`);
  }
  for (const variant of definition.variants) for (const write of variant.writes) {
    if (write.kind === 'texture' && write.name !== 'backgroundImage' && !slots.has(`${write.target}:${write.name}`)) fail(`texture write ${write.name} on node ${write.target} names no texture slot`);
  }
}
