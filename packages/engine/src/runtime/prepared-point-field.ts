import type { Vector3, Matrix3 } from '../solar-system/types.js';

export interface Point {
  readonly id: string;
  readonly positionUnits: Vector3;
  readonly absoluteMagnitude: number;
  readonly colorIndex: number;
  readonly name: string | null;
  readonly coverageAnchor?: boolean;
}

export interface Node {
  readonly positionUnits: Vector3;
  readonly radiusUnits: number;
  readonly absoluteMagnitude: number;
  readonly colorIndex: number;
  readonly first: number;
  readonly count: number;
  readonly children: readonly number[];
}

export interface PreparedPointFieldInput {
  readonly stars: readonly Point[];
  readonly nodes: readonly Node[];
  readonly eyeUnits: Vector3;
  /** Row-major world-to-eye rotation. Eye depth is -z. */
  readonly viewRotation: Matrix3;
  readonly focalPx: number;
  readonly viewportHalfWidthPx: number;
  readonly viewportHalfHeightPx: number;
  readonly maxRepresentatives?: number;
  readonly targetErrorPx?: number;
}

export interface VisiblePreparedPointFieldInput extends PreparedPointFieldInput {
  /** Apparent-magnitude cutoff applied to exact stars. */
  readonly limitingMagnitude: number;
  /** Parsecs represented by one prepared position unit. */
  readonly distanceScalePc?: number;
  /** Optional prepared all-sky coverage anchors. */
  readonly coverageAnchorIndices?: readonly number[];
}

export interface PointReference {
  readonly kind: 'node' | 'star';
  readonly index: number;
}

export interface PreparedPointFieldSelection {
  readonly representatives: readonly PointReference[];
  readonly coveredCount: number;
  readonly consideredCount: number;
  readonly drawnCount: number;
  /** The largest estimated unresolved on-screen node error; not a guarantee. */
  readonly maxProjectedErrorPx: number;
  readonly budgetLimited: boolean;
}

interface Candidate {
  readonly kind: 'node' | 'star';
  readonly index: number;
  /** Upper-bound brightness priority; larger values are selected first. */
  readonly priority: number;
  readonly error: number;
}
const validatedFields = new WeakMap<readonly Node[], WeakSet<readonly Point[]>>();

/** Selects a deterministic, frustum-aware hierarchy cut for a prepared point field. */
export function selectPreparedPointField({
  stars,
  nodes,
  eyeUnits,
  viewRotation,
  focalPx,
  viewportHalfWidthPx,
  viewportHalfHeightPx,
  maxRepresentatives = 2048,
  targetErrorPx = 2,
}: PreparedPointFieldInput): PreparedPointFieldSelection {
  return selectInternal({ stars, nodes, eyeUnits, viewRotation, focalPx,
    viewportHalfWidthPx, viewportHalfHeightPx, maxRepresentatives, targetErrorPx }, Infinity, 1);
}

/** Selects exact, visible star rows for the retained CSS point pool. */
export function selectVisiblePreparedStars({
  stars, nodes, eyeUnits, viewRotation, focalPx, viewportHalfWidthPx,
  viewportHalfHeightPx, maxRepresentatives = 2048, targetErrorPx = 2,
  limitingMagnitude, distanceScalePc = 1, coverageAnchorIndices,
}: VisiblePreparedPointFieldInput): PreparedPointFieldSelection {
  if (!Number.isFinite(limitingMagnitude)) throw new TypeError('Invalid point-field limiting magnitude.');
  if (!Number.isFinite(distanceScalePc) || distanceScalePc <= 0) throw new TypeError('Invalid point-field distance scale.');
  const anchors = new Set<number>(coverageAnchorIndices ?? []);
  for (const index of anchors) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= stars.length) throw new TypeError('Invalid point-field coverage anchor.');
  }
  return selectInternal({ stars, nodes, eyeUnits, viewRotation, focalPx,
    viewportHalfWidthPx, viewportHalfHeightPx, maxRepresentatives, targetErrorPx },
  limitingMagnitude, distanceScalePc, anchors);
}

