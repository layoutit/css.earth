import type { FindResult } from './find-protocol.mts';
import { requiredElement } from './browser-types.mts';

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

/** Searching shares the retained rows, but does not inherit an overview card. */
export function presentSearchResults(browser: HTMLElement, searching: boolean) {
  if (searching) browser.setAttribute('data-search-results', '');
  else browser.removeAttribute('data-search-results');
  // Typed results are a flat list; the tree stays for browsing, opened from the button beside the field.
  const navigation = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  if (navigation) navigation.hidden = searching;
  const results = requiredElement(browser, '#object-category-results');
  results.hidden = !searching;
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
