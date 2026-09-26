// Leaf boxes that follow the body's size on screen.
//
// WebKit, and so every browser on iOS, backs a composited leaf at its CSS box times the device pixel ratio, whatever its
// transform (docs/surface-preparation.md). A leaf holds its widest image at two texels per CSS pixel, which is what the
// body needs at maximum zoom; at rest the same box is several times larger than the leaf on screen. Every projective leaf
// therefore shrinks its box and background address by a factor, --leaf-box, and scales back up by its inverse right after
// its matrix, so its texels land where they did at any factor. Without a factor the leaf keeps its full box.
//
// The factor is min(1, step × density), where every leaf reads --silhouette-step. Its density, what its box needs per
// silhouette pixel, is read from its measured scene frame. Surface leaves are grouped into blocks with placements; at
// runtime (prepared-leaf-box-blocks.ts) each block's step follows its own depth and every other leaf's (rings, shells)
// follows the silhouette. A step is written on the group's own leaves, so a change restyles only them; before the first
// write they inherit the body's initial step from the system node. The node builder writes the lengths and transform;
// the presentation bindings, measured in a browser, write each factor, the groups and the steps
// (tools/prepared/prepared-presentation-bindings.mts), so every generator shares one rule.
import { walkSilhouetteLevels, type PreparedSilhouetteSteps } from '@cssearth/renderer/rendering/prepared-silhouette-steps.ts';
import type { PreparedTexturePlacements } from '@cssearth/renderer/rendering/prepared-texture-levels.ts';

/** The step every leaf reads; `<property>-<block>` names a block in the binding's placements and groups. */
export const LEAF_BOX_PROPERTY = '--silhouette-step';
/** Each leaf's own factor, which its lengths and transform read. */
export const LEAF_BOX_FACTOR = '--leaf-box';
/** A leaf box holds at least this many of its CSS pixels per CSS pixel it covers on screen. Each texel is resampled twice,
 * into the box and onto the screen; at one box pixel per screen pixel the second resampling speckles fine texture. On
 * the Moon at rest in the iOS simulator (DPR 3), one gave 3,271 changed pixels against full boxes, two gave 239. */
export const LEAF_BOX_SCREEN_PIXELS = 2;
/** Leaves per group: the smallest repaint the runtime can schedule in one frame (prepared-leaf-box-blocks.ts paces the
 * groups by the frames they cost). In the iOS simulator a Moon leaf repaints in about 0.7 ms and a Haumea leaf in about
 * 2.5 ms, so a group of 8 stays near one frame on either. The Moon's 448 leaves make 56 blocks, Haumea's 1,444 make 180. */
export const LEAF_BOX_GROUP_LEAVES = 8;
/** Leaf boxes never shrink below this many silhouette pixels' worth: a body smaller than this on screen keeps its first step. */
const FIRST_STEP = 16;
/** Steps grow by √2: a box holds one to √2 times what it needs. The runtime queues each block's repaint, so finer steps
 * cost repaints spread over frames, not long frames. */
const STEP_RATIO = Math.SQRT2;
/** A step change repaints every leaf whose box changes, so the thresholds hold back by this share before stepping down. */
const HYSTERESIS = 0.1;

export interface PreparedLeafBoxSteps extends PreparedSilhouetteSteps { property: string }

const significant = (value: number) => Number(value.toPrecision(4));

/** Every px length in `value` times the leaf's factor, which defaults to one. A zero stays zero. */
export function leafBoxLengths(value: string) {
  return value.replace(/(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)px\b/giu,
    (length, number) => Number(number) === 0 ? length : `calc(${length} * var(${LEAF_BOX_FACTOR}, 1))`);
}

/** The inverse scale that follows the leaf's matrix3d, so a smaller box lands where the full one did. Leaves transform
 * from their top-left corner, and any later centre-relative term (the seam outset) uses percentages of the box. */
export const LEAF_BOX_UNSCALE = `scale(calc(1 / var(${LEAF_BOX_FACTOR}, 1)))`;

/** What a leaf's box needs per silhouette pixel: LEAF_BOX_SCREEN_PIXELS times the scene units one box pixel spans at the
 * leaf's most magnified edge or centre line, over the body's diameter in scene units. `matrix` maps the leaf's box into
 * the scene (column-major); leaves are homographies, so the scale is read along four edges and two centre lines. */
