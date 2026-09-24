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
  // One header per planetary system; the shell marks the current one.
  for (const heading of browser.querySelectorAll<HTMLElement>('[data-system-results] > .object-selected-panel')) heading.hidden = searching;
  // Typed results are a flat list; the tree stays for browsing, opened from the button beside the field.
  const navigation = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  if (navigation) navigation.hidden = searching;
  const results = requiredElement(browser, '#object-category-results');
  results.hidden = !searching;
}

export function presentFeatureResults(root: HTMLElement, count: number, message = '') {
  root.hidden = count === 0 && !message;
  const counter = root.querySelector<HTMLElement>('.object-panel-heading-count');
  if (counter) counter.textContent = count ? `(${count})` : '';
  const hint = requiredElement(root, '.object-destination-hint');
  hint.textContent = message;
  hint.hidden = !message;
}
