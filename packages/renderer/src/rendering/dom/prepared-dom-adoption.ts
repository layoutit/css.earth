/** Construction-order identities let server-published context keep its elements
 * when the live owner starts. No detached replacement is substituted at handoff. */
export function preparedDomAdoption(document: Document, existing: HTMLElement | null, mark = false) {
  const old = existing ? [existing, ...existing.querySelectorAll<HTMLElement>('[data-prepared-volume-node]')] : [];
  const byId = new Map(old.map(node => [node.dataset.preparedVolumeNode, node]));
  const snapshot = old.map(node => ({ node, parent: node.parentElement,
    attributes: [...node.attributes].map(attribute => [attribute.name, attribute.value] as const) }));
  let count = 0;
  return {
    create(tag: string): HTMLElement {
      const id = String(count++), node = existing ? byId.get(id) : document.createElement(tag);
      if (!node || node.localName !== tag) throw new TypeError(`Prepared context differs at node ${id}.`);
      if (mark) node.dataset.preparedVolumeNode = id;
      return node;
    },
    finish() {
      if (!existing) return;
      if (count !== old.length || byId.size !== old.length) throw new TypeError('Prepared context has a different node count.');
      for (const { node, parent, attributes } of snapshot) {
        if (node !== existing && node.parentElement !== parent) throw new TypeError('Prepared context has a different topology.');
        // Constructor setup is synchronous. Preserve the already-visible
        // response until the first live camera publication commits.
        for (const attribute of [...node.attributes]) node.removeAttribute(attribute.name);
        for (const [name, value] of attributes) node.setAttribute(name, value);
      }
    },
  };
}
