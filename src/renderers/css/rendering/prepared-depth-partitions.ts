import { sceneEye } from './prepared-facing.js';
import type { PhysicalProjection } from '../prepared-data/physical-projection.js';

export type PreparedDepthOrder = { readonly group: number } | { readonly sequence: readonly PreparedDepthOrder[] } | {
  readonly plane: readonly [number, number, number, number];
  readonly back: PreparedDepthOrder; readonly front: PreparedDepthOrder;
};
export interface PreparedDepthPartitions {
  readonly groups: readonly { readonly root: number; readonly scene: number }[];
  readonly order: PreparedDepthOrder;
}

export interface DepthPartitionNode { hidden: boolean; style: Pick<CSSStyleDeclaration, 'transform' | 'zIndex'>; }

/** Retained paint contexts share the camera's already-published transform.
 * Only prepared priorities and plane signs determine their painter order. No face sorting,
 * style discovery, mesh construction or node replacement enters a frame. */
export function createPreparedDepthPartitions(plan: PreparedDepthPartitions | undefined,
  nodes: readonly DepthPartitionNode[], scene: DepthPartitionNode) {
  if (!plan) return (_projection: PhysicalProjection) => {};
  const groups = plan.groups.map(group => ({ root: nodes[group.root], scene: nodes[group.scene], rank: -1 }));
  const dependsOnEye = (order: PreparedDepthOrder): boolean => 'plane' in order ||
    'sequence' in order && order.sequence.some(dependsOnEye);
  const changingOrder = dependsOnEye(plan.order);
  let ordered = false;
  let transform: string | null = null, hidden: boolean | null = null;
  return (projection: PhysicalProjection) => {
    const nextTransform = scene.style.transform, nextHidden = scene.hidden;
    if (transform !== nextTransform || hidden !== nextHidden) {
      for (const group of groups) {
        if (transform !== nextTransform) group.scene.style.transform = nextTransform;
        if (hidden !== nextHidden) group.scene.hidden = nextHidden;
      }
      transform = nextTransform; hidden = nextHidden;
    }
    if (ordered && !changingOrder) return;
    const eye = sceneEye(projection);
    if (!eye) return;
    let rank = 0;
    function visit(node: PreparedDepthOrder) {
      if ('group' in node) {
        const group = groups[node.group];
        if (group.rank !== rank) { group.root.style.zIndex = String(rank); group.rank = rank; }
        rank++;
      } else if ('sequence' in node) {
        for (const entry of node.sequence) visit(entry);
      } else {
        const p = node.plane;
        const front = p[0] * eye![0] + p[1] * eye![1] + p[2] * eye![2] + p[3] >= 0;
        visit(front ? node.back : node.front);
        visit(front ? node.front : node.back);
      }
    }
    visit(plan.order);
    ordered = true;
  };
}
