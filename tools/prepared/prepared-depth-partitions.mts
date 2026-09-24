import type { PreparedDepthOrder } from '../../src/renderers/css/rendering/prepared-depth-partitions.ts';
import type { PreparedPresentationDefinition, PreparedTree } from '../../src/renderers/css/rendering/prepared-presentation.ts';
import type { SurfaceTriangle } from '../../src/renderers/css/navigation/prepared-surface-hit.ts';

export interface DepthSurface { target: number; leaves: number[]; frontSigns?: number[]; bodyFromScene: number[]; }
export type PresentationSource = PreparedPresentationDefinition & { id: string };
type TreeNode = PreparedTree['nodes'][number];
type RecompiledFields='tree'|'variants'|'materials'|'animations'|'viewBindings'|'facing'|'motion'|'surfaceHit'|'depthPartitions';
export type RecompiledPresentation<T extends PreparedPresentationDefinition> = Omit<T, RecompiledFields> & Pick<PreparedPresentationDefinition,RecompiledFields>;

import { prepareActivationGroups } from './prepared-activation-groups.mts';
import { visibilityComponents } from './prepared-visibility-order.mts';
import { dot3 as dot } from '@cssearth/core';

const MAXIMUM_DEPTH_LEAVES = 64;

/** Recover the unchanged authoring topology before recompilation. The original
 * branch and every original leaf survive in the transport; only generated
 * carrier ancestors and their copied selection bindings are removed. This is
 * preparation code, never shipped in the browser. */
export function restoreDepthSource<T extends PreparedPresentationDefinition>(definition: T): RecompiledPresentation<T> {
  if (!definition.depthPartitions) return definition;
  if (!definition.surfaceHit) throw new TypeError('Depth source requires its source surface.');
  const { depthPartitions, ...source } = definition;
  const surfaceHit = definition.surfaceHit;
  const { nodes, camera, scene, properties } = source.tree;
  const chain = [];
  for (let id = surfaceHit.target; id !== camera; id = nodes[id].parent) {
    if (id < 0) throw new TypeError('Depth source branch is detached.');
    chain.unshift(id);
  }
  const removed = new Set<number>(), bodyParents = new Set<number>();
  for (const group of depthPartitions.groups) {
    let parent = group.root; removed.add(parent);
    for (let level = 0; level < chain.length; level++) {
      const child = nodes.findIndex(node => node.parent === parent);
      if (child < 0 || level === 0 && child !== group.scene) throw new TypeError('Depth carrier ancestry is inconsistent.');
      removed.add(child); parent = child;
    }
    bodyParents.add(parent);
  }
  const flat = properties.length - 1;
  if (nodes[camera].properties.at(-1) !== flat || properties[flat].name !== 'transformStyle' ||
      properties[flat].value !== 'flat' || properties[flat].custom !== false) throw new TypeError('Depth camera source assignment is inconsistent.');
  const remapping = new Map([[-1, -1]]);
  for (let id = 0; id < nodes.length; id++) if (!removed.has(id)) remapping.set(id, remapping.size - 1);
  const remap = (id: number) => {
    if (!remapping.has(id)) throw new TypeError('A generated depth carrier acquired another owner.');
    return remapping.get(id)!;
  };
  const target = <T extends { target: number },>(binding: T) => ({ ...binding, target: remap(binding.target) });
  const restored = { ...source,
    tree: { ...source.tree, camera: remap(camera), scene: remap(scene), properties: properties.slice(0, -1),
      nodes: nodes.flatMap((node, id) => removed.has(id) ? [] : [{ ...node,
        parent: remap(bodyParents.has(node.parent) ? surfaceHit.target : node.parent),
        properties: id === camera ? node.properties.slice(0, -1) : node.properties }]),
      activationGroups: [] as number[][] },
    variants: source.variants.map(variant => ({ ...variant, writes: variant.writes.filter(binding => !removed.has(binding.target)).map(target) })),
    materials: source.materials.map(target), viewBindings: source.viewBindings.map(target), animations: source.animations.map(target),
    ...(source.motion ? { motion: source.motion.map(target) } : {}),
    ...(source.facing ? { facing: source.facing.map(target) } : {}),
    surfaceHit: { ...surfaceHit, target: remap(surfaceHit.target) },
  };
  restored.tree.activationGroups = prepareActivationGroups(restored);
  // The reconstruction above checks all presentation fields. The spread retains
  // T's metadata fields; TypeScript cannot express that relationship after Omit.
  return restored as unknown as RecompiledPresentation<T>;
}

