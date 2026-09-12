interface RetainedBlock { element: HTMLElement | null; start: number; visible: number; size: number; published: boolean; dirty: boolean; idle: number; }
interface RetainedMembership { readonly visible: number; readonly size: number; }
const retainedBlocks = new WeakMap<Node, RetainedMembership>();

/** Paint owners maintain membership at publication. Diagnostics share that
 * count instead of scanning the geometry of every retained stroke or bar. */
export function registerRetainedPaintMembership(parent: Node, membership: RetainedMembership) {
  retainedBlocks.set(parent, membership);
}

/** Keep the complete prepared capacity, but let the browser skip dormant
 * subtrees. Individual leaves retain visibility (and their layout) while a
 * block is in use, avoiding layout churn as points cross the viewport edge.
 * Active blocks add no layout box or containing block of their own.
 * `retainCommits` keeps an emptied block in layout for that many further
 * publications, so a membership that dips and returns does not remove and
 * rebuild every leaf box in the block.
 * `lazy` plans every block but builds its DOM on first use, then retains it.
 * Most prepared capacity is never shown; it need not exist as DOM. A built
 * block is inserted in slot order, so paint order matches the eager bank. */
export function createRetainedLeafPool(host: HTMLElement, count: number, className: string,
  { sparsePrefix = false, retainCommits = 0, lazy = false }: { sparsePrefix?: boolean; retainCommits?: number; lazy?: boolean } = {}) {
  const elements: HTMLElement[] = [];
  const blocks: RetainedBlock[] = [];
  const shown = new Uint8Array(count);
  const membership = new Int32Array(count);
  const dirtyBlocks: RetainedBlock[] = [];
  const draining = new Set<RetainedBlock>();
  let blockActivations = 0, blockDeactivations = 0;
  const blockSize = 64;
  let nextBlock = 0;
  for (let index = 0; index < count; index++) {
    if (index === nextBlock) {
      blocks.push({ element: null, start: index, visible: 0, size: 0, published: false, dirty: false, idle: 0 });
      // Projected orbits commonly use only a handful of their prepared slots.
      // Refine the first 64 into 8/8/16/32; all later boundaries stay unchanged.
      // This never activates more leaves than the dense 64-slot policy.
      nextBlock += sparsePrefix && index < blockSize ? Math.max(8, index) : blockSize;
    }
    blocks[blocks.length - 1].size++;
    membership[index] = blocks.length - 1;
  }
  const materialize = (blockIndex: number) => {
    const block = blocks[blockIndex], document = host.ownerDocument;
    const element = document.createElement('div');
    element.className = className;
    element.style.display = 'none';
    for (let offset = 0; offset < block.size; offset++) {
      const leaf = document.createElement('s');
      leaf.style.visibility = 'hidden';
      element.appendChild(leaf);
      elements[block.start + offset] = leaf;
    }
    let next: HTMLElement | null = null;
    for (let later = blockIndex + 1; later < blocks.length && !next; later++) next = blocks[later].element;
    if (next) host.insertBefore(element, next); else host.appendChild(element);
    block.element = element; retainedBlocks.set(element, block);
  };
  if (!lazy) for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) materialize(blockIndex);
  return {
    /** Built leaves by slot; a lazy bank leaves unbuilt slots empty. */
    elements,
    /** The leaf for a slot, building its block on first use. */
    element(index: number) {
      if (!blocks[membership[index]].element) materialize(membership[index]);
      return elements[index];
    },
    setVisible(index: number, visible: boolean) {
      if (Boolean(shown[index]) === visible) return;
      const block = blocks[membership[index]];
      if (!block.element) materialize(membership[index]);
      shown[index] = visible ? 1 : 0;
      elements[index].style.visibility = visible ? '' : 'hidden';
      block.visible += visible ? 1 : -1;
      if (!block.dirty) { block.dirty = true; dirtyBlocks.push(block); }
    },
    // Membership can pass through zero while a view replaces its visible leaves.
    // Only the final membership enters/leaves layout, once at publication.
    commitVisibility() {
      for (const block of dirtyBlocks) {
        block.dirty = false;
        if (block.visible > 0) {
          draining.delete(block); block.idle = 0;
          if (block.published) continue;
          block.published = true;
          block.element!.style.display = 'contents';
          blockActivations++;
        } else if (block.published) draining.add(block);
      }
      dirtyBlocks.length = 0;
      for (const block of draining) {
        if (++block.idle <= retainCommits) continue;
        draining.delete(block); block.idle = 0;
        block.published = false;
        block.element!.style.display = 'none';
        blockDeactivations++;
      }
    },
    stats: () => ({ blockActivations, blockDeactivations, builtBlocks: blocks.reduce((sum, block) => sum + Number(block.element !== null), 0),
      residentLeaves: blocks.reduce((sum, block) => sum + (block.published ? block.size : 0), 0),
      visibleLeaves: blocks.reduce((sum, block) => sum + block.visible, 0) }),
  };
}

/** Snapshot direct paint membership without rereading every pooled leaf.
 * Owners count visible bars and nonempty stroke paths during publication.
 * Unpooled leaves and partial groups retain individual reads; ancestor display
 * and opacity deliberately do not change this direct-membership metric. */
export function createRetainedGeometrySnapshot(nodes: readonly Element[]) {
  const grouped = new Map<RetainedMembership, (HTMLElement | SVGPathElement)[]>();
  const individual: (HTMLElement | SVGPathElement)[] = [];
  let retainedLeaves = 0;
  for (const node of nodes) {
    const block = node.parentNode && retainedBlocks.get(node.parentNode);
    if (node.tagName !== 'S' && !(node.tagName === 'path' && block)) continue;
    retainedLeaves++;
    const leaf = node as HTMLElement | SVGPathElement;
    if (!block) { individual.push(leaf); continue; }
    let members = grouped.get(block);
    if (!members) { members = []; grouped.set(block, members); }
    members.push(leaf);
  }
  const complete: RetainedMembership[] = [];
  for (const [block, members] of grouped) {
    if (members.length === block.size) complete.push(block);
    else individual.push(...members);
  }
  const retainedNodes = nodes.length;
  return () => ({ retainedNodes, retainedLeaves,
    directlyHiddenLeaves: complete.reduce((sum, block) => sum + block.size - block.visible, 0) +
      individual.reduce((sum, leaf) => sum + Number(leaf.tagName === 'path'
        ? !leaf.getAttribute('d') : leaf.style.visibility === 'hidden'), 0) });
}
