import { createObjectCatalogue } from './object-catalogue.mts';
import { createSelectionPresentation, setPanelHidden } from './selection-presentation.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import type { SceneSubject } from './scene/scene-selection.mts';
import type { DestinationPresentation } from './destination-browser.mts';
import { requiredElement } from './browser-types.mts';
import { createDestinationBrowser } from './destination-browser.mts';
import { createFeatureBrowser } from './feature-browser.mts';
import { presentOverviewResults, presentSearchResults } from './search-results-presentation.mts';
import { createNavigationTreeController } from './navigation/navigation-tree-client.mts';
import { SCENE_OBJECTS } from './objects.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';

export interface ObjectBrowserOptions {
  readSelection(): SceneSubject;
  readObjectId(): string;
  onCategoryChange?(classification: string | null): void;
  readIllustrationModels?(): boolean;
  onResetDestination?(): void;
}

interface SubjectOverride {
  readonly subject: SceneSubject;
  hideFocus: boolean;
}

export function createObjectBrowserController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime,
  { readSelection, readObjectId, onCategoryChange = () => {}, readIllustrationModels = () => false, onResetDestination = () => {} }: ObjectBrowserOptions) {
  // Browsing a system keeps the committed focus; a flight preview temporarily
  // covers it. Neither changes which scene or focus the shell owns.
  let subjectOverride: SubjectOverride | null = null;
  const currentSubject = (): SceneSubject => {
    const committed = readSelection();
    return subjectOverride && (subjectOverride.hideFocus || committed.kind !== 'focus')
      ? subjectOverride.subject : committed;
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
  const navigationRoot = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  const navigation = navigationRoot ? createNavigationTreeController(navigationRoot, windowTarget) : null;
  lifetime.onDispose(() => navigation?.destroy());
  const selectNavigation = (current: string) => {
    if (!navigationRoot) return;
    // A selection change (a flight arriving) must not bring the tree back over typed results.
    navigationRoot.hidden = showingSearchResults;
    void navigation?.select(current);
  };
  const presentation = createSelectionPresentation(documentTarget, browser, information, selectNavigation);
  const resultsPanel = requiredElement(browser, '#object-category-results');
  const catalogue = createObjectCatalogue({ documentTarget, windowTarget, browser, resultsPanel, lifetime,
    onLoad() {
      markSelection();
      publishSourceContext();
      if (open) { filteredQuery = null; filter(false); }
    },
  });
  information.dataset.retained = '';
  const setEmptyHidden = (hidden: boolean) => { empty.hidden = hidden || !catalogue.loaded; };
  const collapseSolarSystemBranches = () => {
    if (!navigationRoot) return;
    for (const branch of navigationRoot.querySelectorAll<HTMLDetailsElement>('details[data-atlas-depth]:not([data-atlas-depth="0"])')) {
      branch.open = false;
    }
    const solarSystem = navigationRoot.querySelector<HTMLDetailsElement>('details[data-atlas-depth="0"][data-atlas-key="solar-system"]');
    if (solarSystem) solarSystem.open = true;
  };
  let showingSearchResults = false;
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
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let visibleObjects = 0;
  let visibleFeatures = 0;
  const updateEmpty = () => { setEmptyHidden(visibleObjects + visibleFeatures > 0); };
  const destinations = createDestinationBrowser({
    documentTarget,
    onSelected() { render(false); search.blur(); },
    onReset: onResetDestination,
  });
  lifetime.onDispose(() => destinations?.destroy());
  const features = createFeatureBrowser({
    documentTarget, objectId: readObjectId(),
    onResults(count) { visibleFeatures = count; updateEmpty(); },
    onSelected() { render(false); search.blur(); },
  });
  lifetime.onDispose(() => features?.destroy());
  let open = searchCard.hasAttribute('data-search-submitted');
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
  const publishSourceContext = () => presentation.publishSource(currentSubject(), catalogue.sources);
  const renderSelectionContext = () => presentation.render(currentSubject());
  const filter = (resetScroll = true) => {
    renderSelectionContext();
    const searching = search.value.trim().length > 0;
    const query = searching ? search.value.trim().toLocaleLowerCase("en") : "";
    if (query === filteredQuery && searching === showingSearchResults) {
      setPanelHidden(browser, false);
      markCategory(filteredClassification);
      return;
    }
    filteredQuery = query;
    showingSearchResults = searching;
    const visibleOverviews = presentOverviewResults(browser, searching ? query : '');
    presentSearchResults(browser, searching);
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
      void navigation?.reset();
      void features?.search('');
      return;
    }
    const result = catalogue.search(query, { illustrations: readIllustrationModels() });
    const { classification, showAll } = result;
    markCategory(classification);
    filteredClassification = classification;
    visibleObjects = result.matches.length + visibleOverviews;
    void features?.search(result.detailQuery);
    // Typed results are a flat list with the tree hidden, so the tree is not filtered per keystroke.
    setEmptyHidden(visibleObjects !== 0 || Boolean(features && !classification && !showAll));
  };
  const render = (next: boolean) => {
    publishSourceContext();
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
    if (next) void catalogue.ensureLoaded();
    destinations?.setOpen(next);
    if (next) filter();
    else {
      renderSelectionContext();
      setPanelHidden(browser, true);
      browser.removeAttribute('data-navigation-filtered');
      void navigation?.reset();
      catalogue.clearWindow();
      markCategory();
    }
  };

  trigger.addEventListener("click", event => {
    event.preventDefault();
    if (open) { render(false); search.focus(); return; }
    render(true);
    search.focus();
  }, {
    signal: events.signal,
  });
  searchCard.addEventListener('submit', event => {
    event.preventDefault();
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
  search.addEventListener("input", () => {
    if (!open) render(true);
    else filter();
  }, { signal: events.signal });
  // Source result rows have explicit visibility. Reading every row's geometry
  // here would synchronously lay out all skipped groups on each arrow key.
  const visibleControl = (element: HTMLElement) => !('disabled' in element && element.disabled) && !element.closest('[hidden], .object-breadcrumbs')
    && (element.classList.contains('object-link') || element.getClientRects().length > 0);
  search.addEventListener("keydown", (event) => {
    if (open && (event.key === "Enter" || event.key === "ArrowDown")) {
      const first = [...browser.querySelectorAll<HTMLElement>("summary, a, button")]
        .find(visibleControl);
      if (first) {
        event.preventDefault();
        if (event.key === "Enter") first.click(); else first.focus();
      }
    } else if (event.key === "Enter") {
      event.preventDefault(); render(true); return;
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
    if (catalogue.windowed && windowedRow && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const current = Number(windowedRow.dataset.catalogueIndex);
      const next = current + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) search.focus();
      else catalogue.focus(next);
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
    const selected = presentation.mark(currentSubject());
    catalogue.setSelection(selected);
  };
  const previewSelection = (subject: SceneSubject) => {
    const previous = subjectOverride, previousOpen = open;
    const preview = { subject, hideFocus: true };
    subjectOverride = preview;
    markSelection(); render(false);
    return () => {
      if (subjectOverride !== preview) return;
      subjectOverride = previous;
      markSelection(); render(open || previousOpen);
    };
  };
  // Inline rows and a fetched catalogue read the same initial shell selection.
  if (catalogue.hasInlineRows) markSelection();
  return Object.freeze({
    readSubject: currentSubject,
    refreshIllustrations() {
      filteredQuery = null;
      if (open) filter(false);
    },
    previewSelection,
    showSystem(systemId: string) {
      subjectOverride = { subject: { kind: 'overview', overview: { scope: 'system', systemId } }, hideFocus: false };
      if (systemId === SOLAR_SYSTEM_ID) collapseSolarSystemBranches();
      markSelection(); render(false);
    },
    refreshSelection() {
      const subject = readSelection();
      // Focus content can publish during a preview; keep its temporary context.
      if (subject.kind === 'focus') {
        if (subjectOverride) subjectOverride.hideFocus = false;
      } else subjectOverride = null;
      if (subject.kind === 'overview' && subject.overview.scope === 'system' && subject.overview.systemId === SOLAR_SYSTEM_ID) {
        collapseSolarSystemBranches();
      }
      markSelection();
      if (subject.kind === 'overview') destinations?.present(null);
      render(open);
    },
    bindObject(id: string) {
      // A completed flight publishes the selection, but a newer search owns
      // its query and results until the user chooses or dismisses them.
      subjectOverride = null;
      presentation.bindObject();
      const object = SCENE_OBJECTS.find(object => object.id === id);
      if (object) {
        searchCard.setAttribute('action', object.route);
        searchCard.dataset.searchObject = object.id;
        documentTarget.querySelector('.object-sidebar-search-clear')?.setAttribute('href', object.route);
      }
      markSelection();
      destinations?.present(null); features?.refresh();
      render(open);
    },
    presentDestination(value: DestinationPresentation | null) { destinations?.present(value); },
    destroy() {
      events.abort();
      destinations?.destroy();
      catalogue.showInlineRows();
      empty.hidden = true;
      render(false);
    },
  });
}
