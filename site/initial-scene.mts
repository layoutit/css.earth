/** Preserve the server's scene while its interactive owner starts. The same
 * elements are restored after an early failure; no second scene is mounted. */
export function retainInitialScene(stage: HTMLElement) {
  if (!stage.dataset?.preparedObject || typeof stage.querySelectorAll !== 'function') return null;
  let roots = [...stage.children];
  let snapshot = [stage, ...stage.querySelectorAll<HTMLElement>('[data-prepared-node]')].map(element => ({
    element, children: [...element.children], attributes: [...element.attributes].map(attribute => [attribute.name, attribute.value] as const),
  }));
  let committed = false;
  return {
    get available() { return !committed; },
    commit() { committed = true; roots = []; snapshot = []; },
    restore() {
      if (committed) return;
      for (const { element, children, attributes } of snapshot) {
        for (const attribute of [...element.attributes]) element.removeAttribute(attribute.name);
        for (const [name, value] of attributes) element.setAttribute(name, value);
        element.replaceChildren(...children);
      }
      stage.replaceChildren(...roots);
    },
  };
}
