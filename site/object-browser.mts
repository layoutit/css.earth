import { createObjectCatalogue } from './object-catalogue.mts';
import { createSelectionPresentation } from './selection-presentation.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import type { SceneSubject } from './scene/scene-selection.mts';
import type { DestinationPresentation } from './destination-browser.mts';
import { requiredElement } from './browser-types.mts';
import { createDestinationBrowser } from './destination-browser.mts';
import { createFeatureBrowser } from './feature-browser.mts';
import { presentOverviewResults, createSearchPresentation } from './search-results-presentation.mts';
import { createNavigationTreeController } from './navigation/navigation-tree-client.mts';
import { WORLD_OBJECTS } from './world-objects.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';

export interface ObjectBrowserOptions {
  readSelection(): SceneSubject;
  readObjectId(): string;
  onCategoryChange?(classification: string | null): void;
  readIllustrationModels?(): boolean;
  onResetDestination?(): void;
  /** Search results opened or closed. The mobile sheet follows this state, not the input's own events. */
  onSearchChange?(open: boolean): void;
}

interface ShownSearch {
  query: string | null;
  classification: string | null | undefined;
  objects: number;
  features: number | 'pending';
}

interface SubjectOverride {
  readonly subject: SceneSubject;
  hideFocus: boolean;
}

