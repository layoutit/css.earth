import { array, attribute, boolean, choice, fail, finite, integer, record, text, unique } from './guards.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
import type { PreparedTree, PreparedWrite } from '../rendering/prepared-presentation.js';

export function requireAssets(value: unknown): asserts value is PreparedAssets {
  const assets = record(value, 'resources'), poolIds: string[] = [], resourceIds: string[] = [];
  for (const input of array(assets.pools, 'resource pools')) {
    const pool = record(input, 'resource pool');
    poolIds.push(text(pool.id, 'pool id'));
    const capacity = integer(pool.capacity, 'pool capacity', 1), concurrency = integer(pool.concurrency, 'pool concurrency', 1);
    if (concurrency > capacity) fail('resource concurrency exceeds capacity');
    choice(pool.retention, ['selection', 'mount', 'warm'], 'pool retention'); boolean(pool.reuse, 'pool reuse');
    if (pool.decoding !== undefined) choice(pool.decoding, ['auto', 'sync', 'async'], 'pool decoding');
    if (pool.eviction !== undefined) choice(pool.eviction, ['unused', 'capacity'], 'pool eviction');
    if (pool.stabilityMilliseconds !== undefined && finite(pool.stabilityMilliseconds, 'resource stability') < 0) fail('resource stability must be nonnegative');
    if (pool.maximumDecodedBytes !== undefined) integer(pool.maximumDecodedBytes, 'decoded byte budget', 1);
  }
  unique(poolIds, 'resource pools');
  for (const input of array(assets.entries, 'resource entries')) {
    const entry = record(input, 'resource entry'); resourceIds.push(text(entry.key, 'resource key'));
    if (!text(entry.url, 'resource URL').startsWith('/scenes/') || !poolIds.includes(text(entry.pool, 'resource pool'))) fail('resource identity is invalid');
    const pool = (assets.pools as PreparedAssets['pools']).find(pool => pool.id === entry.pool)!;
    if (entry.decodedBytes !== undefined || pool.maximumDecodedBytes !== undefined) {
      const bytes = integer(entry.decodedBytes, 'decoded image bytes', 1);
      if (pool.maximumDecodedBytes !== undefined && bytes > pool.maximumDecodedBytes) fail('image exceeds decoded byte budget');
    }
  }
  unique(resourceIds, 'resource identities');
  resourceList(assets.startup, new Set(resourceIds), 'startup resources');
  if (assets.fallbacks !== undefined) for (const input of array(assets.fallbacks, 'resource fallbacks')) {
    const fallback = record(input, 'resource fallback', ['unsupported', 'resources']);
    choice(fallback.unsupported, ['corner-shape'], 'fallback capability');
    const pairs = Object.entries(record(fallback.resources, 'fallback resources'));
    if (!pairs.length) fail('a resource fallback replaces nothing');
    for (const [key, replacement] of pairs) { resource(key, new Set(resourceIds)); resource(replacement, new Set(resourceIds)); }
  }
}
export function resource(value: unknown, resources: ReadonlySet<string>, nullable = false): void {
  if (nullable && value === null) return;
  if (!resources.has(text(value, 'resource key'))) fail(`undeclared resource ${String(value)}`);
}
export function resourceList(value: unknown, resources: ReadonlySet<string>, label: string): void {
  const keys = array(value, label); keys.forEach(key => resource(key, resources)); unique(keys, label);
}
export function nodeReference(value: unknown, tree: PreparedTree, stage = false): number {
  const id = integer(value, 'node reference', stage ? -1 : 0);
  if (id >= tree.nodes.length) fail(`undeclared node ${id}`); return id;
}
export function ancestor(child: number, parent: number, tree: PreparedTree): boolean {
  for (let id = tree.nodes[child]?.parent; id >= 0; id = tree.nodes[id].parent) if (id === parent) return true;
  return false;
}
const unsupportedStyle = /\b(?:clip-path|mask(?:-\w+)?|filter|mix-blend-mode|background-blend-mode)\s*:|(?:linear|radial|conic)-gradient\s*\(/i;
export function requireTree(value: unknown): asserts value is PreparedTree {
  const tree = record(value, 'tree', ['nodes', 'properties', 'camera', 'scene', 'stageClasses', 'activationGroups']);
  const properties = array(tree.properties, 'prepared style properties');
  for (const input of properties) {
    const property = record(input, 'prepared property', ['name', 'value', 'custom']);
    const name = text(property.name, 'property name'), content = text(property.value, 'property value', true);
    boolean(property.custom, 'custom property');
    if (/^(?:clipPath|mask.*|filter|mixBlendMode|backgroundBlendMode)$/.test(name) || /(?:linear|radial|conic)-gradient\s*\(/i.test(content)) fail('unsupported scene property');
  }
  const nodes = array(tree.nodes, 'nodes');
  if (!nodes.length) fail('retained tree is empty');
  let cameraCount = 0, sceneCount = 0;
  const parents: number[] = [], classes: string[] = [];
  for (const [index, input] of nodes.entries()) {
    const entry = record(input, 'node', ['parent', 'tag', 'className', 'style', 'properties', 'attributes']);
    const parent = integer(entry.parent, 'node parent', -1);
    if (parent >= index) fail('node parents must precede children'); parents.push(parent);
    choice(entry.tag, ['div', 'span', 's', 'b', 'u'], 'retained tag');
    const className = entry.className === null ? '' : text(entry.className, 'node class', true);
    classes.push(className);
    cameraCount += Number(/(?:^|\s)polycss-camera(?:\s|$)/.test(className));
    sceneCount += Number(/(?:^|\s)polycss-scene(?:\s|$)/.test(className));
    const style = text(entry.style, 'node style', true), references = array(entry.properties, 'node property references');
    if (unsupportedStyle.test(style)) fail('unsupported scene style');
    for (const property of references) if (integer(property, 'property reference') >= properties.length) fail('undeclared prepared property');
    for (const [name, content] of Object.entries(record(entry.attributes, 'node attributes'))) {
      if (name === 'style' && content === '' && style === '' && !references.length) continue;
      attribute(name); text(content, 'attribute value', true);
    }
  }
  const camera = integer(tree.camera, 'camera node'), scene = integer(tree.scene, 'scene node');
  if (camera >= nodes.length || scene >= nodes.length || parents[camera] !== -1) fail('camera/scene reference is invalid');
  let owned = false;
  for (let id = parents[scene]; id >= 0; id = parents[id]) if (id === camera) owned = true;
  if (!owned || cameraCount !== 1 || sceneCount !== 1 || !/(?:^|\s)polycss-camera(?:\s|$)/.test(classes[camera]) ||
      !/(?:^|\s)polycss-scene(?:\s|$)/.test(classes[scene])) fail('one camera root must own the unique scene');
  array(tree.stageClasses, 'stage classes').forEach(item => text(item, 'stage class'));
  if (tree.activationGroups !== undefined) {
    const containers = new Set(parents), activated = new Set<number>();
    for (const input of array(tree.activationGroups, 'activation groups')) {
      const group = array(input, 'activation group');
      if (!group.length || group.length > 64) fail('activation group must contain 1 to 64 leaves');
      for (const input of group) {
        const target = integer(input, 'activation target');
        if (target >= nodes.length || containers.has(target) || target === camera || target === scene || activated.has(target)) fail('activation target must be a unique retained leaf');
        activated.add(target);
      }
    }
  }
}
export function requireWrite(value: unknown, tree: PreparedTree, resources: ReadonlySet<string>): asserts value is PreparedWrite {
  const binding = record(value, 'selection binding', ['kind', 'target', 'name', 'value', 'resource', 'quoted']);
  const target = nodeReference(binding.target, tree, true), name = text(binding.name, 'binding name');
  const kind = choice(binding.kind, ['style', 'texture', 'attribute', 'class'], 'selection binding');
  if (kind === 'texture') { resource(binding.resource, resources, true); boolean(binding.quoted, 'texture quote mode'); }
  else if (kind === 'class') boolean(binding.value, 'class binding');
  else if (kind === 'attribute') { attribute(name); if (binding.value !== null) text(binding.value, 'attribute binding', true); }
  else if (typeof binding.value !== 'string' || /^(?:transform|scale|rotate|perspective)$/.test(name)) fail('selection style cannot own camera or pose publication');
  if (target === tree.camera || target === tree.scene) fail('selection bindings cannot write camera/scene state');
}
