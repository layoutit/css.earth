import { createSearchClient, type SearchOutcome } from './search/search-client.mts';
import { createSelectionPresentation } from './selection-presentation.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser/browser-types.mts';
import type { SceneSubject } from './scene/scene-selection.mts';
import type { DestinationPresentation } from './destination-browser.mts';
import { requiredElement } from './browser/browser-types.mts';
import { createDestinationBrowser } from './destination-browser.mts';
import { createFeatureBrowser } from './feature-browser.mts';
import { presentOverviewResults, createSearchPresentation } from './search/search-results-presentation.mts';
import { WORLD_OBJECTS } from './world-objects.mts';
import { SEARCH_SUGGESTION_MIN_CHARACTERS } from './runtime-policy.mts';

export interface ObjectBrowserOptions {
  readSelection(): SceneSubject;
  readObjectId(): string;
  onCategoryChange?(classification: string | null): void;
  readIllustrationModels?(): boolean;
  onResetDestination?(): void;
  /** A pill was pressed: the scene frames every member of its classification. */
  onFrameCategory?(classification: string): void;
  /** Search results opened or closed, and whether a pill opened them. The mobile sheet follows this state, not the input's own events. */
  onSearchChange?(open: boolean, browsing: boolean): void;
}

interface ShownSearch {
  query: string | null;
  classification: string | null;
  /** Overview rows matched on the page, and the objects the search found; 'pending' until its answer arrives. */
  overviews: number;
  objects: number | 'pending';
  features: number;
}

interface SubjectOverride {
  readonly subject: SceneSubject;
  hideFocus: boolean;
}