export function createObjectBrowserController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime,
  { readSelection, readObjectId, onCategoryChange = () => {}, readIllustrationModels = () => false, onResetDestination = () => {},
    onSearchChange = () => {} }: ObjectBrowserOptions) {
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
  if (!(search instanceof windowTarget.HTMLInputElement) ||
      !(searchCard instanceof windowTarget.HTMLElement) ||
      !(trigger instanceof windowTarget.HTMLButtonElement) ||
      !(information instanceof windowTarget.HTMLElement) ||
      !(browser instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell object browser is incomplete.");
  }
  const searchPresentation = createSearchPresentation(documentTarget);
  const navigationRoot = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  const navigation = navigationRoot ? createNavigationTreeController(navigationRoot, windowTarget) : null;
  lifetime.onDispose(() => navigation?.destroy());
  const presentation = createSelectionPresentation(documentTarget, {
    windowTarget, selectNavigation: current => { void navigation?.select(current); },
  });
  const resultsPanel = requiredElement(browser, '#object-category-results');
  const catalogue = createObjectCatalogue({ documentTarget, windowTarget, browser, resultsPanel, lifetime,
    onLoad() {
      presentSelection();
      if (open) { shown.query = null; filter(false); }
    },
  });
  information.dataset.retained = '';
  const setEmptyHidden = (hidden: boolean) => searchPresentation.setEmptyHidden(hidden, catalogue.loaded);
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
  // The search the results show: its query (null when the next filter must run again, even for the same text), its
  // category pill, the objects it matched, and its feature rows, 'pending' while its feature search runs.
  const shown: ShownSearch = { query: null, classification: null, objects: 0, features: 0 };
  // "No matching results" waits until the objects and the feature search have both settled at zero.
  const presentEmpty = () => { setEmptyHidden(!showingSearchResults || shown.objects > 0 || shown.features !== 0); };
  const destinations = createDestinationBrowser({
    documentTarget,
    onSelected() { render(false); search.blur(); },
    onReset: onResetDestination,
  });
  lifetime.onDispose(() => destinations?.destroy());
  const features = createFeatureBrowser({
    documentTarget, objectId: readObjectId(),
    onResults(count) { shown.features = count; presentEmpty(); },
    onSelected() { render(false); search.blur(); },
  });
  lifetime.onDispose(() => features?.destroy());
  let open = searchCard.hasAttribute('data-search-submitted');
  const categoryButtons = [...documentTarget.querySelectorAll<HTMLElement>('.object-search-category')];
  // A pill's classification highlights its bodies in the scene; other searches clear it.
  // Coalesce synchronous selection updates before notifying the scene.
  let reportedCategory: string | null = null, pendingCategory: string | null = null, reportQueued = false;
  const markCategory = (classification: string | null | undefined = null) => {
    pendingCategory = searchPresentation.markCategory(classification);
    if (reportQueued) return;
    reportQueued = true;
    queueMicrotask(() => {
      reportQueued = false;
      if (pendingCategory === reportedCategory || lifetime.disposed) return;
      reportedCategory = pendingCategory;
      onCategoryChange(reportedCategory);
    });
  };
  const presentSelection = () => catalogue.setSelection(presentation.present(currentSubject(), catalogue.sources));
  const presentBrowser = () => {
    searchPresentation.present(open, showingSearchResults);
    browser.toggleAttribute('data-navigation-filtered', open && showingSearchResults);
    trigger.ariaExpanded = search.ariaExpanded = String(open);
    trigger.title = trigger.ariaLabel = open ? 'Collapse celestial objects' : 'Browse celestial objects';
  };
  const filter = (resetScroll = true) => {
    const searching = search.value.trim().length > 0;
    const query = searching ? search.value.trim().toLocaleLowerCase("en") : "";
    if (query === shown.query) {
      presentBrowser();
      markCategory(shown.classification);
      return;
    }
    showingSearchResults = searching;
    const visibleOverviews = presentOverviewResults(browser, query);
    presentBrowser();
    if (resetScroll) resetResultsScroll();
    if (!searching) {
      Object.assign(shown, { query, classification: null, objects: 0, features: 0 } satisfies ShownSearch);
      markCategory();
      presentEmpty();
      void navigation?.reset();
      void features?.search('');
      return;
    }
    const result = catalogue.search(query, { illustrations: readIllustrationModels() });
    markCategory(result.classification);
    // The feature browser reports at once when this query starts no feature search.
    Object.assign(shown, { query, classification: result.classification, objects: result.matches.length + visibleOverviews, features: features ? 'pending' : 0 } satisfies ShownSearch);
    void features?.search(result.detailQuery);
    // Typed results are a flat list with the tree hidden, so the tree is not filtered per keystroke.
    presentEmpty();
  };
  const render = (next: boolean) => {
    presentSelection();
    // Only an actual open/close transition may reset a scrolled result list.
    const changed = open !== next;
    if (changed) resetResultsScroll();
    open = next;
    const currentUrl = new URL(windowTarget.location.href);
    for (const input of documentTarget.querySelectorAll<HTMLInputElement>('[data-search-context], [data-dataset-context]')) {
      input.value = currentUrl.searchParams.get(input.name) ?? '';
      input.disabled = !input.value;
    }
    if (next) void catalogue.ensureLoaded();
    if (next) filter();
    else {
      presentBrowser();
      void navigation?.reset();
      catalogue.clearWindow();
      // Closing clears the rendered window, so the next open must filter again even for the same query.
      shown.query = null;
      markCategory();
    }
    if (changed && !lifetime.disposed) onSearchChange(next);
  };

  // Focus first: focusing search opens the mobile sheet for the keyboard, and closing
  // the results must still return the sheet to where the search found it.
  const closeKeepingFocus = () => { search.focus(); render(false); };
  trigger.addEventListener("click", event => {
    event.preventDefault();
    if (open) { closeKeepingFocus(); return; }
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
    closeKeepingFocus();
  }, { signal: events.signal });
  // The catalogue loads on intent, before the click: a pointer over, a press on or focus in a category or the search
  // field starts it, so the list is usually ready when it opens. Visitors who never search never load it.
  for (const target of [...categoryButtons, search]) for (const type of ['pointerover', 'pointerdown', 'focusin'] as const) {
    target.addEventListener(type, () => { void catalogue.ensureLoaded(); }, { signal: events.signal, once: true, passive: true });
  }
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
      closeKeepingFocus();
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
    if (event.key === "Escape") closeKeepingFocus();
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

  const previewSelection = (subject: SceneSubject) => {
    const previous = subjectOverride, previousOpen = open, previousQuery = search.value;
    const preview = { subject, hideFocus: true };
    subjectOverride = preview;
    // Choosing a result ends that search; a cancelled flight gives the query back.
    search.value = '';
    render(false);
    return () => {
      if (subjectOverride !== preview) return;
      subjectOverride = previous;
      if (!search.value) search.value = previousQuery;
      render(open || previousOpen);
    };
  };
  return Object.freeze({
    readSubject: currentSubject,
    refreshIllustrations() {
      shown.query = null;
      if (open) filter(false);
    },
    previewSelection,
    refreshSelection() {
      const subject = readSelection();
      // Focus content can publish during a preview; keep its temporary context.
      if (subject.kind === 'focus') {
        if (subjectOverride) subjectOverride.hideFocus = false;
      } else subjectOverride = null;
      if (subject.kind === 'overview' && subject.overview.scope === 'system' && subject.overview.systemId === SOLAR_SYSTEM_ID) {
        collapseSolarSystemBranches();
      }
      if (subject.kind === 'overview') destinations?.present(null);
      render(open);
    },
    bindObject(id: string) {
      // A completed flight publishes the selection, but a newer search owns
      // its query and results until the user chooses or dismisses them.
      subjectOverride = null;
      presentation.bindObject();
      const object = WORLD_OBJECTS.find(object => object.id === id);
      if (object) {
        searchCard.setAttribute('action', object.route);
        searchCard.dataset.searchObject = object.id;
        documentTarget.querySelector('.object-sidebar-search-clear')?.setAttribute('href', object.route);
      }
      destinations?.present(null); features?.refresh();
      render(open);
    },
    presentDestination(value: DestinationPresentation | null) { destinations?.present(value); },
    destroy() {
      events.abort();
      destinations?.destroy();
      catalogue.showInlineRows();
      setEmptyHidden(true);
      render(false);
    },
  });
}
