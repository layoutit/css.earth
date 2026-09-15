import type { BrowserWindow } from './browser-types.mts';
import type { SceneLifetime } from '@cssearth/engine';

/** The source list follows the shell's selection, including while its search is open. */
export function renderSourcePanel(document: Document) {
  const panel = document.querySelector<HTMLElement>('[data-source-panel]');
  if (!panel) return;
  const owner = panel.querySelector<HTMLElement>('[data-source-owner]');
  const browser = document.querySelector<HTMLElement>('.planet-object-browser');
  const scope = browser?.dataset.sourceScope ?? 'object';
  const banks = [...panel.querySelectorAll<HTMLElement>('[data-source-bank]')];
  const selected = new Set<string>();
  let label = owner?.dataset.sourceName ?? '';
  if (scope === 'focus') {
    const record = [...panel.querySelectorAll<HTMLElement>('[data-source-record]')].find(row => row.dataset.sourceRecord === browser?.dataset.sourceFocus);
    if (record) {
      label = record.dataset.sourceRecordName ?? label;
      for (const citation of record.dataset.sourceCitations?.split(' ') ?? []) selected.add(citation);
      const host = [...document.querySelectorAll<HTMLElement>('[data-focus-lens-bank]')].find(host => host.dataset.focusLensBank === record.dataset.sourceRecordObject);
      const lens = host?.querySelector<HTMLButtonElement>('button[name="focusLens"][aria-pressed="true"]')?.getAttribute('value');
      if (lens) selected.add(`focus:${record.dataset.sourceRecordObject}:${lens}`);
    }
  } else if (['solar-system', 'milky-way', 'local-group', 'nearby-universe'].includes(scope)) {
    selected.add(`scope:${scope}`);
    label = banks.find(bank => bank.dataset.sourceBank === `scope:${scope}`)?.dataset.sourceLabel ?? label;
  } else {
    const lens = document.querySelector<HTMLButtonElement>('.planet-information-panel button[name="dataset"][aria-pressed="true"]')?.getAttribute('value');
    if (lens) selected.add(`body:${lens}`);
    selected.add('object'); selected.add('scope:sky');
  }
  const seen = new Set<string>();
  for (const bank of banks) {
    const active = selected.has(bank.dataset.sourceBank ?? '');
    if (bank.hidden !== !active) bank.hidden = !active;
    if (!active) continue;
    let count = 0;
    for (const row of bank.querySelectorAll<HTMLElement>('.planet-resource-row')) {
      let rowCount = 0;
      for (const link of row.querySelectorAll<HTMLAnchorElement>('a[href]')) {
        const url = new URL(link.getAttribute('href')!, 'https://sources.invalid'); url.hash = '';
        const key = url.href.replace(/\/$/u, '');
        const duplicate = seen.has(key);
        if (link.hidden !== duplicate) link.hidden = duplicate;
        if (!duplicate) { seen.add(key); rowCount++; }
      }
      if (row.hidden !== (rowCount === 0)) row.hidden = rowCount === 0;
      const supporting = row.querySelector<HTMLElement>('.planet-resource-supporting');
      if (supporting) {
        const count = supporting.querySelectorAll('a:not([hidden])').length;
        if (supporting.hidden !== (count === 0)) supporting.hidden = count === 0;
        const summary = supporting.querySelector('summary');
        const text = `${count} supporting ${count === 1 ? 'file' : 'files'}`;
        if (summary && summary.textContent !== text) summary.textContent = text;
      }
      count += rowCount;
    }
    if (count === 0) bank.hidden = true;
  }
  const view = panel.querySelector('[data-source-view]');
  if (view && view.textContent !== label) view.textContent = label;
  const count = panel.querySelector('.planet-panel-heading-count');
  if (count && count.textContent !== `(${seen.size})`) count.textContent = `(${seen.size})`;
}

export function createSourcePanelController(drawer: HTMLElement, document: Document, window: BrowserWindow, lifetime: SceneLifetime) {
  const observer = document.querySelector('[data-source-panel]') ? new window.MutationObserver(() => renderSourcePanel(document)) : null;
  observer?.observe(drawer, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'data-source-scope', 'data-source-focus'] });
  renderSourcePanel(document);
  const destroy = () => observer?.disconnect();
  lifetime.onDispose(destroy);
  return { destroy };
}