function selectInternal({
  stars, nodes, eyeUnits, viewRotation, focalPx, viewportHalfWidthPx,
  viewportHalfHeightPx, maxRepresentatives = 2048, targetErrorPx = 2,
}: PreparedPointFieldInput, limitingMagnitude: number, distanceScalePc: number,
  coverageAnchorIndices?: ReadonlySet<number>): PreparedPointFieldSelection {
  validateInput(stars, nodes, eyeUnits, viewRotation, focalPx,
    viewportHalfWidthPx, viewportHalfHeightPx, maxRepresentatives, targetErrorPx);
  if (stars.length === 0) return Object.freeze({ representatives: [], coveredCount: 0,
    consideredCount: 0, drawnCount: 0, maxProjectedErrorPx: 0, budgetLimited: false });

  const heap = new MaxHeap();
  const references: PointReference[] = [];
  const root = nodes[0]!;
  const rootCandidate = candidateFor(root, 0, eyeUnits, viewRotation, focalPx,
    viewportHalfWidthPx, viewportHalfHeightPx);
  if (rootCandidate.visible && nodeMayContainVisible(root, eyeUnits, limitingMagnitude,
    distanceScalePc, coverageAnchorIndices)) heap.push({ kind: 'node', index: 0,
    priority: nodePriority(root, eyeUnits, distanceScalePc, coverageAnchorIndices), error: rootCandidate.error });

  let budgetLimited = false;
  while (heap.length > 0) {
    const candidate = heap.pop()!;
    if (candidate.kind === 'star') {
      if (references.length >= maxRepresentatives) {
        budgetLimited = true;
        break;
      }
      references.push({ kind: 'star', index: candidate.index });
      continue;
    }
    const node = nodes[candidate.index]!;
    const children = node.children.length > 0
      ? node.children.map(index => ({ kind: 'node' as const, index }))
      : Array.from({ length: node.count }, (_, offset) => ({ kind: 'star' as const, index: node.first + offset }));
    for (const child of children) {
      if (child.kind === 'node') {
        const childNode = nodes[child.index]!;
        const projected = candidateFor(childNode, child.index, eyeUnits, viewRotation, focalPx,
          viewportHalfWidthPx, viewportHalfHeightPx);
        if (projected.visible && nodeMayContainVisible(childNode, eyeUnits, limitingMagnitude,
          distanceScalePc, coverageAnchorIndices)) heap.push({ kind: 'node', index: child.index,
            priority: nodePriority(childNode, eyeUnits, distanceScalePc, coverageAnchorIndices), error: projected.error });
      } else {
        const star = stars[child.index]!;
        const projected = pointCandidate(star, eyeUnits, viewRotation, focalPx,
          viewportHalfWidthPx, viewportHalfHeightPx);
        const anchor = coverageAnchorIndices?.has(child.index) ?? false;
        if (projected.visible && (anchor || starMagnitude(star, projected.distance, distanceScalePc) <= limitingMagnitude)) {
          heap.push({ kind: 'star', index: child.index,
            priority: starPriority(star, projected.distance, distanceScalePc, anchor), error: 0 });
        }
      }
    }
  }

  if (heap.length > 0) budgetLimited = true;
  const maxProjectedErrorPx = heap.maxError();
  return Object.freeze({ representatives: Object.freeze(references), coveredCount: stars.length,
    consideredCount: stars.length, drawnCount: references.length, maxProjectedErrorPx, budgetLimited });
}

