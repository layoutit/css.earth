import { array, fail, integer, record, text, unique } from './guards.js';
import { nodeReference } from './resources-tree.js';
import type { PreparedTree } from '../rendering/prepared-presentation.js';
import { GEOGRAPHIC_LENS_CAPACITY, GEOGRAPHIC_OVERVIEW_IMAGE_CAPACITY } from '../paging/geographic-types.js';
export function requireRootEntity(value: unknown, lensIds: readonly string[], assetPath: string) {
  const root = record(value, 'root entity observations', ['id', 'lensIds', 'lenses']);
  text(root.id, 'root entity id');
  const ids = array(root.lensIds, 'root lens ids').map(id => text(id, 'root lens id'));
  const observations = array(root.lenses, 'root observations').map(input => record(input, 'observation'));
  unique(ids, 'root lens ids'); unique(observations.map(lens => lens.id), 'root observations');
  if (observations.length > GEOGRAPHIC_LENS_CAPACITY || ids.some(id => !lensIds.includes(id) && !observations.some(lens => lens.id === id)) ||
      observations.some(lens => !ids.includes(text(lens.id, 'observation id')))) fail('root observation references disagree');
  for (const lens of observations) {
    text(lens.label, 'observation label');
    const ref = record(lens.package, 'observation package');
    const url = text(ref.url, 'observation URL'), hash = text(ref.sha256, 'observation hash');
    if (!/^[a-f0-9]{64}$/u.test(hash) || !url.startsWith(assetPath) || url.includes('..') || url.includes('?') ||
        !url.endsWith(`-${hash.slice(0,16)}.json`) || integer(ref.bytes, 'observation bytes', 1) > 256 * 1024 ||
        !text(lens.thumbnailUrl, 'observation thumbnail').startsWith(assetPath)) fail('invalid root observation reference');
  }
}
export function requireObservationSurface(value: unknown, plan: Record<string, unknown>, tree: PreparedTree) {
  const surface = record(value, 'observation surface', ['slots']);
  const slots = array(surface.slots, 'observation slots').map(input => record(input, 'observation slot', ['id', 'bindings']));
  const layers = array(plan.pageLayers, 'page layers');
  if (!slots.length || slots.length > GEOGRAPHIC_OVERVIEW_IMAGE_CAPACITY || !layers.some(layer => record(layer, 'page layer').geographic === true)) fail('observation surface requires a bounded geographic layer');
  unique(slots.map(slot => text(slot.id, 'observation slot id')), 'observation slots');
  const seen = new Set<string>();
  const variants = array(plan.variants, 'variants');
  for (const slot of slots) {
    const bindings = array(slot.bindings, 'observation bindings');
    if (!bindings.length || bindings.length > 16) fail('observation bindings exceed capacity');
    for (const input of bindings) {
      const binding = record(input, 'observation binding', ['target', 'name']);
      const target = nodeReference(binding.target, tree), name = text(binding.name, 'observation property');
      const key = `${target}:${name}`;
      if (seen.has(key) || !/^--[a-z][a-z0-9-]*$/u.test(name) || !variants.some(variant =>
        array(record(variant, 'variant').writes, 'writes').some(input => {
          const write = record(input, 'write'); return write.kind === 'texture' && write.target === target && write.name === name;
        }))) fail('observation slots must reuse unique prepared surface textures');
      seen.add(key);
    }
  }
}
