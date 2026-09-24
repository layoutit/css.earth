import { NAVIGATION_TREE_SCHEMA, type NavigationTreePayload, type NavigationTreeRecord } from '../../src/navigation/navigation-tree-schema.mts';
import type { BrowserWindow } from '../browser-types.mts';
import { record } from '../browser-types.mts';


function parsePayload(value: unknown): NavigationTreePayload {
  if (!record(value) || value.schema !== NAVIGATION_TREE_SCHEMA || !Array.isArray(value.roots) || !record(value.nodes)) {
    throw new TypeError('Invalid navigation tree payload.');
  }
  const nodes: Record<string, NavigationTreeRecord> = {};
  for (const [key, raw] of Object.entries(value.nodes)) {
    if (!record(raw) || typeof raw.label !== 'string' || !(typeof raw.objectId === 'string' || raw.objectId === null)
      || typeof raw.place !== 'boolean' || !Number.isSafeInteger(raw.count) || !Array.isArray(raw.children)
      || !raw.children.every(child => typeof child === 'string') || !(raw.marker === null || record(raw.marker)
        && typeof raw.marker.className === 'string' && typeof raw.marker.style === 'string')
      || !(typeof raw.href === 'string' && raw.href.startsWith('/') || raw.href === null)
      || !(typeof raw.focusId === 'string' || raw.focusId === null)) {
      throw new TypeError(`Invalid navigation tree node: ${key}.`);
    }
    nodes[key] = { label: raw.label, objectId: raw.objectId, place: raw.place, count: Number(raw.count),
      marker: raw.marker as NavigationTreeRecord['marker'], children: [...raw.children],
      href: raw.href, focusId: raw.focusId };
  }
  if (!value.roots.every(key => typeof key === 'string' && nodes[key])) throw new TypeError('Invalid navigation tree roots.');
  for (const node of Object.values(nodes)) if (!node.children.every(key => nodes[key])) throw new TypeError('Invalid navigation tree child.');
  return { schema: NAVIGATION_TREE_SCHEMA, roots: [...value.roots] as string[], nodes };
}

