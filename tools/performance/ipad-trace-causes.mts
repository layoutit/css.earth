/** Diagnostic-only instrumentation. No geometry/computed-style reads and no app changes. */
export function installTraceCauses() {
  interface Operation {
    id: number; parentId: number | null; kind: string; property: string; target: number;
    before: unknown; after: unknown; frame: number; structureBefore?: unknown; structureAfter?: unknown; arguments?: unknown[]; mounted?: unknown[]; image?: string; startMs: number; endMs: number; stack: string; threw: boolean;
  }
  interface Target { id: number; label: string; ancestors: number[]; connected: boolean; }
  const operations: Operation[] = [], targets: Target[] = [], restores: (() => void)[] = [], unsupported: string[] = [];
  const ids = new WeakMap<object, number>(), owners = new WeakMap<object, Element>();
  const motion = new Map<string, { target: number; property: string; count: number; firstMs: number; lastMs: number; stack: string }>();
  const attachments: unknown[] = [], decodes: { id: number; url: string; startMs: number; endMs: number | null; status: string; width: number; height: number; complete: boolean; stack: string }[] = [];
  let attachmentNodes = 0, omittedAttachmentNodes = 0;
  const imageValue = (value: object) => value instanceof HTMLElement || value instanceof SVGElement ? value.style.backgroundImage : '';
  const mountedTree = (value: unknown) => {
    if (!(value instanceof Element) || !(value.matches('.object-render-root') || value.closest('.object-render-root'))) return null;
    const all = [value, ...value.querySelectorAll('*')], budget = Math.max(0, 30000 - attachmentNodes);
    const nodes = all.slice(0, budget).map(node => ({ target: identify(node), parent: node.parentElement ? identify(node.parentElement) : null,
      tag: node.localName, inline: node.getAttribute('style'), image: imageValue(node) }));
    attachmentNodes += nodes.length; omittedAttachmentNodes += all.length - nodes.length;
    return { root: identify(value), elements: all.length, leaves: all.filter(node => /^(U|B|S)$/.test(node.tagName)).length,
      nodes, omitted: all.length - nodes.length };
  };
  const limit = 60000;
  let nextId = 0, active: number | null = null, internal = false, stopped = false, dropped = 0;
  const epochMs = performance.timeOrigin;
  let frameNumber = 0, frameHandle = requestAnimationFrame(function frame() { frameNumber++; frameHandle = requestAnimationFrame(frame); });
  const originalStamp = console.timeStamp.bind(console);
  const stamp = (label: string) => originalStamp(`cssEarth:cause:${label}`);
  const label = (value: object): string => value === window ? 'window' : value === document ? 'document'
    : value instanceof Element ? value.localName + (value.id ? `#${value.id}` : '') + [...value.classList].slice(0, 4).map(c => `.${c}`).join('')
    : value instanceof Node ? value.nodeName : Object.prototype.toString.call(value);
  const identify = (value: object): number => {
    const prior = ids.get(value); if (prior) return prior;
    const id = targets.length + 1; ids.set(value, id);
    const entry: Target = { id, label: label(value), ancestors: [], connected: value instanceof Node ? value.isConnected : value === window };
    targets.push(entry);
    if (value instanceof Node) for (let p = value.parentNode; p; p = p.parentNode) entry.ancestors.push(identify(p));
    return id;
  };
  const structure = (value: object) => value instanceof Node ? {
    target: identify(value), connected: value.isConnected, parent: value.parentNode ? identify(value.parentNode) : null,
    children: value.childNodes.length, elements: value instanceof Element ? value.children.length : 0,
    directLeaves: value instanceof Element ? [...value.children].filter(n => /^(U|B|S)$/.test(n.tagName)).length : 0,
  } : null;
  const describeNode = (value: Node) => ({ ...structure(value), label: label(value),
    inline: value instanceof Element ? value.getAttribute('style') : null,
    childrenIds: [...value.childNodes].map(identify),
    ancestors: (() => { const result: number[] = []; for (let p = value.parentNode; p; p = p.parentNode) result.push(identify(p)); return result; })() });
  const snapshot = () => ({ atMs: performance.now(), frame: frameNumber, url: location.href,
    groups: [...document.querySelectorAll('.object-render-root, .object-render-root .polycss-mesh')].map(describeNode) });
  const checkpoint = () => {
    internal = true; stamp('checkpoint:begin');
    try {
    const props = ['display','visibility','opacity','transform','transform-origin','transform-style','perspective','perspective-origin','backface-visibility','z-index','width','height','background-image','background-size','background-position','contain','isolation','will-change'];
    const nodes = [...document.querySelectorAll('.object-render-root, .object-render-root *')];
    const startedMs = performance.now();
    const state = nodes.slice(0, 10000).map(node => {
      const style = getComputedStyle(node), rect = node.getBoundingClientRect();
      return { ...describeNode(node), styles: Object.fromEntries(props.map(p => [p, style.getPropertyValue(p)])),
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height } };
    });
    return { ...snapshot(), startedMs, completedMs: performance.now(), nodes: state, omittedNodes: Math.max(0,nodes.length-10000),
      observation: 'Diagnostic computed-style and geometry reads can force rendering; excluded from clean performance comparisons.' };
    } finally { stamp('checkpoint:end'); internal = false; }
  };
  const captureStack = () => new Error().stack ?? '';
  const brief = (value: unknown): unknown => value instanceof Node ? { node: identify(value) }
    : typeof value === 'string' ? value.slice(0, 400) : value === null || ['number', 'boolean', 'undefined'].includes(typeof value) ? value : String(value).slice(0, 120);
  const relevant = (value: object) => value === window || value === document || value instanceof CSSStyleSheet ||
    (value instanceof Node && value.isConnected && !(value instanceof Element && value.closest('[data-capture-overlay]')));
  const observe = <T,>(target: object, kind: string, property: string, read: () => unknown, invoke: () => T, args: unknown[] = []): T => {
    if (internal || stopped || !relevant(target)) return invoke();
    // Continuous transforms/opacity remain counted with a representative stack, not thousands of stamps.
    if (kind === 'style' && /^(transform|opacity)$/.test(property)) {
      internal = true;
      const targetId = identify(target), key = `${targetId}:${property}`, now = performance.now(), prior = motion.get(key);
      if (prior) { prior.count++; prior.lastMs = now; }
      else motion.set(key, { target: targetId, property, count: 1, firstMs: now, lastMs: now, stack: captureStack() });
      internal = false; return invoke();
    }
    if (operations.length >= limit) { dropped++; return invoke(); }
    internal = true;
    const id = ++nextId, parentId = active;
    const operation: Operation = { id, parentId, kind, property, target: identify(target), before: brief(read()), after: null,
      frame: frameNumber, ...(kind === 'children' ? { structureBefore: structure(target), arguments: args.map(brief) } : {}),
      startMs: performance.now(), endMs: 0, stack: captureStack(), threw: false };
    if (kind === 'children' && /^(appendChild|insertBefore|replaceChild|append|prepend|replaceChildren)$/.test(property)) {
      const trees = args.map(mountedTree).filter(tree => tree !== null);
      if (trees.length) { operation.mounted = trees.map(tree => ({ root: tree.root, elements: tree.elements, leaves: tree.leaves })); attachments.push({ operationId: id, trees }); }
    }
    operations.push(operation); active = id; stamp(`${id}:begin`); internal = false;
    try { return invoke(); } catch (error) { operation.threw = true; throw error; }
    finally {
      internal = true; stamp(`${id}:end`); operation.endMs = performance.now(); operation.after = brief(read()); if (kind === 'style' && /^(backgroundImage|background-image|cssText)$/.test(property)) operation.image = imageValue(target); if (kind === 'children') operation.structureAfter = structure(target); active = parentId; internal = false;
    }
  };
  const patch = (prototype: object, name: string, next: PropertyDescriptor) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (!descriptor?.configurable) { unsupported.push(`prototype.${name}`); return; }
    Object.defineProperty(prototype, name, { ...descriptor, ...next });
    restores.push(() => Object.defineProperty(prototype, name, descriptor));
  };
  const method = (prototype: object, name: string, kind: string,
    targetOf: (receiver: object) => object = x => x,
    read: (target: object, args: unknown[]) => unknown = () => null,
    property: (args: unknown[]) => string = () => name) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (typeof descriptor?.value !== 'function') { unsupported.push(name); return; }
    const original = descriptor.value;
    patch(prototype, name, { value: function(this: object, ...args: unknown[]) {
      const target = targetOf(this);
      return observe(target, kind, property(args), () => read(target, args), () => Reflect.apply(original, this, args), args);
    } });
  };
  const setter = (prototype: object, name: string, kind = 'property') => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (!descriptor?.set || !descriptor.get) { unsupported.push(name); return; }
    const get = descriptor.get, set = descriptor.set;
    patch(prototype, name, { set: function(this: object, value: unknown) {
      return observe(this, kind, name, () => Reflect.apply(get, this, []), () => Reflect.apply(set, this, [value]));
    } });
  };
  // Observe the app's own decode promises, including detached Image objects. Never start an extra decode.
  const decode = HTMLImageElement.prototype.decode;
  if (typeof decode === 'function') patch(HTMLImageElement.prototype, 'decode', { value: function(this: HTMLImageElement) {
    if (stopped || decodes.length >= 10000) return Reflect.apply(decode, this, []);
    const row = { id: decodes.length + 1, url: this.currentSrc || this.src, startMs: performance.now(), endMs: null as number | null,
      status: 'pending', width: this.naturalWidth, height: this.naturalHeight, complete: this.complete, stack: captureStack() };
    decodes.push(row); originalStamp(`cssEarth:decode:${row.id}:begin`);
    const done = (status: string) => { if (stopped) return; row.status = status; row.endMs = performance.now(); row.width = this.naturalWidth;
      row.height = this.naturalHeight; row.complete = this.complete; originalStamp(`cssEarth:decode:${row.id}:end`); };
    try {
      const promise: Promise<void> = Reflect.apply(decode, this, []);
      void promise.then(() => done('resolved'), () => done('rejected'));
      return promise;
    } catch (error) { done('threw'); throw error; }
  } });
  // Associate CSS declarations and token lists with their owning element without DOM searches.
  const ownerGetter = (prototype: object, name: string) => {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (!descriptor?.get) { unsupported.push(name); return; }
    const get = descriptor.get, proxies = new WeakMap<object, object>();
    patch(prototype, name, { get: function(this: Element) {
      const value: unknown = Reflect.apply(get, this, []);
      if (typeof value !== 'object' || !value) return value;
      owners.set(value, this);
      if (name !== 'style') return value;
      const prior = proxies.get(value); if (prior) return prior;
      const element = this, bound = new Map<PropertyKey, unknown>();
      const proxy = new Proxy(value, {
        get(target, key) {
          const entry: unknown = Reflect.get(target, key, target);
          if (typeof entry !== 'function') return entry;
          if (!bound.has(key)) bound.set(key, entry.bind(target));
          return bound.get(key);
        },
        set(target, key, next) {
          return observe(element, 'style', String(key), () => Reflect.get(target, key, target), () => Reflect.set(target, key, next, target));
        },
      });
      owners.set(proxy, this); proxies.set(value, proxy); return proxy;
    } });
  };
  ownerGetter(HTMLElement.prototype, 'style'); ownerGetter(SVGElement.prototype, 'style'); ownerGetter(Element.prototype, 'classList');
  for (const element of document.querySelectorAll('*')) {
    if (element instanceof HTMLElement || element instanceof SVGElement) owners.set(element.style, element);
    owners.set(element.classList, element);
  }
  const owner = (receiver: object) => owners.get(receiver) ?? receiver;
  for (const name of ['setAttribute', 'removeAttribute', 'toggleAttribute']) method(Element.prototype, name, 'attribute', x => x,
    (target, args) => target instanceof Element ? target.getAttribute(String(args[0])) : null, args => String(args[0]));
  for (const name of ['add', 'remove', 'toggle', 'replace']) method(DOMTokenList.prototype, name, 'class', owner,
    target => target instanceof Element ? target.getAttribute('class') : null, () => 'class');
  for (const name of ['appendChild', 'removeChild', 'insertBefore', 'replaceChild']) method(Node.prototype, name, 'children', x => x,
    target => target instanceof Node ? target.childNodes.length : null);
  for (const name of ['append', 'prepend', 'replaceChildren', 'remove', 'before', 'after', 'replaceWith', 'insertAdjacentHTML']) method(Element.prototype, name, 'children', x => x,
    target => target instanceof Node ? target.childNodes.length : null);
  setter(Node.prototype, 'textContent', 'text'); setter(Element.prototype, 'innerHTML', 'children');
  for (const name of ['hidden', 'inert', 'title']) setter(HTMLElement.prototype, name);
  for (const name of ['open']) setter(HTMLDetailsElement.prototype, name);
  for (const name of ['value', 'checked', 'disabled']) setter(HTMLInputElement.prototype, name);
  for (const name of ['disabled', 'href', 'media']) setter(HTMLLinkElement.prototype, name, 'stylesheet');
  for (const name of ['disabled']) setter(StyleSheet.prototype, name, 'stylesheet');
  for (const name of ['insertRule', 'deleteRule', 'replace', 'replaceSync']) method(CSSStyleSheet.prototype, name, 'stylesheet');
  for (const name of ['setProperty', 'removeProperty']) method(CSSStyleDeclaration.prototype, name, 'style', owner,
    (target, args) => target instanceof HTMLElement || target instanceof SVGElement ? target.style.getPropertyValue(String(args[0])) : null,
    args => String(args[0]));
  for (const name of Object.getOwnPropertyNames(CSSStyleDeclaration.prototype)) {
    const descriptor = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, name);
    if (!descriptor?.set || !descriptor.get) continue;
    const get = descriptor.get, set = descriptor.set;
    patch(CSSStyleDeclaration.prototype, name, { set: function(this: object, value: unknown) {
      return observe(owner(this), 'style', name, () => Reflect.apply(get, this, []), () => Reflect.apply(set, this, [value]));
    } });
  }
  // DOMStringMap is exotic: retain the native map and intercept only assignment/deletion.
  for (const prototype of [HTMLElement.prototype, SVGElement.prototype]) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, 'dataset');
    if (!descriptor?.get) { unsupported.push('dataset'); continue; }
    const get = descriptor.get, proxies = new WeakMap<object, object>();
    patch(prototype, 'dataset', { get: function(this: Element) {
      const value: unknown = Reflect.apply(get, this, []);
      if (typeof value !== 'object' || value === null) return value;
      const previous = proxies.get(value); if (previous) return previous;
      const element = this;
      const proxy = new Proxy(value, {
        set(target, key, next) { return observe(element, 'dataset', String(key), () => Reflect.get(target, key), () => Reflect.set(target, key, next, target)); },
        deleteProperty(target, key) { return observe(element, 'dataset', String(key), () => Reflect.get(target, key), () => Reflect.deleteProperty(target, key)); },
      });
      proxies.set(value, proxy); return proxy;
    } });
  }
  // Record reads that can synchronously flush pending style/layout, without adding a second read.
  for (const name of ['getBoundingClientRect', 'getClientRects']) method(Element.prototype, name, 'layout-read');
  method(window, 'getComputedStyle', 'layout-read', x => x);
  for (const prototype of [HTMLElement.prototype, Element.prototype]) for (const name of ['offsetWidth', 'offsetHeight', 'offsetTop', 'offsetLeft', 'clientWidth', 'clientHeight', 'scrollWidth', 'scrollHeight']) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
    if (!descriptor?.get) continue;
    const get = descriptor.get;
    patch(prototype, name, { get: function(this: object) {
      return observe(this, 'layout-read', name, () => null, () => Reflect.apply(get, this, []));
    } });
  }
  // Listener calls and signal aborts affect event regions even without DOM writes.
  for (const name of ['addEventListener', 'removeEventListener']) method(EventTarget.prototype, name, 'listener', x => x,
    (_target, args) => { const o = args[2]; return JSON.stringify({ type: args[0], capture: typeof o === 'boolean' ? o : o && typeof o === 'object' ? Object.getOwnPropertyDescriptor(o, 'capture')?.value : undefined,
      passive: o && typeof o === 'object' ? Object.getOwnPropertyDescriptor(o, 'passive')?.value : undefined, once: o && typeof o === 'object' ? Object.getOwnPropertyDescriptor(o, 'once')?.value : undefined,
      signal: o && typeof o === 'object' && Object.getOwnPropertyDescriptor(o, 'signal')?.value instanceof AbortSignal ? identify(Object.getOwnPropertyDescriptor(o, 'signal')!.value) : null }); },
    args => `${name}:${String(args[0])}`);
  // AbortControllers are not DOM nodes; track the abort call itself as a global control operation.
  const abort = AbortController.prototype.abort;
  patch(AbortController.prototype, 'abort', { value: function(this: AbortController, ...args: unknown[]) {
    return observe(document, 'listener', 'AbortController.abort', () => JSON.stringify({ signal: identify(this.signal), aborted: this.signal.aborted }), () => Reflect.apply(abort, this, args));
  } });
  // Unwrapped browser/exotic changes still appear, explicitly without a setter stack.
  const mutations: { atMs: number; target: number; attribute: string | null; before: string | null; after: string | null; kind: string }[] = [];
  const observer = new MutationObserver(records => {
    internal = true;
    for (const r of records) {
      if (!relevant(r.target)) continue;
      if (mutations.length >= limit) { dropped++; continue; }
      mutations.push({ atMs: performance.now(), target: identify(r.target), attribute: r.attributeName,
        before: r.oldValue?.slice(0, 400) ?? null, after: r.target instanceof Element && r.attributeName ? r.target.getAttribute(r.attributeName)?.slice(0, 400) ?? null : null, kind: r.type });
    }
    internal = false;
  });
  observer.observe(document, { subtree: true, attributes: true, attributeOldValue: true, childList: true, characterData: true, characterDataOldValue: true });
  stamp('ready');
  return { describeNode, snapshot, checkpoint, stop() {
    if (!stopped) { stopped = true; cancelAnimationFrame(frameHandle); observer.disconnect(); for (const restore of restores.reverse()) restore(); stamp('stopped'); }
    return { schema: 'cssearth-trace-causes@1', epochMs, operations, targets, attachments, decodes, paintCoverage: { attachmentNodes, omittedAttachmentNodes, decodeLimit: 10000 }, motion: [...motion.values()], mutations, dropped, unsupported,
      limitations: ['Diagnostic wrappers add CPU cost; use a normal capture without --debug for timing.',
        'Transform/opacity writes are counted per target with a representative stack, not individually stamped.',
        'MutationObserver fallback records delivery time without a setter stack; style objects retained before installation can bypass hooks.',
        'String values are limited to 400 characters; operations and fallback mutations each cap at 60000.',
        'Listener calls preserve native behavior; automatic once/signal removals are not individually intercepted.',
        'Frame numbers are observer requestAnimationFrame turns, not proof of display presentation.',
        'Decode promise completion is browser readiness, not proof of GPU upload or decoded-image residency; pre-install decodes are unobserved.',
        'Attachment snapshots inspect inline declarations only; CSS-owned imagery requires checkpoint styles. Debug subtree traversal adds overhead.',
        'Target ancestry is DOM structure, not the set of nodes WebKit invalidated.'] };
  } };
}

export const INSTALL_TRACE_CAUSES = `window.__captureCauses = (${installTraceCauses.toString()})()`;
export const STOP_TRACE_CAUSES = '(() => { const probe = window.__captureCauses; delete window.__captureCauses; return probe ? probe.stop() : null; })()';
