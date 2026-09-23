import { NAVIGATION_TREE_SCHEMA, type NavigationTreePayload, type NavigationTreeRecord } from '../src/navigation/navigation-tree-schema.mts';
import type { BrowserWindow } from './browser-types.mts';
import { record } from './browser-types.mts';

interface NavigationTreePin { url: string; sha256: string; bytes: number }

function readPin(root: HTMLElement): NavigationTreePin | null {
  const url = root.dataset.atlasTreeSrc;
  const sha256 = root.dataset.atlasTreeSha256;
  const bytes = Number(root.dataset.atlasTreeBytes);
  if (!url || !sha256 || !/^\/navigation-tree\/[a-f0-9]{64}\.json$/u.test(url) || !/^[a-f0-9]{64}$/u.test(sha256)
    || !url.includes(sha256) || !Number.isSafeInteger(bytes) || bytes <= 0) return null;
  return { url, sha256, bytes };
}

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
  const pin = readPin(root);
  const events = new AbortController();
  let selected = root.dataset.atlasCurrent ?? '';
  let payloadPromise: Promise<NavigationTreePayload> | null = null;
  let filterRevision = 0;

  const load = () => {
    if (!pin) return Promise.reject(new Error('Navigation tree has no deferred-data pin.'));
    if (!payloadPromise) payloadPromise = windowTarget.fetch(pin.url).then(async response => {
      if (!response.ok) throw new Error(`Navigation tree request failed: ${response.status}.`);
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength !== pin.bytes) throw new Error('Navigation tree size drifted.');
      const digest = [...new Uint8Array(await windowTarget.crypto.subtle.digest('SHA-256', buffer))]
        .map(byte => byte.toString(16).padStart(2, '0')).join('');
      if (digest !== pin.sha256) throw new Error('Navigation tree identity drifted.');
      return parsePayload(JSON.parse(new windowTarget.TextDecoder().decode(buffer)) as unknown);
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
    item.dataset.atlasItemKey = key;
    if (!node.children.length) {
      if (node.objectId) item.append(markerAnchor(node, false));
      return item;
    }
    const details = root.ownerDocument.createElement('details');
    details.dataset.atlasDepth = String(depth);
    details.dataset.atlasKey = key;
    details.dataset.atlasLazy = '';
    if (!node.objectId) details.dataset.atlasGroup = node.label.toLocaleLowerCase('en');
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
    if (!target && pin) {
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
    async filter(objectIds: readonly string[] | null) {
      const revision = ++filterRevision;
      if (objectIds === null) {
        root.removeAttribute('data-atlas-filtered');
        for (const item of root.querySelectorAll<HTMLElement>('li[data-atlas-item-key]')) item.hidden = false;
        for (const branch of root.querySelectorAll<HTMLDetailsElement>('details[data-atlas-depth]:not([data-atlas-depth="0"])')) branch.open = false;
        await select(selected);
        return;
      }
      root.setAttribute('data-atlas-filtered', '');
      root.ariaBusy = 'true';
      try {
        if (!pin) {
          const matches = new Set(objectIds);
          for (const item of root.querySelectorAll<HTMLElement>('li[data-atlas-item-key]')) {
            item.hidden = ![...item.querySelectorAll<HTMLElement>('a[data-atlas-object]')]
              .some(anchor => matches.has(anchor.dataset.atlasObject ?? ''));
          }
          return;
        }
        const payload = await load();
        if (revision !== filterRevision) return;
        const parent = new Map<string, string>();
        const keyByObject = new Map<string, string>();
        for (const [key, node] of Object.entries(payload.nodes)) {
          if (node.objectId) keyByObject.set(node.objectId, key);
          for (const child of node.children) parent.set(child, key);
        }
        const matched = new Set(objectIds.map(id => keyByObject.get(id)).filter((key): key is string => Boolean(key)));
        const retained = new Set<string>();
        for (const match of matched) for (let key: string | undefined = match; key; key = parent.get(key)) retained.add(key);
        for (const match of matched) {
          const path: string[] = [];
          for (let key: string | undefined = match; key; key = parent.get(key)) path.unshift(key);
          for (const key of path.slice(0, -1)) {
            const details = detailsByKey(key);
            if (!details) break;
            await materialize(details, payload);
          }
        }
        if (revision !== filterRevision) return;
        for (const item of root.querySelectorAll<HTMLElement>('li[data-atlas-item-key]')) {
          item.hidden = !retained.has(item.dataset.atlasItemKey ?? '');
        }
        for (const details of root.querySelectorAll<HTMLDetailsElement>('details[data-atlas-key]')) {
          const node = payload.nodes[details.dataset.atlasKey ?? ''];
          details.open = Boolean(node?.children.some(child => retained.has(child)));
        }
      } catch (error) { report(error); }
      finally { if (revision === filterRevision) root.removeAttribute('aria-busy'); }
    },
    destroy() { events.abort(); },
  });
}
