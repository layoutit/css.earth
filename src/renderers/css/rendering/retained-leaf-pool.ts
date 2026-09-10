interface RetainedBlock { element: HTMLElement; visible: number; size: number; }
const retainedBlocks = new WeakMap<Node, RetainedBlock>();

/** Keep the complete prepared capacity, but let the browser skip dormant
 * subtrees. Individual leaves retain visibility (and their layout) while a
 * block is in use, avoiding layout churn as points cross the viewport edge.
 * Active blocks add no layout box or containing block of their own. */
export function createRetainedLeafPool(host: HTMLElement, count: number, className: string) {
  const elements: HTMLElement[] = [];
  const blocks: RetainedBlock[] = [];
  const shown = new Uint8Array(count);
  const blockSize = 64;
  for (let index = 0; index < count; index++) {
    if (index % blockSize === 0) {
      const element = host.ownerDocument.createElement('div');
      element.className = className;
      element.style.display = 'none';
      host.appendChild(element);
      const block = { element, visible: 0, size: 0 };
      blocks.push(block); retainedBlocks.set(element, block);
    }
    const element = host.ownerDocument.createElement('s');
    element.style.visibility = 'hidden';
    blocks[blocks.length - 1].element.appendChild(element);
    blocks[blocks.length - 1].size++;
    elements.push(element);
  }
  return {
    elements,
    setVisible(index: number, visible: boolean) {
      if (Boolean(shown[index]) === visible) return;
      shown[index] = visible ? 1 : 0;
      elements[index].style.visibility = visible ? '' : 'hidden';
      const block = blocks[Math.floor(index / blockSize)];
      block.visible += visible ? 1 : -1;
      if (block.visible === 0) block.element.style.display = 'none';
      else if (block.visible === 1 && visible) block.element.style.display = 'contents';
    },
  };
}

/** Snapshot the same direct visibility metric without rereading every pooled
 * leaf's CSSOM. Pool owners already maintain exact membership for publication.
 * Unpooled leaves and partial blocks retain individual reads; ancestor display
 * and opacity deliberately do not change this direct-visibility metric. */
export function createRetainedGeometrySnapshot(nodes: readonly Element[]) {
  const grouped = new Map<RetainedBlock, HTMLElement[]>();
  const individual: HTMLElement[] = [];
  let retainedLeaves = 0;
  for (const node of nodes) {
    if (node.tagName !== 'S') continue;
    retainedLeaves++;
    const leaf = node as HTMLElement;
    const block = node.parentNode && retainedBlocks.get(node.parentNode);
    if (!block) { individual.push(leaf); continue; }
    let members = grouped.get(block);
    if (!members) { members = []; grouped.set(block, members); }
    members.push(leaf);
  }
  const complete: RetainedBlock[] = [];
  for (const [block, members] of grouped) {
    if (members.length === block.size) complete.push(block);
    else individual.push(...members);
  }
  const retainedNodes = nodes.length;
  return () => ({ retainedNodes, retainedLeaves,
    directlyHiddenLeaves: complete.reduce((sum, block) => sum + block.size - block.visible, 0) +
      individual.reduce((sum, leaf) => sum + Number(leaf.style.visibility === 'hidden'), 0) });
}
