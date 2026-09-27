/** Update a retained shell fragment without replacing controls or unchanged text. */
export function updateShellElement(target: Element, source: Element): void {
  for (const attribute of [...target.attributes]) {
    if (!source.hasAttribute(attribute.name)) target.removeAttribute(attribute.name);
  }
  for (const attribute of source.attributes) {
    if (target.getAttribute(attribute.name) !== attribute.value) target.setAttribute(attribute.name, attribute.value);
  }
  const previous = [...target.childNodes];
  const incoming = [...source.childNodes];
  for (let index = 0; index < incoming.length; index++) {
    const next = incoming[index], current = previous[index];
    if (current?.nodeType === next.nodeType && current.nodeName === next.nodeName) {
      if (current.nodeType === 1 && next.nodeType === 1) {
        // These nodes are Elements by the DOM nodeType contract.
        updateShellElement(current as Element, next as Element);
      } else if (current.nodeValue !== next.nodeValue) current.nodeValue = next.nodeValue;
    } else {
      const copy = target.ownerDocument.importNode(next, true);
      if (current) target.replaceChild(copy, current); else target.appendChild(copy);
    }
  }
  for (const node of previous.slice(incoming.length)) target.removeChild(node);
}

/** A setting's name owns its row; removing Speed must not replace the rows after it. */
export function updateSettingsPanel(target: Element, source: Element): void {
  const title = target.querySelector('h2'), nextTitle = source.querySelector('h2');
  const controls = target.querySelector('.object-settings'), nextControls = source.querySelector('.object-settings');
  if (!title || !nextTitle || !controls || !nextControls) throw new Error('Object settings panel is incomplete.');
  updateShellElement(title, nextTitle);
  const key = (row: Element) => {
    const input = row.matches('input[name], button[name]') ? row : row.querySelector('input[name], button[name]');
    return input ? `control:${input.getAttribute('name')}` : row.id || `${row.tagName}:${row.className}`;
  };
  const previous = new Map([...controls.children].map(row => [key(row), row]));
  if (previous.size !== controls.children.length) throw new Error('Object settings rows need distinct identities.');
  const incomingRows = [...nextControls.children];
  const incomingKeys = new Set(incomingRows.map(key));
  if (incomingKeys.size !== incomingRows.length) throw new Error('Object settings rows need distinct identities.');
  for (const [id, row] of previous) if (!incomingKeys.has(id)) row.remove();
  let cursor = controls.firstElementChild;
  for (const incoming of incomingRows) {
    const id = key(incoming), retained = previous.get(id);
    const row = retained?.tagName === incoming.tagName ? retained : target.ownerDocument.importNode(incoming, true);
    if (row === retained) updateShellElement(row, incoming);
    else if (retained) {
      if (cursor === retained) cursor = retained.nextElementSibling;
      retained.remove();
    }
    if (row !== cursor) controls.insertBefore(row, cursor);
    cursor = row.nextElementSibling;
  }
}