export function createObjectBrowserController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime,
  { readSelection, readObjectId, onCategoryChange = () => {}, readIllustrationModels = () => false, onResetDestination = () => {},
    onFrameCategory = () => {}, onSearchChange = () => {} }: ObjectBrowserOptions) {
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
  const information = documentTarget.querySelector(".object-information-panel");
  const browser = documentTarget.querySelector(".object-browser");
  if (!(search instanceof windowTarget.HTMLInputElement) ||
      !(searchCard instanceof windowTarget.HTMLElement) ||
      !(information instanceof windowTarget.HTMLElement) ||
      !(browser instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell object browser is incomplete.");
  }
  let open = searchCard.hasAttribute('data-search-submitted');
  let showingSearchResults = false;
  const searchPresentation = createSearchPresentation(documentTarget);
  const presentation = createSelectionPresentation(documentTarget, { windowTarget });
  const resultsPanel = requiredElement(browser, '#object-category-results');
  browser.dataset.retained = '';
  information.dataset.retained = '';
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
  // category pill, and what it found.
  const shown: ShownSearch = { query: null, classification: null, overviews: 0, objects: 0, features: 0 };
  // "No matching results" waits until the search has answered with nothing.
  const presentEmpty = () => {
    searchPresentation.setEmptyHidden(!showingSearchResults || shown.objects !== 0 || shown.overviews + shown.features > 0);
  };
  const destinations = createDestinationBrowser({
    documentTarget,
    onSelected() { setOpen(false); search.blur(); },
    onReset: onResetDestination,
  });
  lifetime.onDispose(() => destinations?.destroy());
  const features = createFeatureBrowser({
    documentTarget,
    onSelected() { setOpen(false); search.blur(); },
  });
  lifetime.onDispose(() => features?.destroy());
  const results = createSearchClient({ documentTarget, windowTarget, resultsPanel, lifetime,
    readObjectId: () => documentTarget.body.dataset.objectShell || readObjectId(),
    onResults(outcome: SearchOutcome | null) {
      if (!showingSearchResults) return;
      // A failed search shows its retry line, never "No matching results".
      shown.objects = outcome?.objects ?? 'pending';
      shown.features = features?.present(shown.query ?? '', outcome ? outcome.features : []) ?? 0;
      if (outcome) { shown.classification = outcome.classification; markCategory(outcome.classification); }
      presentSelection();
      presentEmpty();
    },
  });
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
  const presentSelection = () => results.setSelection(presentation.present(currentSubject(), results.sources));
  const presentBrowser = () => {
    searchPresentation.present(open, showingSearchResults);
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
      Object.assign(shown, { query, classification: null, overviews: 0, objects: 0, features: 0 } satisfies ShownSearch);
      markCategory();
      presentEmpty();
      results.clear();
      features?.present('', []);
      return;
    }
    // A pill presses at once; the answer confirms it, or presses the pill a typed category ("stars") names.
    const pill = categoryButtons.find(button => button.dataset.searchQuery?.toLocaleLowerCase('en') === query);
    const classification = pill?.dataset.searchClassification ?? null;
    markCategory(classification);
    Object.assign(shown, { query, classification, overviews: visibleOverviews, objects: 'pending', features: 0 } satisfies ShownSearch);
    void results.search(query, readIllustrationModels());
    presentEmpty();
  };
  // Set while a pill opens its results: the mobile sheet then leaves the map in view.
  let pillPress = false;
  const setOpen = (next: boolean) => {
    if (open === next) return;
    resetResultsScroll();
    open = next;
    if (next) {
      const currentUrl = new URL(windowTarget.location.href);
      for (const input of documentTarget.querySelectorAll<HTMLInputElement>('[data-search-context], [data-dataset-context]')) {
        input.value = currentUrl.searchParams.get(input.name) ?? '';
        input.disabled = !input.value;
      }
      filter();
    } else {
      presentBrowser();
      results.clear();
      shown.query = null;
      markCategory();
    }
    if (!lifetime.disposed) onSearchChange(next, pillPress);
  };
  // Results open only for a query; an empty one closes them.
  const showResults = () => {
    presentSelection();
    if (!search.value.trim()) setOpen(false);
    else if (open) filter();
    else setOpen(true);
  };
  const refreshSelection = () => {
    presentSelection();
    if (open) filter();
  };

  // Closing the results keeps the field focused; the mobile sheet returns to where the results found it.
  const closeKeepingFocus = () => { search.focus(); setOpen(false); };
  searchCard.addEventListener('submit', event => {
    event.preventDefault();
    showResults();
  }, { signal: events.signal });
  // Clearing empties the query and returns to the selected card, like Escape.
  documentTarget.querySelector<HTMLElement>('.object-sidebar-search-clear')?.addEventListener('click', event => {
    event.preventDefault();
    search.value = "";
    closeKeepingFocus();
  }, { signal: events.signal });
  for (const button of categoryButtons) {
    button.addEventListener('click', event => {
      event.preventDefault();
      if (button.ariaPressed === 'true') {
        if (search.value) search.value = '';
        setOpen(false);
        return;
      }
      search.value = button.dataset.searchQuery ?? "";
      pillPress = true;
      try { showResults(); } finally { pillPress = false; }
      requiredElement(documentTarget, '.object-sidebar').scrollTop = 0;
      const classification = button.dataset.searchClassification;
      if (classification) onFrameCategory(classification);
    }, { signal: events.signal });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      closeKeepingFocus();
    }, { signal: events.signal });
  }
  search.addEventListener("input", () => {
    if (search.value.trim().length < SEARCH_SUGGESTION_MIN_CHARACTERS) setOpen(false);
    else showResults();
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
      event.preventDefault(); showResults(); return;
    }
    if (event.key !== "Escape" || !open) return;
    event.preventDefault();
    setOpen(false);
  }, { signal: events.signal });
  browser.addEventListener("keydown", (event) => {
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') &&
        event.target instanceof windowTarget.HTMLInputElement && event.target.hasAttribute('data-information-tab')) return;
    const windowedRow = event.target instanceof windowTarget.Element
      ? event.target.closest<HTMLElement>('[data-catalogue-index]') : null;
    if (windowedRow && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      const current = Number(windowedRow.dataset.catalogueIndex);
      const next = current + (event.key === 'ArrowDown' ? 1 : -1);
      if (next < 0) search.focus();
      else results.focus(next);
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
    setOpen(false);
    search.blur();
  }, { signal: events.signal });
  // Pressing or wheeling the scene leaves the search: the results close and the typed query stays for reopening.
  const sceneInput = documentTarget.querySelector<HTMLElement>('.object-input-surface');
  for (const type of ['pointerdown', 'wheel'] as const) {
    sceneInput?.addEventListener(type, () => { if (open) { setOpen(false); search.blur(); } }, { signal: events.signal, passive: true });
  }
  documentTarget.addEventListener("pointerdown", (event) => {
    if (documentTarget.activeElement !== search ||
        !(event.target instanceof windowTarget.Node) ||
        searchCard.contains(event.target)) return;
    search.blur();
  }, { signal: events.signal });
  presentBrowser();
  refreshSelection();

  const previewSelection = (subject: SceneSubject) => {
    const previous = subjectOverride, previousOpen = open, previousQuery = search.value;
    const preview = { subject, hideFocus: true };
    subjectOverride = preview;
    // Choosing a result ends that search; a cancelled flight gives the query back.
    if (search.value) search.value = '';
    setOpen(false);
    presentSelection();
    return () => {
      if (subjectOverride !== preview) return;
      subjectOverride = previous;
      if (!search.value && previousQuery) search.value = previousQuery;
      refreshSelection();
      setOpen(open || previousOpen);
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
      if (subject.kind === 'overview') destinations?.present(null);
      refreshSelection();
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
      // Feature rows list the bound body's features first: an open search asks again for it.
      destinations?.present(null);
      if (open && showingSearchResults) { shown.query = null; filter(false); }
      // The shell publishes once after all incoming content owners are bound.
    },
    presentDestination(value: DestinationPresentation | null) { destinations?.present(value); },
    destroy() {
      events.abort();
      destinations?.destroy();
      searchPresentation.setEmptyHidden(true);
      setOpen(false);
    },
  });
}