class MaxHeap {
  private values: Candidate[] = [];
  get length(): number { return this.values.length; }
  push(value: Candidate): void {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (higher(this.values[parent]!, value)) break;
      this.values[index] = this.values[parent]!;
      index = parent;
    }
    this.values[index] = value;
  }
  pop(): Candidate | undefined {
    const first = this.values[0];
    const last = this.values.pop();
    if (last !== undefined && this.values.length > 0) {
      let index = 0;
      while (index * 2 + 1 < this.values.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.values.length && higher(this.values[child + 1]!, this.values[child]!)) child += 1;
        if (higher(last, this.values[child]!)) break;
        this.values[index] = this.values[child]!;
        index = child;
      }
      this.values[index] = last;
    }
    return first;
  }
  maxError(): number { return this.values.reduce((maximum, value) => Math.max(maximum, value.error), 0); }
}

function higher(a: Candidate, b: Candidate): boolean {
  return a.priority > b.priority || (a.priority === b.priority && a.index < b.index);
}

function nodePriority(node: Node, eye: Vector3, distanceScalePc: number, anchors?: ReadonlySet<number>): number {
  if (anchors) {
    for (const index of anchors) if (index >= node.first && index < node.first + node.count) return 1e12 - node.first;
  }
  const distance = Math.max(Math.hypot(node.positionUnits[0] - eye[0],
    node.positionUnits[1] - eye[1], node.positionUnits[2] - eye[2]) - node.radiusUnits, Number.EPSILON);
  return -(node.absoluteMagnitude + 5 * Math.log10(distance * distanceScalePc) - 5);
}

function starPriority(star: Point, distance: number, distanceScalePc: number, anchor: boolean): number {
  return anchor ? Number.MAX_VALUE - distance : -starMagnitude(star, distance, distanceScalePc);
}

function starMagnitude(star: Point, distance: number, distanceScalePc: number): number {
  return star.absoluteMagnitude + 5 * Math.log10(Math.max(distance * distanceScalePc, Number.EPSILON)) - 5;
}

function nodeMayContainVisible(node: Node, eye: Vector3, limitingMagnitude: number,
  distanceScalePc: number, anchors?: ReadonlySet<number>): boolean {
  const first = node.first, last = first + node.count;
  for (const index of anchors ?? []) if (index >= first && index < last) return true;
  const nearest = Math.max(Math.hypot(node.positionUnits[0] - eye[0],
    node.positionUnits[1] - eye[1], node.positionUnits[2] - eye[2]) - node.radiusUnits, Number.EPSILON);
  return node.absoluteMagnitude + 5 * Math.log10(nearest * distanceScalePc) - 5 <= limitingMagnitude;
}

function pointCandidate(star: Point, eye: Vector3, rotation: Matrix3, focal: number,
  halfWidth: number, halfHeight: number): { visible: boolean; distance: number } {
  const dx = star.positionUnits[0] - eye[0];
  const dy = star.positionUnits[1] - eye[1];
  const dz = star.positionUnits[2] - eye[2];
  const x = rotation[0] * dx + rotation[1] * dy + rotation[2] * dz;
  const y = rotation[3] * dx + rotation[4] * dy + rotation[5] * dz;
  const z = rotation[6] * dx + rotation[7] * dy + rotation[8] * dz;
  const depth = -z;
  const distance = Math.hypot(dx, dy, dz);
  return { distance, visible: depth > 0 && Math.abs(x) <= halfWidth * depth / focal &&
    Math.abs(y) <= halfHeight * depth / focal };
}