export function createNavigationTreeController(root: HTMLElement, windowTarget: BrowserWindow) {
  const url = root.dataset.atlasTreeSrc || null;
  const events = new AbortController();
  let selected = root.dataset.atlasCurrent ?? '';
  let payloadPromise: Promise<NavigationTreePayload> | null = null;

  const load = () => {
    if (!url) return Promise.reject(new Error('Navigation tree has no deferred-data address.'));
    if (!payloadPromise) payloadPromise = windowTarget.fetch(url).then(async response => {
      if (!response.ok) throw new Error(`Navigation tree request ${url} failed: ${response.status}.`);
      return parsePayload(await response.json() as unknown);
    }).catch(error => { payloadPromise = null; throw error; });
    return payloadPromise;
  };
  const detailsByKey = (key: string) => [...root.querySelectorAll<HTMLDetailsElement>('details[data-atlas-key]')]
    .find(details => details.dataset.atlasKey === key);
  const anchorByObject = (objectId: string) => [...root.querySelectorAll<HTMLAnchorElement>('a[data-atlas-object]')]
    .find(anchor => anchor.dataset.atlasObject === objectId);

  // The payload carries each row's destination. A row the application cannot
  // open keeps its marker and stays a label, never a link that leads nowhere.
  const markerAnchor = (node: NavigationTreeRecord, branch: boolean) => {
    const element = root.ownerDocument.createElement(node.href === null ? 'span' : 'a');
    element.className = [branch ? 'atlas-tree-body' : 'atlas-row', node.marker?.className].filter(Boolean).join(' ');
    if (node.marker?.style) element.setAttribute('style', node.marker.style);
    if (node.href === null) element.dataset.atlasPlace = node.objectId!;
    else {
      element.setAttribute('href', node.href);
      element.dataset.atlasObject = node.objectId!;
      if (node.focusId) element.dataset.preparedFocusId = node.focusId;
      if (node.objectId === selected) element.setAttribute('aria-current', 'page');
    }
    element.textContent = node.label;
    return element;
  };
  const createItem = (key: string, depth: number, payload: NavigationTreePayload): HTMLLIElement => {
    const node = payload.nodes[key]!;
    const item = root.ownerDocument.createElement('li');
    if (!node.children.length) {
      if (node.objectId) item.append(markerAnchor(node, false));
      return item;
    }
    const details = root.ownerDocument.createElement('details');
    details.dataset.atlasDepth = String(depth);
    details.dataset.atlasKey = key;
    details.dataset.atlasLazy = '';
    const summary = root.ownerDocument.createElement('summary');
    if (node.objectId) summary.append(markerAnchor(node, true));
    else {
      const label = root.ownerDocument.createElement('span');
      label.className = depth === 0 ? 'atlas-tree-root' : node.place ? 'atlas-tree-group' : 'atlas-tree-body';
      label.textContent = `${node.label} (${depth === 0 ? node.count : node.children.length})`;
      summary.append(label);
    }
    details.append(summary);
    item.append(details);
    return item;
  };
  const materialize = async (details: HTMLDetailsElement, supplied?: NavigationTreePayload) => {
    if (!details.hasAttribute('data-atlas-lazy')) return;
    const payload = supplied ?? await load();
    const key = details.dataset.atlasKey;
    const node = key ? payload.nodes[key] : null;
    if (!node) throw new Error(`Navigation branch is missing: ${key ?? ''}.`);
    const list = root.ownerDocument.createElement('ul');
    const depth = Number(details.dataset.atlasDepth) + 1;
    for (const child of node.children) list.append(createItem(child, depth, payload));
    details.append(list);
    details.removeAttribute('data-atlas-lazy');
  };
  const report = (error: unknown) => {
    root.dataset.atlasLoadError = '';
    console.warn('The navigation tree could not expand.', error);
  };
  root.addEventListener('toggle', event => {
    const details = event.target;
    if (details instanceof windowTarget.HTMLDetailsElement && details.open && details.hasAttribute('data-atlas-lazy')) {
      details.ariaBusy = 'true';
      void materialize(details).catch(report).finally(() => { details.removeAttribute('aria-busy'); });
    }
  }, { capture: true, signal: events.signal });

  const select = async (objectId: string) => {
    selected = objectId;
    root.dataset.atlasCurrent = objectId;
    let target = anchorByObject(objectId);
    if (!target && url) {
      try {
        const payload = await load();
        // A later selection owns the tree once this one yields.
        if (selected !== objectId) return;
        const parent = new Map<string, string>();
        for (const [key, node] of Object.entries(payload.nodes)) for (const child of node.children) parent.set(child, key);
        const path: string[] = [];
        const targetKey = Object.entries(payload.nodes).find(([, node]) => node.objectId === objectId)?.[0];
        for (let key: string | undefined = targetKey; key; key = parent.get(key)) path.unshift(key);
        for (const key of path.slice(0, -1)) {
          const details = detailsByKey(key);
          if (!details) break;
          await materialize(details, payload);
          if (selected !== objectId) return;
          details.open = true;
        }
        target = anchorByObject(objectId);
      } catch (error) { report(error); }
    }
    for (const anchor of root.querySelectorAll<HTMLAnchorElement>('a[data-atlas-object][aria-current]')) anchor.removeAttribute('aria-current');
    target?.setAttribute('aria-current', 'page');
    const selectedRoot = target?.closest<HTMLDetailsElement>('details[data-atlas-depth="0"]') ?? null;
    if (selectedRoot) {
      for (const branch of root.querySelectorAll<HTMLDetailsElement>('details[data-atlas-depth="0"]')) {
        if (branch !== selectedRoot) branch.open = false;
      }
    }
    for (let branch = target?.closest<HTMLDetailsElement>('details') ?? null; branch; branch = branch.parentElement?.closest<HTMLDetailsElement>('details') ?? null) {
      branch.open = true;
    }
  };

  return Object.freeze({
    select,
    async reset() {
      for (const branch of root.querySelectorAll<HTMLDetailsElement>('details[data-atlas-depth]:not([data-atlas-depth="0"])')) branch.open = false;
      await select(selected);
    },
    destroy() { events.abort(); },
  });
}