export function leafBoxDensity(matrix: readonly number[], width: number, height: number, bodyDiameter: number) {
  const m = matrix;
  if (m.length !== 16 || m.some(value => !Number.isFinite(value)) || !(width > 0) || !(height > 0) || !(bodyDiameter > 0)) {
    throw new TypeError(`Leaf box density needs a finite matrix3d, a positive box (${width} × ${height} px) and body diameter (${bodyDiameter}).`);
  }
  const point = (x: number, y: number) => {
    const w = m[3]! * x + m[7]! * y + m[15]!;
    if (!(Math.abs(w) > 1e-12)) throw new TypeError(`Leaf box density: the leaf ${m.join(',')} leaves the projective plane.`);
    return [(m[0]! * x + m[4]! * y + m[12]!) / w, (m[1]! * x + m[5]! * y + m[13]!) / w, (m[2]! * x + m[6]! * y + m[14]!) / w];
  };
  const span = (a: number[], b: number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
  const across = [0, height / 2, height].map(y => span(point(0, y), point(width, y)) / width);
  const down = [0, width / 2, width].map(x => span(point(x, 0), point(x, height)) / height);
  return LEAF_BOX_SCREEN_PIXELS * Math.max(...across, ...down) / bodyDiameter;
}

/** Steps of STEP_RATIO from FIRST_STEP up to the first step at which every leaf of the body is at its full box. Each step
 * publishes its upper bound, so a box never holds less than it needs. */
export function prepareLeafBoxSteps(densities: readonly number[]): PreparedLeafBoxSteps {
  const least = Math.min(...densities);
  if (!densities.length || !(least > 0) || !Number.isFinite(least)) throw new TypeError(`Leaf box steps need positive leaf densities, not ${densities.slice(0, 4).join(', ')}.`);
  const full = 1 / least, levels = [{ minimumDiameter: 0, value: String(FIRST_STEP) }];
  for (let step = FIRST_STEP; step < full; step *= STEP_RATIO) levels.push({ minimumDiameter: significant(step), value: String(significant(step * STEP_RATIO)) });
  // At least two levels: a body whose leaves are all full from the first step still steps once.
  if (levels.length < 2) levels.push({ minimumDiameter: FIRST_STEP, value: String(significant(FIRST_STEP * STEP_RATIO)) });
  return { property: LEAF_BOX_PROPERTY, hysteresis: HYSTERESIS, levels };
}

/** Blocks of leaves for per-block steps: each leaf joins the nearest of `count` directions spread evenly over the sphere
 * (a Fibonacci lattice), by the direction of its centre from the body's centre. Returns each leaf's block index; empty
 * blocks are dropped and the rest renumbered in lattice order. */
export function leafBoxBlocks(centres: readonly (readonly number[])[], bodyCentre: readonly number[], count: number) {
  if (!(count >= 2) || !Number.isInteger(count)) throw new RangeError(`Leaf box blocks need a whole count of at least two, not ${count}.`);
  const golden = Math.PI * (3 - Math.sqrt(5));
  const lattice = Array.from({ length: count }, (_, index) => {
    const y = 1 - 2 * (index + 0.5) / count, ring = Math.sqrt(1 - y * y), angle = golden * index;
    return [Math.cos(angle) * ring, y, Math.sin(angle) * ring];
  });
  // A leaf on the line between two lattice directions (a polar cap on the axis) would take whichever float noise in its
  // browser-measured frame favours: its direction is rounded, and a tie goes to the lower block, so every bake agrees.
  const TIE = 1e-7, round = (value: number) => Math.round(value * 1e6) / 1e6;
  const nearest = centres.map(centre => {
    const out = centre.map((value, axis) => value - bodyCentre[axis]!), length = Math.hypot(...out);
    if (!(length > 0)) throw new TypeError('A leaf centre sits at the body centre.');
    const unit = out.map(value => round(value / length));
    let best = 0, score = -Infinity;
    for (const [index, direction] of lattice.entries()) {
      const dot = direction.reduce((sum, value, axis) => sum + value * unit[axis]!, 0);
      if (dot > score + TIE) { score = dot; best = index; }
    }
    return best;
  });
  const used = [...new Set(nearest)].sort((a, b) => a - b), renumber = new Map(used.map((block, index) => [block, index]));
  return nearest.map(block => renumber.get(block)!);
}

/** PreparedTexturePlacements for blocks of leaf corners, in scene coordinates: each block's bounding sphere, mean outward
 * direction and largest angle to any corner, and the body's centre and nearest corner. Rounded outward as the texture
 * placements are (tools/prepared/prepared-presentation-bindings.mts): a larger bound and spread, and a smaller body, only
 * ever count more leaves as seen. */
export function leafBoxPlacements(blocks: ReadonlyMap<string, readonly (readonly number[])[]>, bodyCentre: readonly number[]): PreparedTexturePlacements {
  const length = (vector: readonly number[]) => Math.hypot(...vector), minus = (a: readonly number[], b: readonly number[]) => a.map((value, axis) => value - b[axis]!);
  const up = (value: number, step: number) => Math.ceil(value / step) * step, fixed = (value: number) => Number(value.toFixed(2));
  const vector = (values: readonly number[]): [number, number, number] => [values[0]!, values[1]!, values[2]!];
  // The body is the sphere through the lowest corner; the runtime counts a block unseen past that sphere's horizon.
  const radius = Math.floor(Math.min(...[...blocks.values()].flat().map(point => length(minus(point, bodyCentre)))) * 100) / 100;
  const writes: Record<string, PreparedTexturePlacements['writes'][string]> = {};
  for (const [name, points] of blocks) {
    // The bound and spread are measured from the rounded centre and direction they are published with.
    const center = vector([0, 1, 2].map(axis => fixed(points.reduce((sum, point) => sum + point[axis]!, 0) / points.length)));
    const out = minus(center, bodyCentre), normal = vector(out.map(value => Number((value / length(out)).toFixed(4))));
    let bound = 0, spread = 0, highest = 0;
    for (const point of points) {
      bound = Math.max(bound, length(minus(point, center)));
      const direction = minus(point, bodyCentre);
      highest = Math.max(highest, length(direction));
      spread = Math.max(spread, Math.acos(Math.max(-1, Math.min(1, direction.reduce((sum, value, axis) => sum + value * normal[axis]!, 0) / length(direction)))));
    }
    // A leaf above the body (a haze or cloud shell) shows past the body's horizon: a point at height h over a sphere of
    // radius r stays in view up to acos(r / h) beyond it, so the block's spread grows by that angle.
    const altitude = highest > radius ? Math.acos(radius / highest) : 0;
    writes[name] = { center, radius: fixed(up(bound, 0.01)), normal, spread: Number(up(Math.min(Math.PI, spread + altitude), 1e-4).toFixed(4)) };
  }
  return { body: { center: vector(bodyCentre.map(fixed)), radius }, writes };
}

/** One leaf that reads a factor, as the presentation bindings measure it at rest: its tree node, its scene frame
 * (column-major), its full box, and whether it lies on the body's exterior surface. */
export interface MeasuredLeafBox { node: number; frame: readonly number[]; width: number; height: number; surface: boolean }

/** Each measured leaf's factor, its group, and the steps. Surface leaves join blocks with placements when the body is a
 * closed sphere or ellipsoid; every other leaf joins the whole body's group, named by the property itself. `bodyCentre`
 * and `bodyDiameter` are in scene coordinates; `target` holds the initial step every leaf inherits, `initialDiameter` is
 * the silhouette before the camera publishes one. */
export function prepareLeafBoxBindings(leaves: readonly MeasuredLeafBox[], { bodyCentre, bodyDiameter, target, closed, initialDiameter }:
  { bodyCentre: readonly number[]; bodyDiameter: number; target: number; closed: boolean; initialDiameter: number }) {
  if (!leaves.length) throw new TypeError('Leaf box bindings need at least one measured leaf.');
  const point = (frame: readonly number[], x: number, y: number) => {
    const w = frame[3]! * x + frame[7]! * y + frame[15]!;
    return [0, 1, 2].map(axis => (frame[axis]! * x + frame[axis + 4]! * y + frame[axis + 12]!) / w);
  };
  const densities = leaves.map(leaf => leafBoxDensity(leaf.frame, leaf.width, leaf.height, bodyDiameter));
  const steps = prepareLeafBoxSteps(densities);
  const surface = closed ? leaves.flatMap((leaf, index) => leaf.surface ? [index] : []) : [];
  const corners = (leaf: MeasuredLeafBox) => [[0, 0], [leaf.width, 0], [0, leaf.height], [leaf.width, leaf.height]].map(([x, y]) => point(leaf.frame, x!, y!));
  const blockOf = new Map<number, number>();
  if (surface.length) {
    const centres = surface.map(index => point(leaves[index]!.frame, leaves[index]!.width / 2, leaves[index]!.height / 2));
    const count = Math.max(2, Math.round(surface.length / LEAF_BOX_GROUP_LEAVES));
    leafBoxBlocks(centres, bodyCentre, count).forEach((block, at) => blockOf.set(surface[at]!, block));
  }
  const blockName = (block: number) => `${steps.property}-${block}`;
  const blockCorners = new Map<string, number[][]>();
  for (const [index, block] of blockOf) blockCorners.set(blockName(block), [...blockCorners.get(blockName(block)) ?? [], ...corners(leaves[index]!)]);
  const placements = blockCorners.size ? leafBoxPlacements(new Map([...blockCorners].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))), bodyCentre) : null;
  const initial = steps.levels[walkSilhouetteLevels(steps.levels, steps.hysteresis, initialDiameter)]!.value;
  // Blocks by placement; every other leaf follows the silhouette in chunks of the same size, so the queue spreads a
  // whole-body step change (Saturn's rings and shells) over frames too.
  const groups: Record<string, number[]> = {};
  leaves.forEach((leaf, index) => { if (blockOf.has(index)) (groups[blockName(blockOf.get(index)!)] ??= []).push(leaf.node); });
  const whole = leaves.flatMap((leaf, index) => blockOf.has(index) ? [] : [leaf.node]);
  for (let at = 0; at < whole.length; at += LEAF_BOX_GROUP_LEAVES) groups[`${steps.property}-body-${at / LEAF_BOX_GROUP_LEAVES}`] = whole.slice(at, at + LEAF_BOX_GROUP_LEAVES);
  // Each group's full box area (CSS px²) and area-weighted density: the runtime estimates its layer bytes at any step
  // from them, to keep detail beyond the view's need within a budget.
  const indexOf = new Map(leaves.map((leaf, index) => [leaf.node, index]));
  const sizes = Object.fromEntries(Object.entries(groups).map(([name, nodes]) => {
    const areas = nodes.map(node => leaves[indexOf.get(node)!]!.width * leaves[indexOf.get(node)!]!.height), area = areas.reduce((sum, value) => sum + value, 0);
    const density = nodes.reduce((sum, node, at) => sum + densities[indexOf.get(node)!]! * areas[at]!, 0) / area;
    return [name, [Math.round(area), significant(density)]];
  }));
  const order = (entries: [string, unknown][]) => entries.sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  return {
    factors: leaves.map((leaf, index) => ({ node: leaf.node, value: `min(1, var(${steps.property}, 1e6) * ${significant(densities[index]!)})` })),
    initial: [{ name: steps.property, value: initial }],
    binding: { kind: 'silhouette-step-property' as const, target, property: steps.property, hysteresis: steps.hysteresis, levels: steps.levels,
      ...placements ? { placements } : {}, groups: Object.fromEntries(order(Object.entries(groups))) as Record<string, number[]>,
      groupSizes: Object.fromEntries(order(Object.entries(sizes))) as Record<string, [number, number]> },
  };
}

