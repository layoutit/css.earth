import { presentFeatureResults } from './search/search-results-presentation.mts';
import { sectionElement } from './browser/browser-types.mts';
import type { FindResult } from './search/find-protocol.mts';
export type { FindResult } from './search/find-protocol.mts';

/** Retained search rows over every body's named features, cities included. The search client receives them with the
 * object rows in one answer; every row is an ordinary feature URL, and the application owns dataset selection and flight. */
export function createFeatureBrowser({ documentTarget, onSelected }: {
  documentTarget: Document; onSelected(result: FindResult): void;
}) {
  const candidate = sectionElement(documentTarget, '.object-feature-results');
  if (!candidate) return null;
  const root = candidate;
  const buttons = [...root.querySelectorAll<HTMLAnchorElement>('.object-destination-result')];
  const events = new AbortController();
  let matches: readonly FindResult[] = [], query = '';
  buttons.forEach((button, row) => button.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !matches[row]) return;
    // The ordinary link handler owns navigation for local and cross-body results alike.
    onSelected(matches[row]!);
  }, { signal: events.signal }));
  return Object.freeze({
    /** Show a search's feature rows; null when feature names could not load. Returns the rows shown. */
    present(value: string, results: readonly FindResult[] | null) {
      if (events.signal.aborted) return 0;
      // A new query collapses the list its previous query opened.
      if (query !== value) root.removeAttribute('open');
      query = value;
      matches = (results ?? []).slice(0, buttons.length);
      return presentFeatureResults(root, matches, results === null ? 'Feature names could not load. Change your search to retry.' : '');
    },
    destroy() { if (events.signal.aborted) return; events.abort(); matches = []; presentFeatureResults(root, matches); },
  });
}
