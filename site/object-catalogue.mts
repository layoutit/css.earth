import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import type { CatalogueIndexEntry } from './catalogue-index.mts';
import { requiredElement } from './browser-types.mts';
import { matchesObjectCategory } from './object-categories.mts';
import { sourceDocuments } from './source-link.mts';
import { objectSearchLabels, searchObjects, type ObjectSearchLabels } from './object-search.mts';
import { loadCatalogueFragment, loadCatalogueIndex, readCatalogueFragmentUrl, readCatalogueIndexUrl } from './catalogue-fragment-loader.mts';
import { createCatalogueWindow, type CatalogueSelection } from './catalogue-window.mts';

/** Own catalogue transport, search indices and the retained result rows. */
export function createObjectCatalogue({ documentTarget, windowTarget, browser, resultsPanel, lifetime, onLoad }: {
  documentTarget: Document;
  windowTarget: BrowserWindow;
  browser: HTMLElement;
  resultsPanel: HTMLElement;
  lifetime: SceneLifetime;
  onLoad(): void;
}) {
  let items = [...browser.querySelectorAll<HTMLElement>(".object-item")]
    .filter((item) => item instanceof windowTarget.HTMLLIElement);
  // Production pages ship the catalogue rows empty and name the shared JSON and
  // HTML transports (`catalogue-fragment-loader.mts`). A page or fixture that
  // names neither must still ship its rows inline.
  const catalogueUrl = items.length === 0 ? readCatalogueFragmentUrl(resultsPanel) : null;
  const catalogueIndexUrl = items.length === 0 ? readCatalogueIndexUrl(resultsPanel) : null;
  if (items.length === 0 && !catalogueIndexUrl && !catalogueUrl) {
    throw new Error("Object shell object browser has no objects.");
  }
  const remoteCatalogue = catalogueIndexUrl ?? catalogueUrl;
  const catalogueLoading = remoteCatalogue ? resultsPanel.querySelector<HTMLElement>('[data-catalogue-loading]') : null;
  const catalogueError = remoteCatalogue ? resultsPanel.querySelector<HTMLElement>('[data-catalogue-error]') : null;
  const catalogueRetry = catalogueError?.querySelector<HTMLButtonElement>('[data-catalogue-retry]') ?? null;
  type SearchLabel = ObjectSearchLabels & { readonly item?: HTMLElement; readonly entry?: CatalogueIndexEntry };
  let searchLabels: SearchLabel[] = items.map(item => ({ ...objectSearchLabels(item), item }));
  let catalogueEntries: readonly CatalogueIndexEntry[] = [];
  let matchedEntries = new Set<CatalogueIndexEntry>();
  let distanceEntries: readonly CatalogueIndexEntry[] = [];
  let objectEntries: readonly CatalogueIndexEntry[] = [];
  const catalogueList = resultsPanel.querySelector<HTMLUListElement>('[data-catalogue-list]');
  const catalogueWindow = catalogueIndexUrl && catalogueList
    ? createCatalogueWindow({ documentTarget, windowTarget, list: catalogueList, scrollTarget: resultsPanel }) : null;
  lifetime.onDispose(() => catalogueWindow?.destroy());
  let sourceLinks = sourceDocuments(documentTarget);
  let chunks = [...browser.querySelectorAll<HTMLElement>('.object-chunk')]
    .map(node => ({ node, items: [...node.querySelectorAll<HTMLElement>('.object-item')] }));
  const refreshChunks = () => {
    for (const { node, items: rows } of chunks) {
      const count = rows.filter(item => !item.hidden).length;
      if (node.hidden !== (count === 0)) node.hidden = count === 0;
      const height = `${Math.max(0, count * 28 - 8)}px`;
      if (node.style.containIntrinsicBlockSize !== height) node.style.containIntrinsicBlockSize = height;
    }
  };
  let chunkVisibility: { disconnect(): void } | null = null;
  const bindChunkVisibility = () => {
    chunkVisibility?.disconnect();
    chunkVisibility = null;
    if (chunks.length && typeof windowTarget.IntersectionObserver === 'function') {
      const observer = new windowTarget.IntersectionObserver(changes => {
        for (const { target, isIntersecting } of changes) target.toggleAttribute('data-in-view', isIntersecting);
      }, { root: resultsPanel, rootMargin: '100px 0px' });
      for (const { node } of chunks) observer.observe(node);
      resultsPanel.dataset.groupedVisibility = '';
      chunkVisibility = observer;
    }
  };
  bindChunkVisibility();
  lifetime.onDispose(() => chunkVisibility?.disconnect());
  browser.dataset.retained = '';
  let distanceOrder = items.toSorted((a, b) => Number(a.dataset.objectDistanceM) - Number(b.dataset.objectDistanceM));
  let objectOrder = [
    ...distanceOrder.filter(item => item.dataset.objectClassification === 'planet'),
    ...distanceOrder.filter(item => item.dataset.objectClassification !== 'planet'),
  ];
  /** Re-reads the catalogue rows after the shared fragment is inserted, so every
   * derived list (search labels, source links, grouped chunks, sort orders)
   * reflects the real rows instead of the empty placeholder. The fragment's own
   * rows already carry the same default-category `hidden` state a page used to
   * render inline. The browser reapplies its active search after loading. */
  const attachCatalogueRows = () => {
    items = [...browser.querySelectorAll<HTMLElement>(".object-item")]
      .filter((item) => item instanceof windowTarget.HTMLLIElement);
    searchLabels = items.map(item => ({ ...objectSearchLabels(item), item }));
    sourceLinks = sourceDocuments(documentTarget);
    chunks = [...browser.querySelectorAll<HTMLElement>('.object-chunk')]
      .map(node => ({ node, items: [...node.querySelectorAll<HTMLElement>('.object-item')] }));
    bindChunkVisibility();
    distanceOrder = items.toSorted((a, b) => Number(a.dataset.objectDistanceM) - Number(b.dataset.objectDistanceM));
    objectOrder = [
      ...distanceOrder.filter(item => item.dataset.objectClassification === 'planet'),
      ...distanceOrder.filter(item => item.dataset.objectClassification !== 'planet'),
    ];
    refreshChunks();
  };
  // Fetch once when opened, with retry after a failed transport.
  let catalogueLoad: Promise<void> | null = null;
  // Suppresses "No matching results" until the shared fragment has actually
  // arrived: an empty, not-yet-loaded catalogue must never be mistaken for a
  // catalogue that loaded and found nothing.
  let catalogueLoaded = !remoteCatalogue;
  const showCatalogueError = (show: boolean) => {
    if (catalogueLoading) catalogueLoading.hidden = show || catalogueLoaded;
    if (catalogueError) catalogueError.hidden = !show;
  };
  const ensureCatalogueLoaded = (): Promise<void> => {
    if (lifetime.disposed || !remoteCatalogue) return Promise.resolve();
    if (catalogueLoad) return catalogueLoad;
    showCatalogueError(false);
    const load = catalogueIndexUrl
      ? loadCatalogueIndex(catalogueIndexUrl, { windowTarget }).then(index => {
          if (lifetime.disposed) return;
          catalogueEntries = index.entries;
          searchLabels = catalogueEntries.map(entry => ({
            name: entry.name.toLocaleLowerCase('en'),
            names: entry.searchNames,
            classification: entry.classification,
            classificationName: entry.classificationName,
            systemName: entry.systemName,
            illustration: entry.illustration,
            candidate: entry.candidate,
            entry,
          }));
          distanceEntries = catalogueEntries.toSorted((left, right) => left.distanceMeters - right.distanceMeters);
          objectEntries = [
            ...distanceEntries.filter(entry => entry.classification === 'planet'),
            ...distanceEntries.filter(entry => entry.classification !== 'planet'),
          ];
          sourceLinks = new Map(sourceLinks);
          for (const entry of catalogueEntries) sourceLinks.set(entry.source.subject, { dataset: {
            sourceDocument: entry.source.document, sourceLabel: entry.source.label,
          } });
        })
      : loadCatalogueFragment(catalogueUrl!, { windowTarget }).then(rows => {
          if (lifetime.disposed) return;
          requiredElement(resultsPanel, '[data-catalogue-list]').replaceWith(rows);
          attachCatalogueRows();
        });
    catalogueLoad = load.then(() => {
      if (lifetime.disposed) return;
      catalogueLoaded = true;
      if (catalogueLoading) catalogueLoading.hidden = true;
      onLoad();
    }).catch((error: unknown) => {
      catalogueLoad = null;
      if (!lifetime.disposed) {
        // One warning covers the failure; the browser's own network log
        // already reports the failed request itself.
        console.warn('The object catalogue could not load.', error);
        showCatalogueError(true);
      }
    });
    return catalogueLoad;
  };
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  catalogueRetry?.addEventListener('click', () => { void ensureCatalogueLoaded(); }, { signal: events.signal });
  return {
    get loaded() { return catalogueLoaded; },
    get hasInlineRows() { return items.length > 0; },
    get windowed() { return catalogueWindow !== null; },
    get sources() { return sourceLinks; },
    ensureLoaded: ensureCatalogueLoaded,
    setSelection(selection: CatalogueSelection) { catalogueWindow?.setSelection(selection); },
    focus(index: number) { catalogueWindow?.focus(index); },
    clearWindow() { catalogueWindow?.clear(); },
    hideRows() { for (const item of items) item.hidden = true; catalogueWindow?.clear(); },
    showInlineRows() { for (const item of items) item.hidden = false; },
    search(query: string, category: string, options: { illustrations: boolean }) {
      const result = searchObjects(searchLabels, query, category, options);
      if (catalogueWindow) {
        matchedEntries = new Set(result.matches.flatMap(match => match.entry ? [match.entry] : []));
      } else {
        const matches = new Set(result.matches.flatMap(match => match.item ? [match.item] : []));
        for (const item of items) item.dataset.objectMatch = String(matches.has(item));
      }
      return result;
    },
    showCategory(classification: string, previousCategory: string): number {
      if (catalogueWindow) {
        const order = classification === 'planet' || classification === 'all' ? objectEntries : distanceEntries;
        const visible = order.filter(entry => matchedEntries.has(entry)
          && matchesObjectCategory(entry.classification, classification));
        catalogueWindow.setEntries(visible);
        return visible.length;
      }
      if (classification !== previousCategory) {
        const order = classification === 'planet' || classification === 'all' ? objectOrder : distanceOrder;
        for (const [index, chunk] of chunks.entries()) {
          chunk.items = order.slice(index * 16, (index + 1) * 16);
          requiredElement(chunk.node, '.object-chunk-list').append(...chunk.items);
        }
      }
      for (const item of items) item.hidden = item.dataset.objectMatch !== 'true'
        || !matchesObjectCategory(item.dataset.objectClassification, classification);
      refreshChunks();
      return items.filter(item => !item.hidden).length;
    },
  };
}
