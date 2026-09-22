import { initialObjectSelection, resolvePreparedAssetUrl, rewritePreparedStyleUrls } from '../../src/renderers/css/dist/index.js';
import type { ObjectRuntimeDefinition } from '../../src/renderers/css/runtime/object-runtime-types.js';

export interface PreparedSceneMarkup { html: string; classes: string[]; attributes: Record<string, string>; style: string; nodes: number; sha256?: string; }
const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cssName = (name: string) => name.startsWith('--') ? name : name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

/** CSS declarations can contain semicolons inside quoted URLs and functions. */
function declarations(text: string): Map<string, string> {
  const result = new Map<string, string>();
  let start = 0, depth = 0, quote = '', escaped = false;
  for (let i = 0; i <= text.length; i++) {
    const char = text[i];
    if (escaped) { escaped = false; continue; }
    if (char === '\\') { escaped = true; continue; }
    if (quote) { if (char === quote) quote = ''; continue; }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (i === text.length || char === ';' && depth === 0) {
      const part = text.slice(start, i), colon = part.indexOf(':');
      if (colon >= 0) result.set(part.slice(0, colon).trim(), part.slice(colon + 1).trim());
      start = i + 1;
    }
  }
  return result;
}
const styleText = (style: ReadonlyMap<string, string>) => [...style].map(([key, value]) => `${key}:${value}`).join(';');

/** Serialize the selected package's prepared reference view. No replacement mesh,
 * texture generation, camera inference or source processing belongs here. */
export function serializePreparedScene(definition: ObjectRuntimeDefinition, lensId?: string, settings?: unknown): PreparedSceneMarkup {
  const selection = initialObjectSelection(definition.controls, lensId, settings);
  const variant = definition.variants.find(entry => Object.entries(entry.when).every(([key, value]) => selection[key] === value));
  if (!variant) throw new TypeError(`${definition.id}: initial presentation is missing.`);
  const elements = definition.tree.nodes.map(node => ({
    tag: node.tag, classes: new Set(node.className?.split(/\s+/).filter(Boolean)),
    attributes: { ...node.attributes }, style: declarations(rewritePreparedStyleUrls(node.style, definition.assetOrigin)), children: [] as number[],
  }));
  const stage = { classes: new Set(definition.tree.stageClasses), attributes: {} as Record<string, string>, style: new Map<string, string>() };
  const roots: number[] = [];
  const target = (index: number) => index === -1 ? stage : elements[index];
  const write = (index: number, name: string, value: string) => {
    const style = target(index).style, property = cssName(name);
    if (value) style.set(property, value); else style.delete(property);
  };
  // This SSR markup reads `definition.assets` directly rather than through
  // `createPreparedResidency`'s chokepoint, so it resolves the same way here.
  const assets = new Map(definition.assets.entries.map(entry => [entry.key, resolvePreparedAssetUrl(entry.url, definition.assetOrigin)]));
  const texture = (key: string | null) => {
    if (key === null) return 'none';
    const url = assets.get(key);
    if (!url) throw new TypeError(`${definition.id}: initial texture ${key} has no prepared URL.`);
    return `url(${JSON.stringify(url)})`;
  };
  for (const [index, node] of definition.tree.nodes.entries()) {
    for (const id of node.properties) {
      const property = definition.tree.properties[id];
      write(index, property.name, rewritePreparedStyleUrls(property.value, definition.assetOrigin));
    }
    if (node.parent === -1) roots.push(index); else elements[node.parent].children.push(index);
  }
  // The base view uses the same initial prepared texture level as an interactive mount.
  const textureResources = definition.textureLevels?.levels[0]?.resources;
  for (const binding of variant.writes) {
    const element = target(binding.target);
    if (binding.kind === 'attribute') {
      if (binding.value === null) delete element.attributes[binding.name]; else element.attributes[binding.name] = binding.value;
    } else if (binding.kind === 'class') {
      if (binding.value) element.classes.add(binding.name); else element.classes.delete(binding.name);
    } else write(binding.target, binding.name, binding.kind === 'texture'
      ? texture(binding.resource === null ? null : textureResources?.[binding.resource] ?? binding.resource) : binding.value);
  }
  for (const selected of variant.materials) {
    const track = definition.materials.find(track => track.id === selected.track);
    const bank = track?.banks.find(bank => bank.id === selected.bank);
    if (!track || !bank) throw new TypeError(`${definition.id}: initial material is missing.`);
    if (!selected.enabled && selected.clearWhenHidden) { write(track.target, 'backgroundImage', 'none'); continue; }
    const address = selected.mode === 'fixed' ? bank.fixed : bank.default ?? bank.frames[selected.frameOverride ?? track.defaultFrame + (selected.frameOffset ?? 0)];
    if (address) {
      if (address.resource !== null) write(track.target, 'backgroundImage', texture(address.resource));
      write(track.target, 'backgroundPosition', address.backgroundPosition);
      write(track.target, 'backgroundSize', address.backgroundSize);
    }
  }
  // Keep the exact prepared orientation while the application clock is absent.
  for (const animation of [...definition.motion ?? [], ...definition.animations]) write(animation.target, 'animation', 'none');
  const serialize = (index: number): string => {
    const node = elements[index];
    const attributes = { ...node.attributes, 'data-prepared-node': String(index),
      ...(node.classes.size ? { class: [...node.classes].join(' ') } : {}),
      ...(node.style.size ? { style: styleText(node.style) } : {}) };
    return `<${node.tag}${Object.entries(attributes).map(([key, value]) => ` ${key}="${escape(value)}"`).join('')}>${node.children.map(serialize).join('')}</${node.tag}>`;
  };
  return { html: roots.map(serialize).join(''), classes: [...stage.classes], attributes: stage.attributes,
    style: styleText(stage.style), nodes: elements.length };
}