function candidateFor(node: Node, index: number, eye: Vector3, rotation: Matrix3,
  focal: number, halfWidth: number, halfHeight: number): { visible: boolean; error: number } {
  const dx = node.positionUnits[0] - eye[0];
  const dy = node.positionUnits[1] - eye[1];
  const dz = node.positionUnits[2] - eye[2];
  const x = rotation[0] * dx + rotation[1] * dy + rotation[2] * dz;
  const y = rotation[3] * dx + rotation[4] * dy + rotation[5] * dz;
  const z = rotation[6] * dx + rotation[7] * dy + rotation[8] * dz;
  const depth = -z;
  const radius = node.radiusUnits;
  const planeRadiusX = radius * Math.hypot(1, halfWidth / focal);
  const planeRadiusY = radius * Math.hypot(1, halfHeight / focal);
  // Test the four perspective frustum planes directly. This also culls a
  // large node behind the observer when only its depth interval was positive.
  if (depth + radius <= 0 || Math.abs(x) - (halfWidth / focal) * depth > planeRadiusX ||
      Math.abs(y) - (halfHeight / focal) * depth > planeRadiusY) {
    return { visible: false, error: 0 };
  }

  // A sphere which crosses the eye plane has no finite perspective radius.
  // Use its angular radius and clamp to the viewport instead of dividing by
  // an epsilon; the latter made hidden, near-eye branches monopolize the cut.
  const distance = Math.hypot(x, y, z);
  const angularRadius = distance > 0
    ? Math.asin(Math.min(1, radius / distance))
    : Math.PI / 2;
  const viewportRadius = Math.hypot(halfWidth, halfHeight);
  const projectedRadius = focal * Math.tan(Math.min(angularRadius,
    Math.atan2(viewportRadius, focal)));
  // The four plane tests above are the conservative visibility test. Do not
  // apply a second center-plus-angular-radius test here: its tangent-plane
  // approximation can reject an off-axis sphere that intersects the frustum.
  return { visible: true, error: projectedRadius };
}

function validateInput(stars: readonly Point[], nodes: readonly Node[], eye: Vector3,
  rotation: Matrix3, focal: number, halfWidth: number, halfHeight: number,
  budget: number, targetError: number): void {
  if (!Array.isArray(stars) || !Array.isArray(nodes) || nodes.length === 0 ||
      !vector(eye, 3) || !vector(rotation, 9) || !positive(focal) || !positive(halfWidth) ||
      !positive(halfHeight) || !Number.isSafeInteger(budget) || budget < 1 ||
      !Number.isFinite(targetError) || targetError < 0) throw new TypeError('Invalid prepared point-field selector input.');
  const cachedStars = validatedFields.get(nodes);
  if (cachedStars?.has(stars)) return;
  stars.forEach(star => { if (!vector(star.positionUnits, 3)) throw new TypeError('Invalid point position.'); });
  const visited = new Set<number>();
  const visit = (index: number, first: number, count: number) => {
    if (visited.has(index)) throw new TypeError('Point-field hierarchy is not a tree.');
    visited.add(index);
    const node = nodes[index];
    if (!node || !vector(node.positionUnits, 3) || !nonNegative(node.radiusUnits) ||
        !Number.isSafeInteger(node.first) || !Number.isSafeInteger(node.count) ||
        node.first < first || node.first + node.count > first + count || node.count < 1 ||
        node.children.some((child: number) => !Number.isSafeInteger(child) || child < 0 || child >= nodes.length)) {
      throw new TypeError(`Invalid point-field hierarchy node ${index}.`);
    }
    if (node.children.length === 0) {
      if (node.count > 32 || node.first + node.count > stars.length) throw new TypeError('Point-field leaf is invalid.');
      return;
    }
    let cursor = node.first;
    for (const child of node.children) {
      const childNode = nodes[child]!;
      if (childNode.first !== cursor) throw new TypeError('Point-field children must partition their parent.');
      visit(child, cursor, childNode.count);
      cursor += childNode.count;
    }
    if (cursor !== node.first + node.count) throw new TypeError('Point-field children do not cover their parent.');
  };
  visit(0, 0, stars.length);
  if (visited.size !== nodes.length || nodes[0]!.first !== 0 || nodes[0]!.count !== stars.length) {
    throw new TypeError('Point-field hierarchy does not cover the catalogue.');
  }
  if (cachedStars) cachedStars.add(stars);
  else validatedFields.set(nodes, new WeakSet([stars]));
}

function vector(value: readonly number[] | undefined, length: number): value is Vector3 {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}
function positive(value: number): boolean { return Number.isFinite(value) && value > 0; }
function nonNegative(value: number): boolean { return Number.isFinite(value) && value >= 0; }
