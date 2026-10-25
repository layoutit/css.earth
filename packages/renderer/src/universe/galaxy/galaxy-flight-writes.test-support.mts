/** Instrument the DOM the real runtime receives. Record operations, including a forbidden write
 * immediately undone in the same publication; a before/after tree comparison would miss those. */
export function watchFlightWrites(document: Document) {
  let active = false;
  const writes: string[] = [];
  const protect = (node: Element) => {
    if (!('style' in node)) return node;
    const styled = node as HTMLElement | SVGElement, original = styled.style;
    Object.defineProperty(node, 'style', { value: new Proxy(original, {
      set(target, key, value) {
        if (active && node.isConnected && key !== 'transform' && key !== 'opacity') writes.push('style:' + String(key));
        return Reflect.set(target, key, value);
      },
      get(target, key) {
        if (key === 'setProperty' || key === 'removeProperty') return (name: string, ...values: string[]) => {
          if (active && node.isConnected && name !== 'transform' && name !== 'opacity') writes.push('style:' + name);
          return Reflect.apply(target[key], target, [name, ...values]);
        };
        const value: unknown = Reflect.get(target, key);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }) });
    const set = node.setAttribute.bind(node);
    node.setAttribute = (name, value) => { if (active && node.isConnected) writes.push('attribute:' + name); set(name, value); };
    return node;
  };
  const create = document.createElement.bind(document), createNS = document.createElementNS.bind(document);
  document.createElement = ((...args: Parameters<Document['createElement']>) => protect(create(...args))) as Document['createElement'];
  document.createElementNS = ((...args: Parameters<Document['createElementNS']>) => protect(createNS(...args))) as Document['createElementNS'];
  const observer = new document.defaultView!.MutationObserver(records => {
    if (!active) return;
    for (const record of records) if (record.type === 'childList') writes.push('membership');
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return { start() { writes.length = 0; active = true; }, take() { return writes.splice(0); }, destroy() { active = false; observer.disconnect(); } };
}
