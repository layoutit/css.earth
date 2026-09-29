import type { FindResult } from './find-protocol.mts';
import { requiredElement, setPanelHidden } from '../browser/browser-types.mts';

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

/** Native requests and live interactions publish the same retained sidebar. */
export function createSearchPresentation(documentTarget: Document) {
  const browser = requiredElement<HTMLElement>(documentTarget, '.object-browser');
  const selectedContent = requiredElement<HTMLElement>(documentTarget, '.object-selected-content');
  const results = requiredElement<HTMLElement>(browser, '#object-category-results');
  const empty = requiredElement<HTMLElement>(browser, '.object-empty');
  const categories = [...documentTarget.querySelectorAll<HTMLElement>('.object-search-category')];
  return {
    present(open: boolean, searching: boolean) {
      setPanelHidden(browser, !open);
      setPanelHidden(selectedContent, open);
      browser.setAttribute('aria-label', searching ? 'Search results' : 'Celestial objects');
      browser.toggleAttribute('data-search-results', searching);
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
    setEmptyHidden(hidden: boolean) { if (empty.hidden !== hidden) empty.hidden = hidden; },
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
