import { initialObjectSelection, loadPreparedCssObject } from '../src/renderers/css/dist/index.js';
import { readPreparedObjectBytes } from './object-page-data.mts';
import { isRecord } from '@cssearth/core';

/** Build-only. A page's first mount adopts its server markup (`serialize-prepared-scene.mts`), which already carries every
 * node the initial selection shows, styled. Their records here keep what adoption checks (tag, parent, class and
 * attributes) and drop their styles and property references; the property table keeps only what remaining records
 * use. Records the initial selection hides (`hiddenSubtrees`) stay whole: the runtime builds those nodes. In-app
 * navigation, which has no server markup, reads the complete `object.json`. */
export async function firstViewTransport(id: string) {
  const { descriptor, bytes } = await readPreparedObjectBytes(id);
  const definition = await loadPreparedCssObject(descriptor, { async read() { return Uint8Array.from(bytes).buffer; } });
  const selection = initialObjectSelection(definition.controls);
  const variant = definition.variants.find(entry => Object.entries(entry.when).every(([key, value]) => selection[key] === value));
  if (!variant) throw new TypeError(`${id}: initial presentation is missing.`);
  const document: unknown = JSON.parse(new TextDecoder().decode(bytes));
  const data = isRecord(document) && isRecord(document.data) ? document.data : null, tree = data && isRecord(data.tree) ? data.tree : null;
  const table: unknown = tree?.properties;
  if (!isRecord(document) || !data || !tree || !Array.isArray(tree.nodes) || !Array.isArray(table) || tree.nodes.length !== definition.tree.nodes.length)
    throw new TypeError(`${id}: prepared tree transport differs from its definition.`);
  const hidden = new Set(variant.hiddenSubtrees ?? []), built = new Set<number>();
  definition.tree.nodes.forEach((node, index) => { if (hidden.has(node.parent) || built.has(node.parent)) built.add(index); });
  const remap = new Map<number, number>(), properties: unknown[] = [];
  const nodes = definition.tree.nodes.map((node, index) => {
    if (!built.has(index)) return { ...node, style: '', properties: [] };
    return { ...node, properties: node.properties.map(id => {
      if (!remap.has(id)) { remap.set(id, properties.length); properties.push(table[id]); }
      return remap.get(id)!;
    }) };
  });
  return JSON.stringify({ ...document, data: { ...data, tree: { ...tree, nodes, properties } } });
}
