import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from '../browser/browser-types.mts';
import { requiredElement } from '../browser/browser-types.mts';
import { nextFrame } from '../next-frame.mts';
import { sourceDocuments, type SourceDocumentReference } from '../source-link.mts';
import { createCatalogueWindow, type CatalogueSelection } from '../catalogue/catalogue-window.mts';
import { FIND_PAGE_ROWS, FIND_PATH, parseFindResponse, type FindResponse } from './find-protocol.mts';

/** What a settled search found; `features` is null when feature names could not load. */
export interface SearchOutcome { readonly objects: number; readonly classification: string | null; readonly features: FindResponse['features']; }

/** One request per search: the find function answers the object rows and the feature rows together, and the page shows
 * them together. The rows on screen stay until the next answer replaces them, so typing never blanks the list. */
export function createSearchClient({ documentTarget, windowTarget, resultsPanel, lifetime, readObjectId, onResults }: {
  documentTarget: Document;
  windowTarget: BrowserWindow;
  resultsPanel: HTMLElement;
  lifetime: SceneLifetime;
  readObjectId(): string;
  /** A search settled, or failed (null). */
  onResults(outcome: SearchOutcome | null): void;
}) {
  const error = requiredElement<HTMLElement>(resultsPanel, '[data-search-error]');
  const retry = requiredElement<HTMLButtonElement>(error, '[data-search-retry]');
  const list = requiredElement<HTMLUListElement>(resultsPanel, '[data-catalogue-list]');
  // Source links of the rows received so far: choosing a row presents its source in the footer.
  const sources = sourceDocuments(documentTarget);
  // The search on screen; each page request belongs to one search.
  let current: { query: string; illustrations: boolean } | null = null;
  // A newer search cancels the older request. Letting every keystroke's answer land made the final answer later on a
  // slow phone connection (2.84 s against 2.4 s): broad early queries return full pages that compete for bandwidth.
  let inFlight: AbortController | null = null;
  const pages = new Map<number, AbortController>();
  const events = new AbortController();
  lifetime.onDispose(() => { events.abort(); inFlight?.abort(); for (const page of pages.values()) page.abort(); });

  const request = async (query: string, illustrations: boolean, offset: number, signal: AbortSignal) => {
    const url = new URL(FIND_PATH, documentTarget.location?.href ?? 'http://localhost/');
    url.searchParams.set('object', readObjectId());
    url.searchParams.set('q', query);
    if (offset) url.searchParams.set('offset', String(offset));
    if (illustrations) url.searchParams.set('illustrations', '1');
    const response = await windowTarget.fetch(url, { signal });
    if (!response.ok) throw new Error(`Search request failed: ${response.status}.`);
    const result = parseFindResponse(await response.json());
    for (const row of result.objects.rows) sources.set(row.source.subject, { dataset: { sourceDocument: row.source.document, sourceLabel: row.source.label } });
    return result;
  };
  const cancelPages = () => { for (const page of pages.values()) page.abort(); pages.clear(); };
  const rows = createCatalogueWindow({ documentTarget, windowTarget, list, scrollTarget: resultsPanel, onMissing(index) {
    const search = current, offset = Math.floor(index / FIND_PAGE_ROWS) * FIND_PAGE_ROWS;
    if (!search || pages.has(offset)) return;
    const controller = new AbortController();
    pages.set(offset, controller);
    const signal = AbortSignal.any([events.signal, controller.signal]);
    request(search.query, search.illustrations, offset, signal).then(result => {
      if (signal.aborted || current !== search) return;
      rows.addRows(result.objects.offset, result.objects.rows);
    }).catch((reason: unknown) => {
      if (signal.aborted) return;
      // The rows stay unrequested; scrolling back to them asks again.
      console.warn('A page of search results could not load.', reason);
    }).finally(() => { if (pages.get(offset) === controller) pages.delete(offset); });
  } });
  lifetime.onDispose(() => rows.destroy());

  const showError = (show: boolean) => { if (error.hidden === show) error.hidden = !show; };
  const setBusy = (busy: boolean) => { if (resultsPanel.ariaBusy !== String(busy)) resultsPanel.ariaBusy = String(busy); };
  let lastRequest: { query: string; illustrations: boolean } | null = null;
  async function search(query: string, illustrations: boolean) {
    if (events.signal.aborted) return;
    inFlight?.abort();
    const controller = inFlight = new AbortController();
    const signal = AbortSignal.any([events.signal, controller.signal]);
    lastRequest = { query, illustrations };
    setBusy(true);
    try {
      // Typing faster than the page draws queues one search per keystroke. Wait for the next frame, by which time every
      // queued keystroke has arrived, and ask only for the newest text.
      await nextFrame(documentTarget);
      if (signal.aborted) return;
      const result = await request(query, illustrations, 0, signal);
      if (signal.aborted) return;
      cancelPages();
      current = { query, illustrations };
      showError(false);
      rows.setRows(result.objects.total, 0, result.objects.rows);
      onResults({ objects: result.objects.total, classification: result.classification, features: result.features });
    } catch (reason) {
      if (signal.aborted) return;
      console.warn('Search results could not load.', reason);
      showError(true);
      onResults(null);
    } finally {
      if (inFlight === controller) { inFlight = null; setBusy(false); }
    }
  }
  retry.addEventListener('click', () => { if (lastRequest) void search(lastRequest.query, lastRequest.illustrations); }, { signal: events.signal });

  return Object.freeze({
    search,
    /** Leave the search: nothing stays in flight and no rows stay connected. */
    clear() {
      inFlight?.abort();
      inFlight = null;
      cancelPages();
      current = lastRequest = null;
      setBusy(false);
      showError(false);
      rows.clear();
    },
    get sources(): ReadonlyMap<string, SourceDocumentReference> { return sources; },
    setSelection(selection: CatalogueSelection) { rows.setSelection(selection); },
    focus(index: number) { return rows.focus(index); },
  });
}