interface LeafBoxTree {
  tree: { nodes: readonly { parent: number; properties: readonly number[] }[]; properties: readonly { name: string; value: string; custom: boolean }[]; scene: number; camera: number };
  viewBindings: readonly unknown[];
}
/** Measured leaf boxes written into a presentation: each leaf's factor, the steps' initial values on the leaves' outermost
 * common ancestor below the scene (the system node, which carries the body and its rings), and the binding that publishes
 * them. Earlier factors, steps and binding are replaced,
 * so the bindings can be measured again over their own output. */
/** The tree's property table interned again in node order, as the node builder's finish() writes it: an earlier bake's
 * factors leave no entries behind, and the same leaves give the same bytes whatever the tree's history. */
function internedTree<T extends LeafBoxTree['tree']>(tree: T, nodes: readonly (T['nodes'][number])[], table: T['properties']): T {
  const properties: { name: string; value: string; custom: boolean }[] = [], ids = new Map<string, number>();
  const intern = (property: { name: string; value: string; custom: boolean }) => {
    const key = JSON.stringify(property);
    if (!ids.has(key)) { ids.set(key, properties.length); properties.push(property); }
    return ids.get(key)!;
  };
  return { ...tree, nodes: nodes.map(node => ({ ...node, properties: node.properties.map(id => intern(table[id]!)) })), properties };
}

