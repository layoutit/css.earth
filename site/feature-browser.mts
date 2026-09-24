import { nextFrame } from "./next-frame.mts";
import { presentFeatureResults } from './search-results-presentation.mts';

import { parseFeaturePin } from './feature-search.mts';
import { FIND_PATH, parseFindResults } from './find-protocol.mts';
import type { FindResult } from './find-protocol.mts';
export type { FindResult } from './find-protocol.mts';

/** Retained search rows over every body's named features, cities included. The search function ranks them, so the page
 * never downloads the index or a places catalogue. Every row is an ordinary feature URL; the application owns dataset selection and flight. */
export function createFeatureBrowser({ documentTarget, objectId, onSelected, onResults }: {
  documentTarget: Document; objectId: string; onSelected(result: FindResult): void; onResults(count: number): void;
}) {
  const candidate = documentTarget.querySelector<HTMLElement>('.object-feature-results');
  if (!candidate) return null;
  const root = candidate;
  const pin = parseFeaturePin(root.dataset.featureIndex);
  const buttons = [...root.querySelectorAll<HTMLAnchorElement>('.object-destination-result')];
  const events = new AbortController();
  const currentObjectId = () => documentTarget.body.dataset.objectShell || objectId;
  let inFlight: AbortController | null = null;
  let matches: FindResult[] = [], query = documentTarget.querySelector<HTMLInputElement>('.object-sidebar-search')?.value.trim().toLocaleLowerCase('en') ?? '';
  function clearRows() {
    matches = [];
    presentFeatureResults(root, matches);
  }
  async function find(value: string, signal: AbortSignal): Promise<FindResult[]> {
    const url = new URL(FIND_PATH, documentTarget.location?.href ?? 'http://localhost/');
    url.searchParams.set('object', currentObjectId());
    url.searchParams.set('q', value);
    const response = await fetch(url, { signal });
    if (!response.ok) throw new Error('Feature search failed.');
    return parseFindResults(await response.json());
  }
  async function search(value: string) {
    if (events.signal.aborted) return;
    if (query !== value) { matches = []; root.removeAttribute('open'); }
    query = value;
    inFlight?.abort();
    const controller = inFlight = new AbortController();
    const signal = AbortSignal.any([events.signal, controller.signal]);
    if (!value.trim() || !pin) { clearRows(); onResults(0); return; }
    presentFeatureResults(root, matches);
    try {
      // Typing faster than the page draws queues one search per keystroke. Wait for the next frame, by which time every
      // queued keystroke has arrived, and ask only for the newest text.
      await nextFrame(documentTarget);
      if (signal.aborted) return;
      const results = await find(value, signal);
      if (signal.aborted) return;
      matches = results.slice(0, buttons.length);
      presentFeatureResults(root, matches);
      onResults(matches.length);
    } catch {
      if (signal.aborted) return;
      matches = [];
      presentFeatureResults(root, matches, 'Feature names could not load. Change your search to retry.');
      onResults(1);
    }
  }
  buttons.forEach((button, row) => button.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !matches[row]) return;
    // The ordinary link handler owns navigation for local and cross-body results alike.
    onSelected(matches[row]!);
  }, { signal: events.signal }));
  return Object.freeze({
    refresh() { if (!events.signal.aborted && query) void search(query); },
    search,
    destroy() { if (events.signal.aborted) return; events.abort(); clearRows(); },
  });
}
