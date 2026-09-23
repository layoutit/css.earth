import { nextFrame } from "./next-frame.mts";
import { requiredElement } from './browser-types.mts';
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
  let matches: FindResult[] = [], query = documentTarget.querySelector<HTMLInputElement>('.object-sidebar-search')?.value.trim().toLocaleLowerCase('en') ?? '', revision = 0, destroyed = false;
  function clearRows() {
    matches = [];
    for (const button of buttons) button.parentElement!.hidden = true;
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
    if (destroyed) return;
    if (query !== value) { clearRows(); root.removeAttribute('open'); }
    query = value;
    const request = ++revision;
    inFlight?.abort(); inFlight = null;
    if (!value.trim() || !pin) { root.hidden = true; clearRows(); onResults(0); return; }
    root.hidden = matches.length === 0;
    try {
      // Typing faster than the page draws queues one search per keystroke. Wait for the next frame, by which time every
      // queued keystroke has arrived, and ask only for the newest text.
      await nextFrame(documentTarget);
      if (destroyed || request !== revision) return;
      const controller = inFlight = new AbortController();
      const results = await find(value, AbortSignal.any([events.signal, controller.signal]));
      if (destroyed || request !== revision) return;
      matches = results.slice(0, buttons.length);
      for (const [row, button] of buttons.entries()) {
        const result = matches[row];
        button.parentElement!.hidden = !result;
        if (!result) continue;
        requiredElement(button, '.object-destination-result-name').textContent = result.name;
        requiredElement(button, '.object-destination-result-context').textContent = result.context;
        button.ariaLabel = result.label;
        button.href = result.href;
      }
      presentFeatureResults(root, matches.length);
      onResults(matches.length);
    } catch {
      if (destroyed || request !== revision) return;
      presentFeatureResults(root, 0, 'Feature names could not load. Change your search to retry.');
      onResults(1);
    }
  }
  buttons.forEach((button, row) => button.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !matches[row]) return;
    // The ordinary link handler owns navigation for local and cross-body results alike.
    onSelected(matches[row]!);
  }, { signal: events.signal }));
  return Object.freeze({
    refresh() { if (!destroyed && query) void search(query); },
    search,
    destroy() { if (destroyed) return; destroyed = true; revision++; events.abort(); clearRows(); root.hidden = true; },
  });
}