export function withLeafBoxes<D extends LeafBoxTree>(definition: D, measured: { leaves: readonly MeasuredLeafBox[]; bodyCentre: readonly number[] } | null,
  { closed, initialDiameter }: { closed: boolean; initialDiameter: number }): D {
  const stepName = (name: string) => name === LEAF_BOX_PROPERTY || name.startsWith(`${LEAF_BOX_PROPERTY}-`);
  const leafBoxBinding = (entry: unknown) => typeof entry === 'object' && entry !== null &&
    Reflect.get(entry, 'kind') === 'silhouette-step-property' && Reflect.get(entry, 'property') === LEAF_BOX_PROPERTY;
  // No rendered leaf: every leaf keeps its full box (the factor's fallback), and an earlier bake's factors, steps and
  // binding go.
  if (!measured?.leaves.length) return { ...definition, viewBindings: definition.viewBindings.filter(entry => !leafBoxBinding(entry)),
    tree: internedTree(definition.tree, definition.tree.nodes.map(node => ({ ...node, properties: node.properties
      .filter(id => definition.tree.properties[id]!.name !== LEAF_BOX_FACTOR && !stepName(definition.tree.properties[id]!.name)) })),
      definition.tree.properties) };
  const { tree } = definition, parents = (node: number) => {
    const chain: number[] = [];
    for (let cursor = tree.nodes[node]!.parent; cursor >= 0 && cursor !== tree.scene; cursor = tree.nodes[cursor]!.parent) chain.push(cursor);
    return chain;
  };
  // The outermost node below the scene that holds every measured leaf.
  const shared = measured.leaves.map(leaf => new Set(parents(leaf.node)));
  const target = parents(measured.leaves[0]!.node).filter(node => shared.every(chain => chain.has(node)) && node !== tree.camera).at(-1);
  if (target === undefined) throw new TypeError('Leaf boxes need a common ancestor below the scene to publish their steps.');
  const point = (frame: readonly number[], x: number, y: number) => {
    const w = frame[3]! * x + frame[7]! * y + frame[15]!;
    return [0, 1, 2].map(axis => (frame[axis]! * x + frame[axis + 4]! * y + frame[axis + 12]!) / w);
  };
  // The body's diameter is its surface leaves' farthest reach from the centre, or every leaf's when it has no surface leaf.
  const reach = measured.leaves.filter(leaf => leaf.surface).length ? measured.leaves.filter(leaf => leaf.surface) : measured.leaves;
  const bodyDiameter = 2 * Math.max(...reach.flatMap(leaf => [[0, 0], [leaf.width, 0], [0, leaf.height], [leaf.width, leaf.height]]
    .map(([x, y]) => Math.hypot(...point(leaf.frame, x!, y!).map((value, axis) => value - measured.bodyCentre[axis]!)))));
  if (!(bodyDiameter > 0) || !(initialDiameter > 0)) {
    throw new TypeError(`Leaf boxes need a positive body diameter (${bodyDiameter}) and logical body diameter (${initialDiameter}).`);
  }
  const { factors, initial, binding } = prepareLeafBoxBindings(measured.leaves, { bodyCentre: measured.bodyCentre, bodyDiameter, target, closed, initialDiameter });
  const properties = [...tree.properties], ids = new Map(properties.map((property, id) => [JSON.stringify(property), id]));
  const intern = (property: { name: string; value: string; custom: boolean }) => {
    const key = JSON.stringify(property);
    if (!ids.has(key)) { ids.set(key, properties.length); properties.push(property); }
    return ids.get(key)!;
  };
  const factorOf = new Map(factors.map(factor => [factor.node, factor.value]));
  const nodes = tree.nodes.map((node, index) => {
    // prepare:object-json writes the bound runtime back, so an earlier measurement's factors and steps are dropped wherever
    // they are.
    const kept = node.properties.filter(id => properties[id]!.name !== LEAF_BOX_FACTOR && !stepName(properties[id]!.name));
    const factor = factorOf.get(index);
    return { ...node, properties: [...kept, ...factor === undefined ? [] : [intern({ name: LEAF_BOX_FACTOR, value: factor, custom: true })],
      ...index === target ? initial.map(step => intern({ ...step, custom: true })) : []] };
  });
  const bindings = definition.viewBindings.filter(entry => !leafBoxBinding(entry));
  return { ...definition, tree: internedTree(tree, nodes, properties), viewBindings: [...bindings, binding] };
}
