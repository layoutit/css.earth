import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import type { CatalogueIndexEntry } from './catalogue-index.mts';
import { requiredElement } from './browser-types.mts';
import { createCatalogueRows } from './search-results-presentation.mts';
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
  let rows = createCatalogueRows(browser);
  let items = rows.items
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
  type SearchLabel = ObjectSearchLabels & { readonly distanceMeters: number; readonly item?: HTMLElement; readonly entry?: CatalogueIndexEntry };
  // Every live result uses planets first, then distance. A classification search
  // already excludes other classes, so it needs no second category or sort order.
  const resultOrder = (a: SearchLabel, b: SearchLabel) => Number(b.classification === 'planet') - Number(a.classification === 'planet')
    || a.distanceMeters - b.distanceMeters;
  let searchLabels: SearchLabel[] = [];
  const catalogueList = resultsPanel.querySelector<HTMLUListElement>('[data-catalogue-list]');
  const catalogueWindow = catalogueIndexUrl && catalogueList
    ? createCatalogueWindow({ documentTarget, windowTarget, list: catalogueList, scrollTarget: resultsPanel }) : null;
  lifetime.onDispose(() => catalogueWindow?.destroy());
  let sourceLinks = sourceDocuments(documentTarget);
  let chunkVisibility: { disconnect(): void } | null = null;
  const bindChunkVisibility = () => {
    chunkVisibility?.disconnect();
    chunkVisibility = null;
    if (rows.chunks.length && typeof windowTarget.IntersectionObserver === 'function') {
      const observer = new windowTarget.IntersectionObserver(changes => {
        for (const { target, isIntersecting } of changes) target.toggleAttribute('data-in-view', isIntersecting);
      }, { root: resultsPanel, rootMargin: '100px 0px' });
      for (const { node } of rows.chunks) observer.observe(node);
      resultsPanel.dataset.groupedVisibility = '';
      chunkVisibility = observer;
    }
  };
  lifetime.onDispose(() => chunkVisibility?.disconnect());
  browser.dataset.retained = '';
  const attachCatalogueRows = () => {
    rows = createCatalogueRows(browser);
    items = rows.items
      .filter((item) => item instanceof windowTarget.HTMLLIElement);
    searchLabels = items.map(item => ({ ...objectSearchLabels(item), distanceMeters: Number(item.dataset.objectDistanceM), item })).sort(resultOrder);
    sourceLinks = sourceDocuments(documentTarget);
    bindChunkVisibility();
    rows.order(searchLabels.map(label => label.item!));
    rows.refresh();
  };
  if (items.length) attachCatalogueRows();
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
          searchLabels = index.entries.map(entry => ({
            name: entry.name.toLocaleLowerCase('en'),
            names: entry.searchNames,
            classification: entry.classification,
            classificationName: entry.classificationName,
            systemName: entry.systemName,
            illustration: entry.illustration,
            candidate: entry.candidate,
            distanceMeters: entry.distanceMeters,
            entry,
          })).sort(resultOrder);
          sourceLinks = new Map(sourceLinks);
          for (const entry of index.entries) sourceLinks.set(entry.source.subject, { dataset: {
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
    get windowed() { return catalogueWindow !== null; },
    get sources() { return sourceLinks; },
    ensureLoaded: ensureCatalogueLoaded,
    setSelection(selection: CatalogueSelection) { catalogueWindow?.setSelection(selection); },
    focus(index: number) { catalogueWindow?.focus(index); },
    clearWindow() { catalogueWindow?.clear(); },
    showInlineRows() { for (const item of items) item.hidden = false; },
    search(query: string, options: { illustrations: boolean }) {
      const result = searchObjects(searchLabels, query, options);
      if (catalogueWindow) {
        catalogueWindow.setEntries(result.matches.flatMap(match => match.entry ? [match.entry] : []));
      } else {
        const matches = new Set(result.matches.map(match => match.item));
        for (const item of items) item.hidden = !matches.has(item);
        rows.refresh();
      }
      return result;
    },
  };
}