/** Preparation only. Source-edge separating planes and fixed visibility
 * priorities compose one painter program. A crossing face rejects that plane;
 * a visibility cycle stays native. Neither path cuts or changes a source face.
 * Sixty-four is a packing target, not a claim about irreducible cycle sizes. */
export function partitionSurface(triangles: readonly SurfaceTriangle[], maximumLeaves = MAXIMUM_DEPTH_LEAVES, frontSigns?: readonly number[]) {
  const normals = new Map<string, number[]>();
  for (const points of triangles) for (let edge = 0; edge < points.length; edge++) {
    const a = points[edge], b = points[(edge + 1) % points.length];
    let normal = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const length = Math.hypot(...normal);
    if (length < 1e-8) continue;
    normal = normal.map(value => value / length);
    if ((normal.find(value => Math.abs(value) > 1e-8) ?? 0) < 0) normal = normal.map(value => -value);
    normals.set(normal.map(value => value.toFixed(7)).join(','), normal);
  }
  const candidates = [...normals.values()].map(normal => ({ normal, sides: triangles.map(points => {
    const distances = points.map(point => dot(point, normal));
    const low = Math.min(...distances), high = Math.max(...distances);
    return low < -1e-5 && high > 1e-5 ? 2 : low + high >= 0 ? 1 : -1;
  }) }));
  const groups: number[][] = [];
  function leaf(ids: number[]): PreparedDepthOrder { const group = groups.length; groups.push(ids.sort((a, b) => a - b)); return { group }; }
  function visit(ids: number[]): PreparedDepthOrder {
    let best: { candidate: typeof candidates[number]; score: number } | null = null;
    if (ids.length > maximumLeaves) for (const candidate of candidates) {
      let front = 0, back = 0;
      for (const id of ids) {
        const side = candidate.sides[id];
        if (side === 2) { front = -1; break; }
        if (side === 1) front++; else back++;
      }
      if (front <= 0 || back <= 0) continue;
      const score = Math.max(front, back);
      if (!best || score < best.score) best = { candidate, score };
    }
    if (!best) {
      if (!frontSigns || ids.length <= maximumLeaves) return leaf(ids);
      const components = visibilityComponents(ids.map(id => triangles[id]), ids.map(id => frontSigns[id]));
      if (components.length === 1) return leaf(ids);
      const sequence: PreparedDepthOrder[] = []; let pending: number[] = [];
      const flush = () => { if (pending.length) sequence.push(leaf(pending)); pending = []; };
      for (const component of components) {
        const members = component.map(index => ids[index]);
        if (pending.length + members.length > maximumLeaves) flush();
        if (members.length > maximumLeaves) sequence.push(visit(members));
        else pending.push(...members);
      }
      flush();
      return sequence.length === 1 ? sequence[0] : { sequence };
    }
    const { normal, sides } = best.candidate;
    return { plane: [normal[0], normal[1], normal[2], 0], back: visit(ids.filter(id => sides[id] === -1)), front: visit(ids.filter(id => sides[id] === 1)) };
  }
  return { order: visit(triangles.map((_, index) => index)), groups };
}

/** Emit the final retained DOM during preparation. All source leaves occur
 * once, and all node references are remapped together. Projected carriers share
 * the existing camera; selection writes retain their atomic resource owner. */
