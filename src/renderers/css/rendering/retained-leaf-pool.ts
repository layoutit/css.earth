/** Keep the complete prepared capacity, but let the browser skip dormant
 * subtrees. Individual leaves retain visibility (and their layout) while a
 * block is in use, avoiding layout churn as points cross the viewport edge.
 * Active blocks add no layout box or containing block of their own. */
export function createRetainedLeafPool(host: HTMLElement, count: number, className: string) {
  const elements: HTMLElement[] = [];
  const blocks: { element: HTMLElement; visible: number }[] = [];
  const shown = new Uint8Array(count);
  const blockSize = 64;
  for (let index = 0; index < count; index++) {
    if (index % blockSize === 0) {
      const element = host.ownerDocument.createElement('div');
      element.className = className;
      element.style.display = 'none';
      host.appendChild(element);
      blocks.push({ element, visible: 0 });
    }
    const element = host.ownerDocument.createElement('s');
    element.style.visibility = 'hidden';
    blocks[blocks.length - 1].element.appendChild(element);
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
