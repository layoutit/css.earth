import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import type { OverviewScope } from './overview-context.mts';
import type { ShellOverview, ShellSubject } from './shell-selection.mts';
import type { PreparedDestinationRuntime, SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { CatalogueIndexEntry } from './catalogue-index.mts';
import { requiredElement } from './browser-types.mts';
import { selectGalaxyNeighbor } from './galaxy-neighbor-selection.mts';
import { matchesObjectCategory, objectCategoryCount } from './object-categories.mts';
import { renderSourceLink, sourceDocuments } from './source-link.mts';
import { createDestinationBrowser } from './destination-browser.mts';
import { createFeatureBrowser } from './feature-browser.mts';
import { objectSearchLabels, searchObjects, type ObjectSearchLabels } from './object-search.mts';
import { presentOverviewResults, presentSearchResults } from './search-results-presentation.mts';
import { loadCatalogueFragment, loadCatalogueIndex, readCatalogueFragmentPin, readCatalogueIndexPin } from './catalogue-fragment-loader.mts';
import { createCatalogueWindow } from './catalogue-window.mts';
import { createNavigationTreeController } from './navigation-tree-client.mts';
import { SCENE_OBJECTS } from './objects.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';
import { objectClassificationLabel } from './search-objects.mts';

export interface ObjectBrowserOptions {
  readSelection(): ShellSubject;
  onCategoryChange?(classification: string | null): void;
  illustrationModelsEnabled?: boolean;
}

interface SubjectOverride {
  readonly subject: ShellSubject;
  hideFocus: boolean;
}

export function createObjectBrowserController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime,
  { readSelection, onCategoryChange = () => {}, illustrationModelsEnabled = false }: ObjectBrowserOptions) {
  // Browsing a system keeps the committed focus; a flight preview temporarily
  // covers it. Neither changes which scene or focus the shell owns.
  let subjectOverride: SubjectOverride | null = null;
  const currentSubject = (): ShellSubject => {
    const committed = readSelection();
    return subjectOverride && (subjectOverride.hideFocus || committed.kind !== 'focus')
      ? subjectOverride.subject : committed;
  };
  const setPanelHidden = (panel: HTMLElement, hidden: boolean) => {
    if (panel.hidden !== hidden) panel.hidden = hidden;
    const inert = hidden || panel.ariaBusy === 'true';
    if (panel.inert !== inert) panel.inert = inert;
  };
  const search = documentTarget.querySelector(".object-sidebar-search");
  const searchCard = documentTarget.querySelector(".object-sidebar-search-card");
  const trigger = documentTarget.querySelector(".object-sidebar-view-all");
  const information = documentTarget.querySelector(".object-information-panel");
  const browser = documentTarget.querySelector(".object-browser");
  const selectedContent = documentTarget.querySelector(".object-selected-content");
  const empty = documentTarget.querySelector(".object-empty");
  if (!(search instanceof windowTarget.HTMLInputElement) ||
      !(searchCard instanceof windowTarget.HTMLElement) ||
      !(trigger instanceof windowTarget.HTMLButtonElement) ||
      !(information instanceof windowTarget.HTMLElement) ||
      !(browser instanceof windowTarget.HTMLElement) ||
      !(selectedContent instanceof windowTarget.HTMLElement) ||
      !(empty instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell object browser is incomplete.");
  }
  // Search/navigation and the selection share one sidebar content owner. The
  // selected content stays retained while the browser temporarily replaces it.
  const context = documentTarget.querySelector<HTMLElement>('.object-context') ?? browser;
  const sharedLegacyContext = context === browser;
  const galaxy = context.querySelector<HTMLElement>('[data-galactic-overview]');
  const largeScaleCards = [...context.querySelectorAll<HTMLElement>('[data-large-scale-overview]')];
  const focusCard = context.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const system = context.querySelector<HTMLElement>('[data-system-results]');
  const systemHeaders = [...(system?.querySelectorAll<HTMLElement>('[data-system-header]') ?? [])];
  const solarSystemFacts = system?.querySelector<HTMLElement>('[data-solar-system-facts]');
  // A dataset that draws what a whole system shares, a debris disc around its star, is the system's, not the body's. Its
  // option and its details move to the system card while that system is the selection, and return to the body card after.
  const systemDatasets = system?.querySelector<HTMLElement>('[data-system-datasets]') ?? null;
  const systemDatasetOptions = systemDatasets?.querySelector<HTMLElement>('[data-system-dataset-options]') ?? null;
  const systemDatasetDetails = systemDatasets?.querySelector<HTMLElement>('[data-system-dataset-details]') ?? null;
  const volumeOptions = [...documentTarget.querySelectorAll<HTMLElement>('.object-information-panel [data-lens-volume]')]
    .map(option => ({ option, home: option.parentElement, next: option.nextElementSibling,
      details: documentTarget.querySelector<HTMLElement>(`.object-information-panel [data-lens-volume-details="${option.dataset.lensVolume ?? ''}"]`) }))
    .map(entry => ({ ...entry, detailsHome: entry.details?.parentElement ?? null, detailsNext: entry.details?.nextElementSibling ?? null }));
  const placeVolumeDatasets = (onSystemCard: boolean) => {
    if (!systemDatasets || !systemDatasetOptions || !systemDatasetDetails || !volumeOptions.length) return;
    for (const entry of volumeOptions) {
      const optionTarget = onSystemCard ? systemDatasetOptions : entry.home;
      if (optionTarget && entry.option.parentElement !== optionTarget) {
        if (onSystemCard) optionTarget.append(entry.option);
        else optionTarget.insertBefore(entry.option, entry.next);
      }
      const detailsTarget = onSystemCard ? systemDatasetDetails : entry.detailsHome;
      if (entry.details && detailsTarget && entry.details.parentElement !== detailsTarget) {
        if (onSystemCard) detailsTarget.append(entry.details);
        else detailsTarget.insertBefore(entry.details, entry.detailsNext);
      }
    }
    systemDatasets.hidden = !onSystemCard;
  };
  const navigationRoot = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  const navigation = navigationRoot ? createNavigationTreeController(navigationRoot, windowTarget) : null;
  lifetime.onDispose(() => navigation?.destroy());
  const selectNavigation = (current: string) => {
    if (!navigationRoot) return;
    // A selection change (a flight arriving) must not bring the tree back over typed results.
    navigationRoot.hidden = showingSearchResults;
    void navigation?.select(current);
  };
  const tabs = [...browser.querySelectorAll<HTMLElement>('[data-object-tab]')];
  const resultsPanel = requiredElement(browser, '#object-category-results');
  let items = [...browser.querySelectorAll<HTMLElement>(".object-item")]
    .filter((item) => item instanceof windowTarget.HTMLLIElement);
  // Production pages ship the catalogue rows empty and reference shared,
  // content-addressed JSON and HTML transports (`catalogue-fragment-pin.mts`).
  // A page or fixture without either pin must still ship its rows inline.
  const cataloguePin = items.length === 0 ? readCatalogueFragmentPin(resultsPanel) : null;
  const catalogueIndexPin = items.length === 0 ? readCatalogueIndexPin(resultsPanel) : null;
  if (items.length === 0 && !catalogueIndexPin && !cataloguePin) {
    throw new Error("Object shell object browser has no objects.");
  }
  const remoteCatalogue = catalogueIndexPin ?? cataloguePin;
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
  const catalogueWindow = catalogueIndexPin && catalogueList
    ? createCatalogueWindow({ documentTarget, windowTarget, list: catalogueList, scrollTarget: resultsPanel }) : null;
  lifetime.onDispose(() => catalogueWindow?.destroy());
  let sourceLinks = sourceDocuments(documentTarget);
  const collapseSolarSystemBranches = () => {
    if (!navigationRoot) return;
    for (const branch of navigationRoot.querySelectorAll<HTMLDetailsElement>('details[data-atlas-depth]:not([data-atlas-depth="0"])')) {
      branch.open = false;
    }
    const solarSystem = navigationRoot.querySelector<HTMLDetailsElement>('details[data-atlas-depth="0"][data-atlas-key="solar-system"]');
    if (solarSystem) solarSystem.open = true;
  };
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
  information.dataset.retained = '';
  let distanceOrder = items.toSorted((a, b) => Number(a.dataset.objectDistanceM) - Number(b.dataset.objectDistanceM));
  let objectOrder = [
    ...distanceOrder.filter(item => item.dataset.objectClassification === 'planet'),
    ...distanceOrder.filter(item => item.dataset.objectClassification !== 'planet'),
  ];
  /** Re-reads the catalogue rows after the shared fragment is inserted, so every
   * derived list (search labels, source links, grouped chunks, sort orders)
   * reflects the real rows instead of the empty placeholder. The fragment's own
   * rows already carry the same default-category `hidden` state a page used to
   * render inline, and an open panel is repaired by the `filter()` call that
   * follows this, so no hidden state is recomputed here. */
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
  // Fetches the shared catalogue transport at most once, when the browser panel
  // first opens. `filter` and
  // `markSelection` are declared further down this closure but only run once
  // this promise settles, well after the whole controller has been built.
  let catalogueLoad: Promise<void> | null = null;
  // Suppresses "No matching results" until the shared fragment has actually
  // arrived: an empty, not-yet-loaded catalogue must never be mistaken for a
  // catalogue that loaded and found nothing.
  let catalogueLoaded = !remoteCatalogue;
  const setEmptyHidden = (hidden: boolean) => { empty.hidden = hidden || !catalogueLoaded; };
  const showCatalogueError = (show: boolean) => {
    if (catalogueLoading) catalogueLoading.hidden = show || catalogueLoaded;
    if (catalogueError) catalogueError.hidden = !show;
  };
  const ensureCatalogueLoaded = (): Promise<void> => {
    if (!remoteCatalogue) return Promise.resolve();
    if (catalogueLoad) return catalogueLoad;
    showCatalogueError(false);
    const load = catalogueIndexPin
      ? loadCatalogueIndex(catalogueIndexPin, { windowTarget }).then(index => {
          catalogueEntries = index.entries;
          searchLabels = catalogueEntries.map(entry => ({
            name: entry.name.toLocaleLowerCase('en'),
            names: entry.searchNames,
            classification: entry.classification,
            classificationName: entry.classificationName,
            systemName: entry.systemName,
            illustration: entry.illustration,
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
      : loadCatalogueFragment(cataloguePin!, { windowTarget }).then(rows => {
          requiredElement(resultsPanel, '[data-catalogue-list]').replaceWith(rows);
          attachCatalogueRows();
        });
    catalogueLoad = load.then(() => {
      if (lifetime.disposed) return;
      catalogueLoaded = true;
      if (catalogueLoading) catalogueLoading.hidden = true;
      markSelection();
      publishSourceContext();
      if (open) { filteredQuery = null; filter(false); }
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
  let activeCategory = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.objectTab ?? 'planet';
  let showingSearchResults = false;
  let initialCategory: string | null = searchCard.hasAttribute('data-search-submitted') ? activeCategory : null;
  // Scroll events arrive after layout. Retain that state so publishing an
  // unchanged camera or selection never forces layout to rewrite a zero offset.
  let resultsScrolled = false;
  const onResultsScroll = () => { resultsScrolled = resultsPanel.scrollTop !== 0; };
  resultsPanel.addEventListener('scroll', onResultsScroll, { passive: true });
  lifetime.onDispose(() => resultsPanel.removeEventListener('scroll', onResultsScroll));
  const resetResultsScroll = () => {
    if (!resultsScrolled) return;
    resultsPanel.scrollTop = 0;
    resultsScrolled = false;
  };
  const selectTab = (classification: string, { focus = false, resetScroll = true } = {}) => {
    if (resetScroll) resetResultsScroll();
    if (!catalogueWindow && classification !== activeCategory) {
      // Reorder the retained rows inside their existing layout groups.
      const order = classification === 'planet' || classification === 'all' ? objectOrder : distanceOrder;
      for (const [index, chunk] of chunks.entries()) {
        chunk.items = order.slice(index * 16, (index + 1) * 16);
        requiredElement(chunk.node,'.object-chunk-list').append(...chunk.items);
      }
    }
    activeCategory = classification;
    for (const tab of tabs) {
      const selected = tab.dataset.objectTab === classification;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) {
        resultsPanel.setAttribute('aria-labelledby', tab.id);
        if (focus) tab.focus();
      }
    }
    if (catalogueWindow) {
      const order = classification === 'planet' || classification === 'all' ? objectEntries : distanceEntries;
      const visible = order.filter(entry => matchedEntries.has(entry)
        && matchesObjectCategory(entry.classification, classification));
      catalogueWindow.setEntries(visible);
      visibleObjects = visible.length + visibleOverviews;
    } else {
      for (const item of items) item.hidden = item.dataset.objectMatch !== 'true'
        || !matchesObjectCategory(item.dataset.objectClassification, classification);
      refreshChunks();
      visibleObjects = items.filter(item => !item.hidden).length + visibleOverviews;
    }
    setEmptyHidden(visibleObjects > 0);
    presentSearchResults(browser, showingSearchResults, classification);
  };

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  catalogueRetry?.addEventListener('click', () => { void ensureCatalogueLoaded(); }, { signal: events.signal });
  const objectName = (id: string) => SCENE_OBJECTS.find(object => object.id === id)?.name ?? '';
  const overviewName = ({ scope, systemId }: ShellOverview) => scope === 'system'
    ? systemById(SCENE_OBJECTS, systemId)?.name ?? 'Solar System'
    : ({ 'milky-way': 'Milky Way', 'local-group': 'Local Group', 'nearby-universe': 'Nearby Universe' })[scope];
  let visibleObjects = 0;
  let visibleOverviews = 0;
  let visibleFeatures = 0;
  const updateEmpty = () => { setEmptyHidden(visibleObjects + visibleFeatures > 0); };
  const destinations = createDestinationBrowser({
    documentTarget,
    onSelected() { render(false); search.blur(); },
    onReset() { render(false); },
  });
  lifetime.onDispose(() => destinations?.destroy());
  const features = createFeatureBrowser({
    documentTarget, objectId: documentTarget.body.dataset.objectShell ?? '',
    onResults(count) { visibleFeatures = count; updateEmpty(); },
    onSelected() { render(false); search.blur(); },
    onSelectionError(error) { console.error('Feature selection failed:', error); browsing = true; render(true); search.focus(); },
    selectOwnPlace: id => destinations?.selectById(id) ?? Promise.resolve(),
  });
  lifetime.onDispose(() => features?.destroy());
  let open = searchCard.hasAttribute('data-search-submitted');
  let browsing = open;
  const categoryButtons = [...documentTarget.querySelectorAll<HTMLElement>('.object-search-category')];
  // A pill's classification highlights its bodies in the scene; other searches clear it.
  // Filtering resets then re-marks the category, so report only the settled value.
  let reportedCategory: string | null = null, pendingCategory: string | null = null, reportQueued = false;
  const markCategory = (classification: string | null | undefined = null) => {
    for (const button of categoryButtons) {
      button.ariaPressed = String(button.dataset.searchClassification === classification);
    }
    pendingCategory = categoryButtons.some(button => button.dataset.searchClassification === classification) ? classification ?? null : null;
    if (reportQueued) return;
    reportQueued = true;
    queueMicrotask(() => {
      reportQueued = false;
      if (pendingCategory === reportedCategory || lifetime.disposed) return;
      reportedCategory = pendingCategory;
      onCategoryChange(reportedCategory);
    });
  };
  let filteredQuery: string | null = null, filteredClassification: string | null | undefined = null;
  const publishSourceContext = () => {
    const subject = currentSubject();
    const sourceFocus = subject.kind === 'focus' ? subject.record.id : '';
    if (browser.dataset.sourceFocus !== sourceFocus) browser.dataset.sourceFocus = sourceFocus;
    const source = subject.kind === 'focus' ? `focus:${subject.record.id}`
      : subject.kind === 'overview' ? `overview:${subject.overview.scope === 'system' ? `system:${subject.overview.systemId}` : subject.overview.scope}`
      : `object:${subject.objectId}`;
    renderSourceLink(documentTarget, source, sourceLinks);
  };
  const renderSelectionContext = () => {
    const subject = currentSubject();
    const focus = subject.kind === 'focus' ? subject.record : null;
    const overview = subject.kind === 'overview' ? subject.overview : null;
    const galactic = overview?.scope === 'milky-way';
    const neighborCard = largeScaleCards.find(card => card.dataset.largeScaleOverview === 'local-group');
    const galaxySelected = focus && neighborCard
      && [...neighborCard.querySelectorAll<HTMLElement>('[data-neighbor-id]')]
        .some(row => row.dataset.neighborId === focus.id);
    const largeScale = galaxySelected ? neighborCard : overview
      ? largeScaleCards.find(card => card.dataset.largeScaleOverview === overview.scope) : undefined;
    if (neighborCard && (galaxySelected || galactic || largeScale === neighborCard)) {
      selectGalaxyNeighbor(neighborCard, galaxySelected && focus ? focus.id : 'milky-way');
    }
    for (const card of largeScaleCards) setPanelHidden(card, card !== largeScale);
    if (focusCard) setPanelHidden(focusCard, !focus);
    if (galaxy) setPanelHidden(galaxy, !galactic);
    const systemSelected = overview?.scope === 'system';
    if (system) setPanelHidden(system, !systemSelected);
    placeVolumeDatasets(systemSelected);
    const showContext = Boolean(focus) || galactic || Boolean(largeScale) || systemSelected;
    setPanelHidden(information, showContext);
    if (!sharedLegacyContext) setPanelHidden(context, !showContext);
    const headerSystemId = systemSelected ? overview.systemId : SOLAR_SYSTEM_ID;
    for (const header of systemHeaders) header.toggleAttribute('data-system-current', header.dataset.systemHeader === headerSystemId);
    if (solarSystemFacts) solarSystemFacts.hidden = headerSystemId !== SOLAR_SYSTEM_ID;
    const navigationSelection = subject.kind === 'focus' ? subject.record.id
      : subject.kind === 'overview' ? subject.overview.scope === 'system' ? subject.overview.systemId : subject.overview.scope
      : subject.objectId;
    selectNavigation(navigationSelection);
    context.ariaLabel = subject.kind === 'focus' ? subject.record.name
      : subject.kind === 'overview' ? largeScale?.dataset.largeScaleName ?? overviewName(subject.overview)
      : objectName(subject.objectId) || 'Selected object';
  };
  const filter = (resetScroll = true) => {
    renderSelectionContext();
    const searching = browsing && search.value.trim().length > 0;
    const query = searching ? search.value.trim().toLocaleLowerCase("en") : "";
    if (query === filteredQuery && searching === showingSearchResults) {
      setPanelHidden(browser, false);
      markCategory(filteredClassification);
      return;
    }
    filteredQuery = query;
    showingSearchResults = searching;
    visibleOverviews = presentOverviewResults(browser, searching ? query : '');
    presentSearchResults(browser, searching, activeCategory);
    if (searching) browser.setAttribute('data-navigation-filtered', '');
    else browser.removeAttribute('data-navigation-filtered');
    filteredClassification = null;
    if (resetScroll) resetResultsScroll();
    markCategory();
    destinations?.setOpen(true);
    browser.ariaLabel = searching ? 'Search results' : 'Celestial objects';
    setPanelHidden(browser, false);
    if (!searching) {
      visibleObjects = 1;
      empty.hidden = true;
      void navigation?.filter(null);
      void features?.search('');
      return;
    }
    const result = searchObjects(searchLabels, query, activeCategory, { illustrations: illustrationModelsEnabled });
    const { classification, systemName, showAll } = result;
    markCategory(classification);
    filteredClassification = classification;
    visibleObjects = 0;
    void features?.search(classification || systemName || showAll ? "" : query);
    if (query.length === 0) {
      for (const item of items) item.hidden = true;
      catalogueWindow?.clear();
      empty.hidden = true;
      setPanelHidden(browser, true);
      return;
    }
    setPanelHidden(browser, false);
    if (catalogueWindow) {
      matchedEntries = new Set(result.matches.flatMap(match => match.entry ? [match.entry] : []));
    } else {
      const matches = new Set(result.matches.flatMap(match => match.item ? [match.item] : []));
      for (const item of items) item.dataset.objectMatch = String(matches.has(item));
    }
    const classifications = result.matches.map(match => match.classification);
    for (const tab of tabs) {
      requiredElement(tab, '.object-tab-count').textContent = `(${objectCategoryCount(classifications, tab.dataset.objectTab)})`;
    }
    const nextCategory = searching ? (classification ? result.category : 'all') : initialCategory ?? result.category;
    initialCategory = null;
    selectTab(nextCategory, { resetScroll: false });
    // Typed results are a flat list with the tree hidden, so the tree is not filtered per keystroke.
    setEmptyHidden(visibleObjects !== 0 || Boolean(features && !classification && !showAll));
  };
  const render = (next: boolean, { resetQuery = false } = {}) => {
    publishSourceContext();
    if (!next) browsing = false;
    // Only an actual open/close transition may reset a scrolled result list.
    if (open !== next) resetResultsScroll();
    open = next;
    trigger.ariaExpanded = String(next);
    search.ariaExpanded = String(next);
    setPanelHidden(selectedContent, next);
    trigger.title = trigger.ariaLabel = next ? 'Collapse celestial objects' : 'Browse celestial objects';
    const currentUrl = new URL(windowTarget.location.href);
    for (const input of documentTarget.querySelectorAll<HTMLInputElement>('[data-search-context], [data-dataset-context]')) {
      input.value = currentUrl.searchParams.get(input.name) ?? '';
      input.disabled = !input.value;
    }
    if (next && resetQuery) search.value = "";
    if (next) void ensureCatalogueLoaded();
    destinations?.setOpen(next);
    if (next) filter();
    else {
      renderSelectionContext();
      setPanelHidden(browser, true);
      browser.removeAttribute('data-navigation-filtered');
      void navigation?.filter(null);
      catalogueWindow?.clear();
      markCategory();
    }
  };

  trigger.addEventListener("click", event => {
    event.preventDefault();
    if (open) { render(false); search.focus(); return; }
    browsing = true;
    render(true);
    search.focus();
  }, {
    signal: events.signal,
  });
  searchCard.addEventListener('submit', event => {
    event.preventDefault();
    browsing = true;
    render(true);
  }, { signal: events.signal });
  // Clearing empties the query and returns to the selected card, like Escape.
  documentTarget.querySelector<HTMLElement>('.object-sidebar-search-clear')?.addEventListener('click', event => {
    event.preventDefault();
    search.value = "";
    render(false);
    search.focus();
  }, { signal: events.signal });
  for (const button of categoryButtons) {
    button.addEventListener('click', event => {
      event.preventDefault();
      if (button.ariaPressed === 'true') {
        search.value = '';
        render(false);
        return;
      }
      search.value = button.dataset.searchQuery ?? "";
      browsing = true;
      render(true);
      requiredElement(documentTarget, '.object-sidebar').scrollTop = 0;
    }, { signal: events.signal });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      render(false);
      search.focus();
    }, { signal: events.signal });
  }
  for (const tab of tabs) {
    tab.addEventListener('click', event => { event.preventDefault(); selectTab(tab.dataset.objectTab ?? 'all'); }, { signal: events.signal });
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % tabs.length
        : event.key === 'ArrowLeft' ? (index - 1 + tabs.length) % tabs.length : null;
      if (next === null) return;
      event.preventDefault();
      selectTab(tabs[next].dataset.objectTab ?? "all", { focus: true });
    }, { signal: events.signal });
  }
  search.addEventListener("input", () => {
    browsing = true;
    if (!open) render(true);
    else if (open) filter();
  }, { signal: events.signal });
  // Source result rows have explicit visibility. Reading every row's geometry
  // here would synchronously lay out all skipped groups on each arrow key.
  const visibleControl = (element: HTMLElement) => !('disabled' in element && element.disabled) && !element.closest('[hidden], .object-breadcrumbs')
    && (element.classList.contains('object-link') || element.getClientRects().length > 0);
  search.addEventListener("keydown", (event) => {
    if (open && (event.key === "Enter" || event.key === "ArrowDown")) {
      // Enter opens the first result. The category tabs come first in the browser but are not results.
      const first = [...browser.querySelectorAll<HTMLElement>("summary, a, button")]
        .find(control => (event.key !== "Enter" || control.getAttribute("role") !== "tab") && visibleControl(control));
      if (first) {
        event.preventDefault();
        if (event.key === "Enter") first.click(); else first.focus();
      }
    } else if (event.key === "Enter") {
      event.preventDefault(); browsing = true; render(true); return;
    }
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    render(false);
  }, { signal: events.signal });
  browser.addEventListener("keydown", (event) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        event.target instanceof windowTarget.HTMLInputElement && event.target.hasAttribute('data-information-tab')) return;
    const windowedRow = event.target instanceof windowTarget.Element
      ? event.target.closest<HTMLElement>('[data-catalogue-index]') : null;
    if (catalogueWindow && windowedRow && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const current = Number(windowedRow.dataset.catalogueIndex);
      const next = current + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) search.focus();
      else catalogueWindow.focus(next);
      return;
    }
    const controls = [...browser.querySelectorAll<HTMLElement>("summary, a, button")].filter(visibleControl);
    const index = controls.findIndex(control => control === documentTarget.activeElement);
    if (event.key === "Escape") { render(false); search.focus(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = index + (event.key === "ArrowDown" ? 1 : -1);
      if (next < 0) search.focus(); else controls[Math.min(next, controls.length - 1)]?.focus();
    }
  }, { signal: events.signal });
  browser.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!(event.target instanceof windowTarget.Element) || !event.target.closest('a[data-prepared-focus-id]')) return;
    render(false);
    search.blur();
  }, { signal: events.signal });
  // Pressing or wheeling the scene leaves the search: the results close and the typed query stays for reopening.
  const sceneInput = documentTarget.querySelector<HTMLElement>('.object-input-surface');
  for (const type of ['pointerdown', 'wheel'] as const) {
    sceneInput?.addEventListener(type, () => { if (open) { render(false); search.blur(); } }, { signal: events.signal, passive: true });
  }
  documentTarget.addEventListener("pointerdown", (event) => {
    if (documentTarget.activeElement !== search ||
        !(event.target instanceof windowTarget.Node) ||
        searchCard.contains(event.target)) return;
    search.blur();
  }, { signal: events.signal });
  render(open);

  const markSelection = () => {
    const subject = currentSubject();
    documentTarget.documentElement.dataset.selection = subject.kind === 'focus' ? 'prepared-focus'
      : subject.kind === 'overview' ? subject.overview.scope : 'object';
    const selection = subject.kind === 'focus' ? { kind: 'prepared-focus', id: subject.record.id } as const
      : subject.kind === 'object' ? { kind: 'scene', id: subject.objectId } as const : null;
    catalogueWindow?.setSelection(selection);
    for (const anchor of browser.querySelectorAll<HTMLElement>('.object-link')) {
      const selected = selection?.kind === 'prepared-focus' ? anchor.dataset.preparedFocusId === selection.id
        : selection?.kind === 'scene' && anchor.dataset.objectId === selection.id;
      anchor.classList.toggle('is-active', selected);
      if (selected) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  };
  const previewSelection = (subject: ShellSubject) => {
    const previous = subjectOverride, previousBrowsing = browsing;
    const preview = { subject, hideFocus: true };
    subjectOverride = preview;
    browsing = false;
    markSelection(); render(false);
    return () => {
      if (subjectOverride !== preview) return;
      subjectOverride = previous;
      browsing ||= previousBrowsing;
      markSelection(); render(browsing);
    };
  };
  // Inline rows and a fetched catalogue read the same initial shell selection.
  if (items.length > 0) markSelection();
  return Object.freeze({
    setIllustrationModelsEnabled(enabled: boolean) {
      if (illustrationModelsEnabled === enabled) return;
      illustrationModelsEnabled = enabled;
      filteredQuery = null;
      if (open) filter(false);
    },
    previewOverview(scope: OverviewScope, systemId: string) {
      return previewSelection({ kind: 'overview', overview: { scope, systemId } });
    },
    previewObject(objectId: string) {
      return previewSelection({ kind: 'object', objectId });
    },
    showSystem(systemId: string) {
      subjectOverride = { subject: { kind: 'overview', overview: { scope: 'system', systemId } }, hideFocus: false };
      if (systemId === SOLAR_SYSTEM_ID) collapseSolarSystemBranches();
      markSelection(); render(false);
    },
    refreshFocus() {
      // A focus publication supersedes the focus hidden by a flight preview,
      // while the preview or explorer still owns its underlying body/context.
      if (subjectOverride) subjectOverride.hideFocus = false;
      markSelection(); render(browsing);
    },
    refreshSelection({ clearObjectProviders = false } = {}) {
      subjectOverride = null;
      const subject = readSelection();
      if (subject.kind === 'overview' && subject.overview.scope === 'system' && subject.overview.systemId === SOLAR_SYSTEM_ID) {
        collapseSolarSystemBranches();
      }
      markSelection();
      if (clearObjectProviders) { destinations?.bind(null); features?.bind(null); }
      render(browsing);
    },
    bindObject(id: string) {
      // A completed flight publishes the selection, but a newer search owns
      // its query and results until the user chooses or dismisses them.
      subjectOverride = null;
      const object = SCENE_OBJECTS.find(object => object.id === id);
      if (object) {
        searchCard.setAttribute('action', object.route);
        searchCard.dataset.searchObject = object.id;
        documentTarget.querySelector('.object-sidebar-search-clear')?.setAttribute('href', object.route);
      }
      markSelection();
      destinations?.bind(null); features?.bind(null);
      render(browsing);
    },
    setDestinations(provider: PreparedDestinationRuntime | null | undefined) {
      const body = SCENE_OBJECTS.find(object => object.id === documentTarget.body.dataset.objectShell);
      destinations?.bind(provider, body ? { id: body.id, name: body.name } : undefined);
    },
    selectPlace(id: string) { return destinations?.selectById(id) ?? Promise.resolve(); },
    setFeatures(provider: SurfaceFeatureNavigationRuntime | null | undefined) { features?.bind(provider); },
    destroy() {
      events.abort();
      destinations?.destroy();
      for (const item of items) item.hidden = false;
      empty.hidden = true;
      render(false);
    },
  });
}
