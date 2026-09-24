import type { FindResult } from './find-protocol.mts';
import { requiredElement, setPanelHidden } from './browser-types.mts';

/** Keep existing overview destinations reachable as ordinary search rows. */
export function presentOverviewResults(browser: HTMLElement, value: string) {
  const query = value.trim().toLocaleLowerCase('en');
  let count = 0;
  for (const row of browser.querySelectorAll<HTMLElement>('[data-search-overview]')) {
    row.hidden = !query || !row.dataset.searchOverview?.includes(query);
    if (!row.hidden) count++;
  }
  return count;
}

/** Native requests and live interactions publish the same retained sidebar.
 * Opening the browser and searching are separate states: an empty live query shows the tree. */
export function createSearchPresentation(documentTarget: Document) {
  const browser = requiredElement<HTMLElement>(documentTarget, '.object-browser');
  const selectedContent = requiredElement<HTMLElement>(documentTarget, '.object-selected-content');
  const navigation = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  const results = requiredElement<HTMLElement>(browser, '#object-category-results');
  const empty = requiredElement<HTMLElement>(browser, '.object-empty');
  const categories = [...documentTarget.querySelectorAll<HTMLElement>('.object-search-category')];
  return {
    present(open: boolean, searching: boolean) {
      setPanelHidden(browser, !open);
      setPanelHidden(selectedContent, open);
      browser.setAttribute('aria-label', searching ? 'Search results' : 'Celestial objects');
      browser.toggleAttribute('data-search-results', searching);
      // Selection publication never changes this visibility; the query owns it.
      if (navigation) navigation.hidden = searching;
      results.hidden = !searching;
    },
    markCategory(classification: string | null | undefined = null) {
      let selected: string | null = null;
      for (const button of categories) {
        const active = button.dataset.searchClassification === classification;
        button.setAttribute('aria-pressed', String(active));
        if (active) selected = classification ?? null;
      }
      return selected;
    },
    setEmptyHidden(hidden: boolean, loaded: boolean) { empty.hidden = hidden || !loaded; },
  };
}

/** Catalogue fragments use the same retained chunks in native and live search. */
export function createCatalogueRows(browser: HTMLElement) {
  const items = [...browser.querySelectorAll<HTMLElement>('.object-item')];
  const chunks = [...browser.querySelectorAll<HTMLElement>('.object-chunk')]
    .map(node => ({ node, items: [...node.querySelectorAll<HTMLElement>('.object-item')] }));
  return {
    items, chunks,
    order(ordered: readonly HTMLElement[]) {
      for (const [index, chunk] of chunks.entries()) {
        chunk.items = ordered.slice(index * 16, (index + 1) * 16);
        requiredElement(chunk.node, '.object-chunk-list').append(...chunk.items);
      }
    },
    refresh() {
      for (const { node, items: rows } of chunks) {
        const count = rows.filter(item => !item.hidden).length;
        if (node.hidden !== (count === 0)) node.hidden = count === 0;
        const height = `${Math.max(0, count * 28 - 8)}px`;
        if (node.style.containIntrinsicBlockSize !== height) node.style.containIntrinsicBlockSize = height;
      }
    },
  };
}

/** Native responses and live search publish the same retained result rows. */
export function presentFeatureResults(root: HTMLElement, results: readonly FindResult[], message = '') {
  const anchors = [...root.querySelectorAll<HTMLAnchorElement>('.object-destination-result')];
  const count = Math.min(results.length, anchors.length);
  for (const [index, anchor] of anchors.entries()) {
    const result = results[index];
    anchor.parentElement!.hidden = !result;
    if (!result) continue;
    anchor.setAttribute('href', result.href);
    anchor.setAttribute('aria-label', result.label);
    requiredElement(anchor, '.object-destination-result-name').textContent = result.name;
    requiredElement(anchor, '.object-destination-result-context').textContent = result.context;
  }
  root.hidden = count === 0 && !message;
  const counter = root.querySelector<HTMLElement>('.object-panel-heading-count');
  if (counter) counter.textContent = count ? `(${count})` : '';
  const hint = requiredElement(root, '.object-destination-hint');
  hint.textContent = message;
  hint.hidden = !message;
  return count;
}