export function prepareDepthPartitions<T extends PreparedPresentationDefinition>(definition: T, surface: DepthSurface | null): RecompiledPresentation<T> {
  if (!surface) return definition;
  if (!definition.surfaceHit) throw new TypeError('Depth partitions require a source surface.');
  const { groups, order } = partitionSurface(definition.surfaceHit.triangles, MAXIMUM_DEPTH_LEAVES, surface.frontSigns);
  // Inseparable visibility cycles retain native depth. The preparation budget
  // limits carriers, never deletes faces or pretends a cyclic core is bounded.
  if (groups.length < 2 || groups.length > 128 || !surface.frontSigns && groups.some(group => group.length > MAXIMUM_DEPTH_LEAVES)) return definition;
  const { nodes: original, camera, scene } = definition.tree;
  const chain = [];
  for (let id = surface.target; id !== camera; id = original[id].parent) chain.unshift(id);
  const insertion = Math.min(...surface.leaves), extra = groups.length * (chain.length + 1);
  const remap = (id: number) => id < insertion ? id : id + extra;
  const nodes = original.map(node => ({ ...node, parent: remap(node.parent) }));
  const added: TreeNode[] = [], clones = new Map(chain.map(id => [id, [] as number[]])), partitions: {root: number; scene: number}[] = [];
  const append = (record: TreeNode) => { const id = insertion + added.length; added.push(record); return id; };
  for (const members of groups) {
    const root = append({ tag: 'div', parent: remap(camera), className: null, properties: [], attributes: {},
      style: 'position:absolute;inset:0;transform-style:flat;perspective:inherit;perspective-origin:inherit;pointer-events:none;contain:paint' });
    let parent = root, projectedScene: number | undefined;
    for (const source of chain) {
      const record = original[source];
      const id = append({ ...record, parent, className: record.className?.split(/\s+/).filter(name => name !== 'polycss-scene').join(' ') ?? null });
      clones.get(source)!.push(id); parent = id;
      if (source === scene) projectedScene = id;
    }
    for (const member of members) nodes[surface.leaves[member]].parent = parent;
    if (projectedScene === undefined) throw new TypeError('Depth surface does not descend from its scene.');
    partitions.push({ root, scene: projectedScene });
  }
  nodes.splice(insertion, 0, ...added);
  const properties = [...definition.tree.properties, { name: 'transformStyle', value: 'flat', custom: false }];
  nodes[remap(camera)].properties = [...nodes[remap(camera)].properties, properties.length - 1];
  // The separating planes are transported in the same raw scene coordinates
  // as the shared camera and facing publisher. No runtime matrix discovery.
  const inverse = surface.bodyFromScene;
  function transformOrder(node: PreparedDepthOrder): PreparedDepthOrder {
    if ('group' in node) return node;
    if ('sequence' in node) return { sequence: node.sequence.map(transformOrder) };
    const plane = [0, 1, 2, 3].map(column => node.plane.reduce((sum, value, row) => sum + value * inverse[column * 4 + row], 0));
    const length = Math.hypot(...plane.slice(0, 3));
    return { plane: [plane[0] / length, plane[1] / length, plane[2] / length, plane[3] / length], back: transformOrder(node.back), front: transformOrder(node.front) };
  }
  const target = <T extends { target: number },>(binding: T) => ({ ...binding, target: remap(binding.target) });
  return { ...definition,
    tree: { ...definition.tree, nodes, properties, camera: remap(camera), scene: remap(scene) },
    depthPartitions: { groups: partitions, order: transformOrder(order) },
    variants: definition.variants.map(variant => ({ ...variant, writes: variant.writes.flatMap(binding => [target(binding),
      ...(clones.get(binding.target) ?? []).map(id => ({ ...binding, target: id }))]) })),
    materials: definition.materials.map(target), viewBindings: definition.viewBindings.map(target), animations: definition.animations.map(target),
    ...(definition.motion ? { motion: definition.motion.map(target) } : {}),
    ...(definition.facing ? { facing: definition.facing.map(target) } : {}),
    surfaceHit: { ...definition.surfaceHit, target: remap(definition.surfaceHit.target) },
  };
}
