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
export function presentSearchResults(browser: HTMLElement, searching: boolean, category: string) {
  if (searching) browser.setAttribute('data-search-results', '');
  else browser.removeAttribute('data-search-results');
  const heading = browser.querySelector<HTMLElement>('[data-solar-system-results] > .planet-selected-panel');
  const tabs = browser.querySelector<HTMLElement>('[data-solar-system-results] > .planet-object-tabs');
  if (heading) heading.hidden = searching || category === 'nebula';
  if (tabs) tabs.hidden = searching;
  const results = requiredElement(browser, '#object-category-results');
  results.setAttribute('role', searching ? 'region' : 'tabpanel');
  if (searching) {
    results.setAttribute('aria-label', 'Search results');
    results.removeAttribute('aria-labelledby');
  } else {
    results.removeAttribute('aria-label');
    results.setAttribute('aria-labelledby', `object-tab-${category}`);
  }
}

export function presentFeatureResults(root: HTMLElement, count: number, message = '') {
  root.hidden = count === 0 && !message;
  const counter = root.querySelector<HTMLElement>('.planet-panel-heading-count');
  if (counter) counter.textContent = count ? `(${count})` : '';
  const hint = requiredElement(root, '.planet-destination-hint');
  hint.textContent = message;
  hint.hidden = !message;
}
