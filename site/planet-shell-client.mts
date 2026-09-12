import type { PreparedCatalogObject, SpatialCatalogSource } from '@cssearth/catalog';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import type { PreparedFocusPresentation } from './prepared-context-navigation.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedDestinationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { BrowserWindow, ShellCamera, PlaybackState } from './browser-types.mts';
import { errorMessage, requiredElement } from './browser-types.mts';
import type { OverviewScope } from './overview-context.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { createNavigationContent } from './navigation-content.mts';
export type NavigationContent = Awaited<ReturnType<ReturnType<typeof createNavigationContent>['load']>>;
export interface ShellOptions { highContrastSky?: boolean; onSkyContrastChange?(enabled: boolean): void; objectId: string; documentTarget?: Document; windowTarget?: BrowserWindow; motionEnabled?: boolean; onMotionChange?(enabled: boolean): void; heliosphereEnabled?: boolean; onHeliosphereChange?(enabled: boolean): void; asteroidOrbitsEnabled?: boolean; onAsteroidOrbitsChange?(enabled: boolean): void; asteroidLabelsEnabled?: boolean; onAsteroidLabelsChange?(enabled: boolean): void; onCategoryChange?(classification: string | null): void; }
interface SelectionPreview { id: string | null; frame?: PreparedWorldCameraFrame | null; commit?(): void; restore(): void; }
type Panel = readonly [string, HTMLDetailsElement];
import { objectCategory, matchesObjectCategory, objectCategoryCount } from "./object-categories.mts";
import { createDatasetContextController } from './dataset-context-controller.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createChartPixelAlignmentController } from "./chart-pixel-alignment.mts";
import { createDestinationBrowser } from "./destination-browser.mts";
import { createSceneLifetime } from "@cssearth/engine";
import { createExplorerRailController } from "./explorer-rail.mts";
import { createSurfaceMinimap, loadSurfacePreview } from "./surface-minimap.mts";
import { createViewReadout } from "./view-readout.mts";
import { createSurfaceMapReader } from "./surface-map-context.mts";
import { mountDiagnosticRecorder } from './diagnostic-recorder.mts';
import { bodyCardViewAtCamera, overviewScopeAtCamera } from './overview-context.mts';
import { MOBILE_SHEET_POLICY, MOBILE_VIEWPORT_QUERY } from './runtime-policy.mts';

export function mountPlanetShell({
  objectId,
  documentTarget = document,
  windowTarget = window,
  motionEnabled = false,
  onMotionChange = () => {},
  highContrastSky = false,
  onSkyContrastChange = () => {},
  heliosphereEnabled = false,
  onHeliosphereChange = () => {},
  asteroidOrbitsEnabled = false,
  onAsteroidOrbitsChange = () => {},
  asteroidLabelsEnabled = false,
  onAsteroidLabelsChange = () => {},
  onCategoryChange = () => {},
}: ShellOptions) {
  const drawer = requiredElement(documentTarget, ".planet-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  let informationTabs: ReturnType<typeof createInformationTabsController>;
  let sheet: ReturnType<typeof createSheetController>;
  let settingsController: ReturnType<typeof createSettingsController>, objectBrowser: ReturnType<typeof createObjectBrowserController>, contentLifetime: SceneLifetime | null, minimapController: ReturnType<typeof createSurfaceMinimap>, viewReadout: ReturnType<typeof createViewReadout>;
  let selectionPreview: SelectionPreview | null = null;
  let cardNavigation: { view: 'detail' | 'overview' } | null = null;
  let cardObjectId = objectId;
  let overview = false, overviewScope: OverviewScope = 'solar-system', camera: ShellCamera | null = null, unsubscribeOverview: (() => void) | null = null;
  let preparedFocus: PreparedCatalogObject | null = null;
  const focusCard = createPreparedFocusCard(drawer.querySelector<HTMLElement>('[data-prepared-focus-card]'));
  lifetime.onDispose(() => focusCard.destroy());
  lifetime.onDispose(() => unsubscribeOverview?.());
  function updateBodyCard(world = camera?.navigation?.capture()) {
    const information = drawer.querySelector<HTMLElement>('.planet-information-panel');
    const view = cardNavigation?.view ?? bodyCardViewAtCamera(world, selectionPreview?.frame ?? camera?.navigation?.frame,
      camera?.navigation?.optics?.(), selectionPreview?.id ?? cardObjectId);
    if (information && information.dataset.cardView !== view) information.dataset.cardView = view;
  }
  function updateOverview(force = false, world = camera?.navigation?.capture()) {
    updateBodyCard(world);
    if (selectionPreview) return;
    const scope = overview && world ? overviewScopeAtCamera(world, overviewScope) : 'solar-system';
    if (!force && scope === overviewScope) return;
    overviewScope = scope;
    objectBrowser.setOverview(overview, scope);
    viewReadout.setOverviewScope(scope);
  }
  function own<T extends { destroy(): void }>(controller: T) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    if (DIAGNOSTICS_ENABLED) own(mountDiagnosticRecorder({ documentTarget, windowTarget, readCamera: () => camera }));
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime, onCategoryChange));
    sheet = own(createSheetController(documentTarget, windowTarget, lifetime));
    own(createExplorerRailController(documentTarget, windowTarget, {
      onOpenSolarSystem: () => objectBrowser.showSolarSystem(),
    }));
    lifetime.onDispose(() => disposeContent());
    lifetime.onDispose(() => selectionPreview?.restore());
    mountContent(objectId, motionEnabled, highContrastSky);
  } catch (error) {
    const cleanupErrors = lifetime.destroy();
    if (cleanupErrors.length) {
      throw new AggregateError([error, ...cleanupErrors], errorMessage(error), { cause: error });
    }
    throw error;
  }
  return Object.freeze({
    showDataset() { informationTabs.show('dataset'); },
    setDatasetNotice(message: string | null) {
      const notice = drawer.querySelector<HTMLElement>('[data-dataset-notice]');
      if (notice) { notice.textContent = message ?? ''; notice.hidden = message === null; }
    },
    beginCardNavigation(object: ObjectEntry, targetWorldCamera?: WorldCameraPose) {
      // Classify the endpoint once. Intermediate flight poses and the camera
      // handoff must not toggle the destination's retained overview/detail card.
      const transition: { view: 'detail' | 'overview' } = { view: targetWorldCamera
        ? bodyCardViewAtCamera(targetWorldCamera, object.worldFrame, camera?.navigation?.optics?.(), object.id)
        : 'detail' };
      cardNavigation = transition;
      return () => {
        if (cardNavigation !== transition) return;
        cardNavigation = null;
        updateBodyCard();
      };
    },
    beginOverviewSelection(scope: OverviewScope = 'solar-system') {
      selectionPreview?.restore();
      const restoreBrowser = objectBrowser.previewOverview(scope);
      const preview = { id: null, restore() {
        if (selectionPreview !== preview) return;
        selectionPreview = null;
        restoreBrowser();
      } };
      selectionPreview = preview;
      return preview.restore;
    },
    beginObjectSelection(object: ObjectEntry) {
      sheet.showSelection();
      selectionPreview?.restore();
      if (object.id === cardObjectId) {
        const restoreBrowser = objectBrowser.previewObject(object.name);
        const preview = { id: object.id, commit() { selectionPreview = null; }, restore() {
          if (selectionPreview !== preview) return;
          selectionPreview = null; restoreBrowser();
        } };
        selectionPreview = preview;
        updateBodyCard();
        return preview.restore;
      }
      const information = requiredElement(drawer, '.planet-information-panel');
      const previous = [...information.childNodes], restoreBrowser = objectBrowser.previewObject(object.name);
      const previousBusy = information.ariaBusy;
      const card = documentTarget.querySelector<HTMLTemplateElement>(`template[data-object-card="${object.id}"]`)
        ?.content.querySelector('.planet-information-panel');
      if (!card) throw new Error(`Prepared sidebar card is missing for ${object.id}.`);
      information.replaceChildren(...[...card.childNodes].map(node => node.cloneNode(true)));
      restorePanelState([...information.querySelectorAll<HTMLElement>(':scope > details, :scope > [data-information-panel] > details')].filter(node => node instanceof windowTarget.HTMLDetailsElement)
        .map(node => [panelKey(node), node] as const), object.id, windowTarget);
      for (const map of information.querySelectorAll<HTMLElement>('.planet-surface-minimap')) {
        if (!map.closest('[hidden], details:not([open])')) loadSurfacePreview(map);
      }
      // Detail controls wait for their renderer; navigation anchors stay usable
      // so another breadcrumb or moon can replace an in-progress selection.
      const pendingControls = [...information.querySelectorAll<HTMLElement>('.planet-card-tabs, [data-information-panel], .planet-destination-intro')]
        .filter(node => node.dataset.informationGroup !== 'overview')
        .map(node => [node, node.inert] as const);
      for (const [node] of pendingControls) node.inert = true;
      const previewLifetime = createSceneLifetime();
      createInformationTabsController(drawer, previewLifetime, 'overview');
      information.ariaBusy = 'true';
      const preview = { id: object.id, frame: object.worldFrame, commit() {
        previewLifetime.destroy();
        selectionPreview = null;
        information.ariaBusy = previousBusy;
        for (const [node, inert] of pendingControls) node.inert = inert;
      }, restore() {
        if (selectionPreview !== preview) return;
        previewLifetime.destroy();
        selectionPreview = null;
        information.replaceChildren(...previous);
        information.ariaBusy = previousBusy;
        restoreBrowser();
        updateBodyCard();
      } };
      selectionPreview = preview;
      updateBodyCard();
      return preview.restore;
    },
    setObject(content: NavigationContent) {
      if (lifetime.disposed) return;
      const preserveSidebar = selectionPreview?.id === content.id;
      if (preserveSidebar) selectionPreview?.commit?.();
      else selectionPreview?.restore();
      const motion = requiredElement<HTMLInputElement>(documentTarget, '.planet-motion-setting').checked;
      const contrast = requiredElement<HTMLInputElement>(documentTarget, '.planet-sky-contrast-setting').checked;
      disposeContent();
      content.apply({ preserveSidebar });
      cardObjectId = content.id;
      overview = false; overviewScope = 'solar-system';
      preparedFocus = null; focusCard.set(null);
      objectBrowser.setObject(content.name);
      mountContent(content.id, motion, contrast);
    },
    setDestinations(provider: PreparedDestinationRuntime | null | undefined) { if (!lifetime.disposed) objectBrowser.setDestinations(provider); },
    setPreparedFocus(record: PreparedCatalogObject | null, sources: readonly SpatialCatalogSource[] = [], presentation: PreparedFocusPresentation | null = null) {
      if (lifetime.disposed) return;
      preparedFocus = record; focusCard.set(record, sources, presentation);
      objectBrowser.setPreparedFocus(record); viewReadout.setPreparedFocus(record);
    },
    setOverview(enabled: boolean) {
      if (!lifetime.disposed) {
        if (enabled && selectionPreview?.id === null) selectionPreview = null;
        else if (!enabled && selectionPreview?.id === cardObjectId) selectionPreview?.commit?.();
        overview = enabled; updateOverview(true);
      }
    },
    setCamera(provider: ShellCamera | null) {
      if (!lifetime.disposed) {
        unsubscribeOverview?.(); camera = provider;
        minimapController.setCamera(provider); viewReadout.setCamera(provider);
        unsubscribeOverview = provider?.navigation?.subscribe(world => updateOverview(false, world)) ?? null;
        updateOverview(true);
      }
    },
    setMotionEnabled(enabled: boolean) { if (!lifetime.disposed) settingsController.setMotionEnabled(enabled); },
    setPlaybackState(state: PlaybackState) {
      if (!lifetime.disposed) {
        settingsController.setPlaybackState(state);
        minimapController.setPlaybackState(state);
        viewReadout.setPlaybackState(state);
      }
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Shell cleanup failed.");
    },
  });

  function disposeContent() {
    const errors = contentLifetime?.destroy() ?? [];
    contentLifetime = null;
    if (errors.length) throw new AggregateError(errors, 'Object shell content cleanup failed.');
  }
  function mountContent(id: string, motionEnabled: boolean, highContrastSky: boolean) {
    const owner = contentLifetime = createSceneLifetime();
    const retain = <T extends { destroy(): void }>(controller: T): T => { owner.onDispose(() => controller.destroy()); return controller; };
    informationTabs = retain(createInformationTabsController(drawer, owner));
    retain(createDatasetContextController(drawer, documentTarget, windowTarget, owner));
    retain(createChartSwitcherController(drawer, windowTarget, owner));
    retain(createChartPixelAlignmentController(drawer, windowTarget));
    retain(createLensBrowserController(drawer, windowTarget, owner));
    settingsController = retain(createSettingsController(documentTarget, windowTarget,
      { motionEnabled, onMotionChange, highContrastSky, onSkyContrastChange, heliosphereEnabled, asteroidOrbitsEnabled, asteroidLabelsEnabled,
        onHeliosphereChange(enabled) { heliosphereEnabled = enabled; onHeliosphereChange(enabled); },
        onAsteroidOrbitsChange(enabled) { asteroidOrbitsEnabled = enabled; onAsteroidOrbitsChange(enabled); },
        onAsteroidLabelsChange(enabled) { asteroidLabelsEnabled = enabled; onAsteroidLabelsChange(enabled); },
      }, owner));
    const surfaceReader = retain(createSurfaceMapReader({ documentTarget, windowTarget }));
    minimapController = retain(createSurfaceMinimap({ drawer, documentTarget, windowTarget, surfaceReader,
      onInteraction() { settingsController.setMotionEnabled(false); },
    }));
    viewReadout = retain(createViewReadout({ drawer, documentTarget, windowTarget, surfaceReader }));
    viewReadout.setPreparedFocus(preparedFocus);
    retain(createPanelController(drawer, id, windowTarget, owner));
  }
}

function createInformationTabsController(drawer: HTMLElement, lifetime: SceneLifetime, requestedGroup?: string) {
  return createTabsController(drawer.querySelector<HTMLElement>('.planet-information-panel'), lifetime, requestedGroup);
}

/** Shared tablist behaviour: selection, roving tabindex and arrow keys. */
export function createTabsController(card: HTMLElement | null, lifetime: SceneLifetime, requestedGroup?: string) {
  const group = (item: HTMLElement) => item.dataset.informationGroup ?? 'detail';
  const tabs = [...(card?.querySelectorAll<HTMLElement>('[data-information-tab]:not([hidden])') ?? [])]
    .filter(tab => requestedGroup === undefined || group(tab) === requestedGroup);
  const panels = [...(card?.querySelectorAll<HTMLElement>('[data-information-panel]') ?? [])];
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const select = (tab: HTMLElement, focus = false) => {
    for (const item of tabs.filter(item => group(item) === group(tab))) {
      const active = item === tab;
      item.setAttribute('aria-selected', String(active));
      item.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels.filter(panel => group(panel) === group(tab))) {
      panel.hidden = panel.dataset.informationPanel !== tab.dataset.informationTab;
    }
    if (focus) tab.focus();
  };
  for (const tab of tabs) {
    tab.addEventListener('click', () => select(tab), { signal: events.signal });
    tab.addEventListener('keydown', event => {
      const siblings = tabs.filter(item => group(item) === group(tab));
      const index = siblings.indexOf(tab);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1
        : event.key === 'ArrowRight' ? (index + 1) % siblings.length
        : event.key === 'ArrowLeft' ? (index - 1 + siblings.length) % siblings.length : null;
      if (next === null) return;
      event.preventDefault();
      select(siblings[next], true);
    }, { signal: events.signal });
  }
  return { show(id: string) {
    const tab = tabs.find(tab => tab.dataset.informationTab === id);
    if (tab) select(tab);
  }, destroy() { events.abort(); } };
}

function createLensBrowserController(drawer: HTMLElement, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const information = drawer.querySelector<HTMLElement>(".planet-information-panel");
  const root = information?.querySelector<HTMLElement>(".planet-lenses");
  if (!root || !information) {
    return Object.freeze({ destroy() {} });
  }

  const options = [...root.querySelectorAll("[data-lens-option]")]
    .filter((option) => option instanceof windowTarget.HTMLElement);
  const buttons = options.map((option) =>
    requiredElement<HTMLButtonElement>(option, 'button[name="lens"]'));
  if (options.length === 0 || buttons.some((button) =>
    !(button instanceof windowTarget.HTMLButtonElement))) {
    throw new Error("Planet shell surface lens browser has no valid lenses.");
  }

  const details = [...information.querySelectorAll<HTMLElement>("[data-lens-details]")];
  const lensIds = new Set(buttons.map((button) => button.value));
  if (details.some((detail) => !lensIds.has(detail.dataset.lensDetails ?? ""))) {
    throw new Error("Planet shell surface lens details have no matching lens.");
  }

  const renderSelection = () => {
    const activeLens = buttons.find((button) => button.ariaPressed === "true")
      ?.value;
    for (const detail of details) {
      detail.hidden = detail.dataset.lensDetails !== activeLens;
    }
  };
  const selectionObserver = new windowTarget.MutationObserver(renderSelection);
  lifetime.onDispose(() => selectionObserver.disconnect());
  for (const button of buttons) {
    selectionObserver.observe(button, {
      attributes: true,
      attributeFilter: ["aria-pressed"],
    });
  }

  renderSelection();

  return Object.freeze({
    destroy() {
      selectionObserver.disconnect();
      for (const detail of details) detail.hidden = true;
    },
  });
}

function createSettingsController(
  documentTarget: Document,
  windowTarget: BrowserWindow,
  { motionEnabled, onMotionChange, highContrastSky = false, onSkyContrastChange = () => {}, heliosphereEnabled, onHeliosphereChange,
    asteroidOrbitsEnabled, onAsteroidOrbitsChange, asteroidLabelsEnabled, onAsteroidLabelsChange }: Required<Pick<ShellOptions, 'motionEnabled' | 'onMotionChange' | 'heliosphereEnabled' | 'onHeliosphereChange' | 'asteroidOrbitsEnabled' | 'onAsteroidOrbitsChange' | 'asteroidLabelsEnabled' | 'onAsteroidLabelsChange'>> & { highContrastSky?: boolean; onSkyContrastChange?: (enabled: boolean) => void },
  lifetime: SceneLifetime,
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Planet shell motion change handler must be a function.");
  }
  const motion = documentTarget.querySelector(".planet-motion-setting");
  const heliosphere = documentTarget.querySelector(".planet-heliosphere-setting");
  const asteroidOrbits = documentTarget.querySelector(".planet-asteroid-orbits-setting");
  const asteroidLabels = documentTarget.querySelector(".planet-asteroid-labels-setting");
  const skyContrast = documentTarget.querySelector(
    ".planet-sky-contrast-setting",
  );
  const speed = documentTarget.querySelector(
    '.planet-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(asteroidOrbits instanceof windowTarget.HTMLInputElement) ||
      !(asteroidLabels instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement)) ||
      !(skyContrast instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Planet shell settings controls are incomplete.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let motionOn = motionEnabled === true;

  const renderMotion = () => {
    motion.checked = motionOn;
    if (speed) speed.disabled = !motionOn || speed.dataset?.runtimeReady === "false";
  };
  const renderSkyContrast = () => {
    skyContrast.checked = highContrastSky;
    documentTarget.body.dataset.skyContrast = highContrastSky
      ? "high"
      : "standard";
  };
  motion.addEventListener("change", () => {
    motionOn = motion.checked;
    renderMotion();
    onMotionChange(motionOn);
  }, { signal: events.signal });
  skyContrast.addEventListener("change", () => {
    highContrastSky = skyContrast.checked;
    renderSkyContrast();
    onSkyContrastChange(highContrastSky);
  }, { signal: events.signal });
  heliosphere.checked = heliosphereEnabled === true;
  heliosphere.addEventListener("change", () => onHeliosphereChange(heliosphere.checked), { signal: events.signal });
  const renderAsteroidOrbits = () => {
    asteroidOrbits.checked = asteroidOrbitsEnabled === true;
    documentTarget.body.dataset.asteroidOrbits = asteroidOrbits.checked ? 'on' : 'off';
  };
  asteroidOrbits.addEventListener("change", () => {
    asteroidOrbitsEnabled = asteroidOrbits.checked;
    renderAsteroidOrbits();
    onAsteroidOrbitsChange(asteroidOrbitsEnabled);
  }, { signal: events.signal });
  renderAsteroidOrbits();
  const renderAsteroidLabels = () => {
    asteroidLabels.checked = asteroidLabelsEnabled === true;
    documentTarget.body.dataset.asteroidLabels = asteroidLabels.checked ? 'on' : 'off';
  };
  asteroidLabels.addEventListener("change", () => {
    asteroidLabelsEnabled = asteroidLabels.checked;
    renderAsteroidLabels();
    onAsteroidLabelsChange(asteroidLabelsEnabled);
  }, { signal: events.signal });
  renderAsteroidLabels();
  renderMotion();
  renderSkyContrast();

  return Object.freeze({
    setMotionEnabled(next: boolean) {
      motionOn = next === true;
      renderMotion();
      onMotionChange(motionOn);
    },
    setPlaybackState({ motionRequested, reason }: PlaybackState) {
      motionOn = motionRequested === true;
      renderMotion();
      const row = motion.closest<HTMLElement>(".planet-motion-setting-control")!;
      const explanation = requiredElement(row, ".planet-motion-blocked");
      const blocked = motionOn && reason === "reduced-motion";
      row.dataset.motionBlocked = String(blocked);
      explanation.hidden = !blocked;
      const descriptions = new Set((motion.getAttribute("aria-describedby") ?? "")
        .split(/\s+/u).filter(id => id && id !== explanation.id));
      if (blocked) descriptions.add(explanation.id);
      if (descriptions.size) motion.setAttribute("aria-describedby", [...descriptions].join(" "));
      else motion.removeAttribute("aria-describedby");
    },
    destroy() {
      events.abort();
      delete documentTarget.body.dataset.skyContrast;
    },
  });
}

function createObjectBrowserController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime,
  onCategoryChange: (classification: string | null) => void = () => {}) {
  const setPanelHidden = (panel: HTMLElement, hidden: boolean) => {
    if (panel.hidden !== hidden) panel.hidden = hidden;
    const inert = hidden || panel.ariaBusy === 'true';
    if (panel.inert !== inert) panel.inert = inert;
  };
  const search = documentTarget.querySelector(".planet-sidebar-search");
  const searchCard = documentTarget.querySelector(".planet-sidebar-search-card");
  const trigger = documentTarget.querySelector(".planet-sidebar-view-all");
  const information = documentTarget.querySelector(".planet-information-panel");
  const browser = documentTarget.querySelector(".planet-object-browser");
  const empty = documentTarget.querySelector(".planet-object-empty");
  const galaxy = browser?.querySelector<HTMLElement>('[data-galactic-overview]');
  const focusCard = browser?.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const system = browser?.querySelector<HTMLElement>('[data-solar-system-results]');
  if (!(search instanceof windowTarget.HTMLInputElement) ||
      !(searchCard instanceof windowTarget.HTMLElement) ||
      !(trigger instanceof windowTarget.HTMLButtonElement) ||
      !(information instanceof windowTarget.HTMLElement) ||
      !(browser instanceof windowTarget.HTMLElement) ||
      !(empty instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell object browser is incomplete.");
  }
  const items = [...browser.querySelectorAll<HTMLElement>(".planet-object-item")]
    .filter((item) => item instanceof windowTarget.HTMLLIElement);
  if (items.length === 0) {
    throw new Error("Planet shell object browser has no objects.");
  }
  const tabs = [...browser.querySelectorAll<HTMLElement>('[data-object-tab]')];
  const resultsPanel = requiredElement(browser, '#object-category-results');
  const chunks = [...browser.querySelectorAll<HTMLElement>('.planet-object-chunk')]
    .map(node => ({ node, items: [...node.querySelectorAll<HTMLElement>('.planet-object-item')] }));
  const refreshChunks = () => {
    for (const { node, items: rows } of chunks) {
      const count = rows.filter(item => !item.hidden).length;
      if (node.hidden !== (count === 0)) node.hidden = count === 0;
      const height = `${Math.max(0, count * 28 - 8)}px`;
      if (node.style.containIntrinsicBlockSize !== height) node.style.containIntrinsicBlockSize = height;
    }
  };
  if (chunks.length && typeof windowTarget.IntersectionObserver === 'function') {
    const observer = new windowTarget.IntersectionObserver(changes => {
      for (const { target, isIntersecting } of changes) target.toggleAttribute('data-in-view', isIntersecting);
    }, { root: resultsPanel, rootMargin: '100px 0px' });
    for (const { node } of chunks) observer.observe(node);
    resultsPanel.dataset.groupedVisibility = '';
    lifetime.onDispose(() => observer.disconnect());
  }
  browser.dataset.retained = '';
  information.dataset.retained = '';
  const distanceOrder = items.toSorted((a, b) => Number(a.dataset.objectDistanceAu) - Number(b.dataset.objectDistanceAu));
  const planetOrder = [
    ...distanceOrder.filter(item => item.dataset.objectClassification === 'planet'),
    ...distanceOrder.filter(item => item.dataset.objectClassification !== 'planet'),
  ];
  let activeCategory = tabs.find(tab => tab.getAttribute('aria-selected') === 'true')?.dataset.objectTab ?? 'planet';
  // Reset the outgoing layout before changing result visibility. Hidden panels
  // were reset when closed, so opening one needs no synchronous layout readback.
  const resetResultsScroll = () => { if (!browser.hidden) resultsPanel.scrollTop = 0; };
  const selectTab = (classification: string, { focus = false, resetScroll = true } = {}) => {
    if (resetScroll) resetResultsScroll();
    if (classification !== activeCategory) {
      // Reorder the retained rows inside their existing layout groups.
      const order = classification === 'planet' ? planetOrder : distanceOrder;
      for (const [index, chunk] of chunks.entries()) {
        chunk.items = order.slice(index * 16, (index + 1) * 16);
        requiredElement(chunk.node,'.planet-object-chunk-list').append(...chunk.items);
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
    for (const item of items) item.hidden = item.dataset.objectMatch !== 'true'
      || !matchesObjectCategory(item.dataset.objectClassification, classification);
    refreshChunks();
    visibleObjects = items.filter(item => !item.hidden).length;
    empty.hidden = visibleObjects > 0;
  };

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let selectedObjectName = "";
  let overview = false;
  let overviewScope: OverviewScope = 'solar-system';
  let preparedFocus: PreparedCatalogObject | null = null;
  const overviewName = () => overviewScope === 'milky-way' ? 'Milky Way' : 'Solar System';
  let visibleObjects = 0;
  const destinations = createDestinationBrowser({
    documentTarget,
    onResults(count) { empty.hidden = visibleObjects + count > 0; },
    onSelected() { render(false); search.blur(); },
    onReset() { render(false); },
  });
  lifetime.onDispose(() => destinations?.destroy());
  let open = false;
  let browsing = false;
  const categoryButtons = [...documentTarget.querySelectorAll<HTMLElement>('.planet-search-category')];
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
  const filter = (resetScroll = true) => {
    if (resetScroll) resetResultsScroll();
    markCategory();
    // Search text belongs to the user; the card context is only a fallback.
    const query = (browsing ? search.value.trim().toLocaleLowerCase("en") : "")
      || (preparedFocus ? preparedFocus.name.toLocaleLowerCase('en')
        : overview ? overviewName().toLocaleLowerCase("en") : "");
    setPanelHidden(information, query.length > 0);
    destinations?.setOpen(query.length > 0);
    const focused = preparedFocus && query === preparedFocus.name.toLocaleLowerCase('en');
    const galactic = !focused && query === 'milky way';
    if (focusCard) setPanelHidden(focusCard, !focused);
    if (galaxy) setPanelHidden(galaxy, !galactic);
    if (system) setPanelHidden(system, galactic || Boolean(focused));
    if (focused && preparedFocus) {
      browser.ariaLabel = preparedFocus.name;
      setPanelHidden(browser, false); empty.hidden = true; visibleObjects = 1;
      void destinations?.search('');
      return;
    }
    browser.ariaLabel = galactic ? 'Milky Way' : 'Solar System objects';
    if (galactic) {
      setPanelHidden(browser, false); empty.hidden = true; visibleObjects = 1;
      void destinations?.search('');
      return;
    }
    const showAll = query === "all objects";
    const classification = items.find(item => {
      const name = item.dataset.objectClassificationName;
      return name && (query === name || query === `${name}s` || query === item.dataset.objectClassification);
    })?.dataset.objectClassification;
    markCategory(classification);
    const systemName = items.find(item =>
      query === item.dataset.objectSystemName)?.dataset.objectSystemName;
    visibleObjects = 0;
    void destinations?.search(classification || systemName || showAll ? "" : query);
    if (query.length === 0) {
      for (const item of items) item.hidden = true;
      empty.hidden = true;
      setPanelHidden(browser, true);
      return;
    }
    setPanelHidden(browser, false);
    for (const item of items) {
      // A class search stays exact inside grouped tabs; only Planets deliberately includes dwarf planets.
      const match = classification && classification !== "planet" ? item.dataset.objectClassification === classification
        : showAll || classification || (systemName
        ? item.dataset.objectSystemName === systemName
        : (item.dataset.objectName ?? "").includes(query));
      item.dataset.objectMatch = String(Boolean(match));
    }
    const matches = items.filter(item => item.dataset.objectMatch === 'true');
    const classifications = matches.map(item => item.dataset.objectClassification);
    for (const tab of tabs) {
      requiredElement(tab, '.planet-object-tab-count').textContent = `(${objectCategoryCount(classifications, tab.dataset.objectTab)})`;
    }
    const nextCategory = classification ? objectCategory(classification)
      : showAll ? 'all' : matches.some(item => matchesObjectCategory(item.dataset.objectClassification, activeCategory))
        ? activeCategory : objectCategory(matches[0]?.dataset.objectClassification) ?? activeCategory;
    selectTab(nextCategory, { resetScroll: false });
    empty.hidden = visibleObjects !== 0 || Boolean(destinations && !classification && !showAll);
  };
  const render = (next: boolean, { resetQuery = false } = {}) => {
    resetResultsScroll();
    if (!next) browsing = false;
    if ((preparedFocus || overview) && !next) next = true;
    open = next;
    if (next && resetQuery) search.value = "";
    destinations?.setOpen(next);
    setPanelHidden(information, next);
    setPanelHidden(browser, !next);
    if (next) filter(false);
    else markCategory();
  };

  trigger.addEventListener("click", () => {
    browsing = true;
    render(true);
    search.focus();
  }, {
    signal: events.signal,
  });
  // Clearing empties the query and returns to the selected card, like Escape.
  documentTarget.querySelector<HTMLElement>('.planet-sidebar-search-clear')?.addEventListener('click', () => {
    search.value = "";
    render(false);
    search.focus();
  }, { signal: events.signal });
  for (const button of categoryButtons) {
    button.addEventListener('click', () => {
      search.value = button.dataset.searchQuery ?? "";
      search.dispatchEvent(new windowTarget.Event('input', { bubbles: true }));
      requiredElement(documentTarget, '.planet-sidebar').scrollTop = 0;
      // Frame every body of this classification; the router owns the camera flight.
      button.dispatchEvent(new windowTarget.CustomEvent('categorynavigate', { bubbles: true,
        detail: { classification: button.dataset.searchClassification } }));
    }, { signal: events.signal });
    button.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      render(false);
      search.focus();
    }, { signal: events.signal });
  }
  for (const tab of tabs) {
    tab.addEventListener('click', () => selectTab(tab.dataset.objectTab ?? "all"), { signal: events.signal });
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
  const visibleControl = (element: HTMLElement) => !('disabled' in element && element.disabled) && !element.closest('[hidden], .planet-breadcrumbs')
    && (element.classList.contains('planet-object-link') || element.getClientRects().length > 0);
  search.addEventListener("keydown", (event) => {
    if (open && (event.key === "Enter" || event.key === "ArrowDown")) {
      const first = [...browser.querySelectorAll<HTMLElement>("a, button")].find(visibleControl);
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
    const controls = [...browser.querySelectorAll<HTMLElement>("summary, a, button")].filter(visibleControl);
    const index = controls.findIndex(control => control === documentTarget.activeElement);
    if (event.key === "Escape") { render(false); search.focus(); }
    else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = index + (event.key === "ArrowDown" ? 1 : -1);
      if (next < 0) search.focus(); else controls[Math.min(next, controls.length - 1)]?.focus();
    }
  }, { signal: events.signal });
  documentTarget.querySelector(".planet-find-destination")?.addEventListener("click", () => {
    browsing = true;
    render(true, { resetQuery: true });
  }, { signal: events.signal });
  documentTarget.addEventListener("pointerdown", (event) => {
    if (documentTarget.activeElement !== search ||
        !(event.target instanceof windowTarget.Node) ||
        searchCard.contains(event.target)) return;
    search.blur();
  }, { signal: events.signal });
  render(false);

  const markSelection = () => {
    documentTarget.documentElement.dataset.selection = preparedFocus ? 'prepared-focus' : overview ? overviewScope : 'object';
    for (const anchor of browser.querySelectorAll<HTMLElement>('.planet-object-link')) {
      const selected = !preparedFocus && !overview && anchor.querySelector('.planet-object-name')?.textContent === selectedObjectName;
      anchor.classList.toggle('is-active', selected);
      if (selected) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  };
  return Object.freeze({
    previewOverview(scope: OverviewScope = 'solar-system') {
      const previous = { selectedObjectName, overview, overviewScope, preparedFocus, browsing };
      preparedFocus = null;
      overview = true; overviewScope = scope; browsing = false;
      markSelection(); render(false);
      return () => {
        const editing = browsing;
        ({ selectedObjectName, overview, overviewScope, preparedFocus } = previous);
        browsing = editing || previous.browsing;
        markSelection(); render(browsing);
      };
    },
    previewObject(name: string) {
      const previous = { selectedObjectName, overview, overviewScope, preparedFocus, browsing };
      preparedFocus = null;
      overview = false; selectedObjectName = name;
      markSelection(); render(false);
      return () => {
        const editing = browsing;
        ({ selectedObjectName, overview, overviewScope, preparedFocus } = previous);
        browsing = editing || previous.browsing;
        markSelection(); render(browsing);
      };
    },
    showSolarSystem() {
      overview = true; overviewScope = "solar-system";
      markSelection(); render(false);
    },
    setOverview(enabled: boolean, scope: OverviewScope = 'solar-system') {
      const editing = browsing;
      overview = enabled;
      overviewScope = scope;
      markSelection();
      if (enabled) destinations?.bind(null);
      render(editing);
    },
    setObject(name: string) {
      // A completed flight publishes the selection, but a newer search owns
      // its query and results until the user chooses or dismisses them.
      const editing = browsing;
      overview = false;
      preparedFocus = null;
      selectedObjectName = name;
      markSelection();
      destinations?.bind(null);
      render(editing);
    },
    setDestinations(provider: PreparedDestinationRuntime | null | undefined) { destinations?.bind(provider); },
    setPreparedFocus(record: PreparedCatalogObject | null) {
      if (preparedFocus === record) return;
      const editing = browsing;
      preparedFocus = record; markSelection(); render(editing);
    },
    destroy() {
      events.abort();
      destinations?.destroy();
      for (const item of items) item.hidden = false;
      empty.hidden = true;
      render(false);
    },
  });
}

function createChartSwitcherController(drawer: HTMLElement, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const switcher = drawer.querySelector<HTMLElement>(".planet-chart-switcher");
  if (switcher === null) {
    return Object.freeze({ destroy() {} });
  }
  if (!(switcher instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell chart switcher is invalid.");
  }
  const previous = switcher.querySelector('.planet-chart-step[data-chart-step="-1"]');
  const next = switcher.querySelector('.planet-chart-step[data-chart-step="1"]');
  const slides = [...switcher.querySelectorAll(".planet-chart-slide")]
    .filter((slide) => slide instanceof windowTarget.HTMLElement);
  const labels = [...switcher.querySelectorAll(".planet-chart-label")]
    .filter((label) => label instanceof windowTarget.HTMLElement);
  if (!(previous instanceof windowTarget.HTMLButtonElement) ||
      !(next instanceof windowTarget.HTMLButtonElement) ||
      slides.length === 0 || labels.length !== slides.length) {
    throw new Error("Planet shell chart switcher is incomplete.");
  }
  const chartIds = slides.map((slide) => slide.dataset.chartId ?? "");
  if (chartIds.some((id) => id.length === 0) ||
      new Set(chartIds).size !== chartIds.length ||
      labels.some((label) => !chartIds.includes(label.dataset.chartLabel ?? ""))) {
    throw new Error("Planet shell chart switcher identities are incomplete.");
  }

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let activeIndex = Math.max(0, chartIds.indexOf(switcher.dataset.activeChart ?? ""));
  const render = (index: number, notify = true) => {
    activeIndex = (index + slides.length) % slides.length;
    const activeId = chartIds[activeIndex];
    switcher.dataset.activeChart = activeId;
    for (const slide of slides) slide.hidden = slide.dataset.chartId !== activeId;
    for (const label of labels) label.hidden = label.dataset.chartLabel !== activeId;

    const previousSlide = slides[(activeIndex - 1 + slides.length) % slides.length];
    const nextSlide = slides[(activeIndex + 1) % slides.length];
    previous.ariaLabel = `Previous chart: ${previousSlide.dataset.chartTitle}`;
    next.ariaLabel = `Next chart: ${nextSlide.dataset.chartTitle}`;
    previous.disabled = slides.length < 2;
    next.disabled = slides.length < 2;
    if (notify) switcher.dispatchEvent(new windowTarget.Event("chartchange"));
  };
  for (const button of [previous, next]) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      render(activeIndex + Number(button.dataset.chartStep));
    }, { signal: events.signal });
  }
  render(activeIndex, false);

  return Object.freeze({
    destroy() {
      events.abort();
    },
  });
}

type SheetState = typeof MOBILE_SHEET_POLICY.states[number];
type SheetStops = Readonly<Record<SheetState, number>>;
interface SheetGesture {
  pointerId: number; x: number; y: number; start: number; offset: number; stops: SheetStops;
  fromHandle: boolean; active: boolean; lastY: number; lastTime: number; velocity: number;
}

// Phones show information in a bottom sheet that snaps between the heights
// declared in shell-layout.css. Wider layouts ignore every sheet gesture.
function createSheetController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const sheet = documentTarget.querySelector(".planet-sidebar");
  const handle = documentTarget.querySelector(".planet-sheet-handle");
  const search = documentTarget.querySelector(".planet-sidebar-search");
  if (!(sheet instanceof windowTarget.HTMLElement) ||
      !(handle instanceof windowTarget.HTMLButtonElement) ||
      !(search instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Planet shell sheet is incomplete.");
  }
  const { body } = documentTarget;
  const { states, dragSlopPixels, flingPixelsPerMillisecond, flingFreshnessMilliseconds,
    overdragPixels, overdragResistance } = MOBILE_SHEET_POLICY;
  const mobile = windowTarget.matchMedia(MOBILE_VIEWPORT_QUERY);
  const events = new AbortController();
  const { signal } = events;
  lifetime.onDispose(() => events.abort());
  let state: SheetState = "peek";
  // Search opens the whole sheet; leaving search returns to the earlier height.
  let searchReturn: SheetState | null = null;
  let gesture: SheetGesture | null = null;
  let dragged = false;
  let snapFrame = 0;
  lifetime.onDispose(() => {
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = 0;
  });

  // Distances from the fully open sheet down to each snap state.
  const stops = (): SheetStops => {
    const style = windowTarget.getComputedStyle(sheet);
    const peek = Number.parseFloat(style.getPropertyValue("--sheet-peek"));
    const half = Number.parseFloat(style.getPropertyValue("--sheet-half"));
    if (!Number.isFinite(peek) || !Number.isFinite(half)) {
      throw new Error("Planet shell sheet heights are missing.");
    }
    const height = sheet.offsetHeight;
    return { peek: Math.max(0, height - peek), half: Math.max(0, height - half), full: 0 };
  };
  const currentOffset = () => {
    const transform = windowTarget.getComputedStyle(sheet).transform;
    return transform === "none" ? 0 : new windowTarget.DOMMatrixReadOnly(transform).m42;
  };
  const nearest = (offset: number, points: SheetStops, candidates: readonly SheetState[] = states) =>
    candidates.reduce((best, next) =>
      Math.abs(points[next] - offset) < Math.abs(points[best] - offset) ? next : best);
  const settle = (next: SheetState, speed = 0) => {
    const points = stops();
    const distance = Math.min(1, Math.abs(points[next] - currentOffset()) / Math.max(1, points.peek));
    const velocity = Math.min(1, Math.abs(speed) / 1.2);
    const duration = Math.round(Math.max(180, Math.min(340, 220 + 120 * distance - 60 * velocity)));
    sheet.style.setProperty("--sheet-snap-duration", `${duration}ms`);
    if (next !== "full") sheet.scrollTop = 0;
    state = next;
    body.dataset.sheet = next;
    handle.ariaExpanded = String(next !== "peek");
    sheet.classList.remove("is-dragging");
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = windowTarget.requestAnimationFrame(() => {
      snapFrame = 0;
      if (!lifetime.disposed) sheet.style.removeProperty("transform");
    });
  };
  // Scrolled content keeps its own drags until it returns to the top.
  const scrolled = (target: EventTarget | null) => {
    for (let node = target instanceof windowTarget.Element ? target : null; node; node = node.parentElement) {
      if (node.scrollTop > 0) return true;
      if (node === sheet) return false;
    }
    return false;
  };
  const ownsGesture = (target: EventTarget | null) => target instanceof windowTarget.Element &&
    target.closest("input, select, textarea, [data-surface-minimap]") !== null;

  sheet.addEventListener("pointerdown", (event) => {
    dragged = false;
    if (!mobile.matches || !event.isPrimary || event.button > 0 || ownsGesture(event.target)) return;
    const fromHandle = event.target instanceof windowTarget.Node && handle.contains(event.target);
    if (state === "full" && !fromHandle && scrolled(event.target)) return;
    const start = currentOffset();
    gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, start, offset: start,
      stops: stops(), fromHandle, active: false, lastY: event.clientY, lastTime: event.timeStamp, velocity: 0 };
  }, { signal });

  // A quick pointer can leave the sheet before the drag captures it, so the
  // gesture follows the document until it becomes a drag.
  documentTarget.addEventListener("pointermove", (event) => {
    const drag = gesture;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active) {
      if (Math.hypot(dx, dy) < dragSlopPixels) return;
      // Sideways swipes belong to carousels; pulling up an open sheet scrolls it.
      if (Math.abs(dx) > Math.abs(dy) || (state === "full" && !drag.fromHandle && dy < 0)) {
        gesture = null;
        return;
      }
      drag.active = true;
      sheet.setPointerCapture(event.pointerId);
      sheet.classList.add("is-dragging");
    }
    const raw = drag.start + dy;
    const overdrag = (distance: number) => Math.min(overdragPixels, distance * overdragResistance);
    drag.offset = raw < 0 ? -overdrag(-raw)
      : raw > drag.stops.peek ? drag.stops.peek + overdrag(raw - drag.stops.peek) : raw;
    const elapsed = event.timeStamp - drag.lastTime;
    if (elapsed > 0) drag.velocity = 0.8 * (event.clientY - drag.lastY) / elapsed + 0.2 * drag.velocity;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;
    sheet.style.transform = `translate3d(0, ${drag.offset}px, 0)`;
  }, { signal });

  const release = (event: PointerEvent) => {
    const drag = gesture;
    if (drag === null || event.pointerId !== drag.pointerId) return;
    gesture = null;
    if (!drag.active) return;
    dragged = true;
    searchReturn = null;
    if (event.type === "pointercancel") {
      settle(state);
      return;
    }
    // A pause before release places the sheet; a flick carries it to the next stop.
    const velocity = event.timeStamp - drag.lastTime > flingFreshnessMilliseconds ? 0 : drag.velocity;
    const ahead = states.filter((candidate) => velocity < 0
      ? drag.stops[candidate] < drag.offset - 1
      : drag.stops[candidate] > drag.offset + 1);
    settle(Math.abs(velocity) >= flingPixelsPerMillisecond && ahead.length > 0
      ? nearest(drag.offset, drag.stops, ahead)
      : nearest(drag.offset, drag.stops), velocity);
  };
  documentTarget.addEventListener("pointerup", release, { signal });
  documentTarget.addEventListener("pointercancel", release, { signal });
  // Once the sheet follows a finger, native scrolling must not claim the touch.
  sheet.addEventListener("touchmove", (event) => {
    if (gesture?.active) event.preventDefault();
  }, { passive: false, signal });
  sheet.addEventListener("click", (event) => {
    if (!dragged) return;
    dragged = false;
    event.preventDefault();
    event.stopPropagation();
  }, { capture: true, signal });

  handle.addEventListener("click", () => {
    if (!mobile.matches) return;
    searchReturn = null;
    settle(state === "peek" ? "half" : state === "half" ? "full" : "peek");
  }, { signal });
  handle.addEventListener("keydown", (event) => {
    const step = event.key === "ArrowUp" ? 1 : event.key === "ArrowDown" ? -1 : 0;
    if (step === 0 || !mobile.matches) return;
    event.preventDefault();
    settle(states[Math.max(0, Math.min(states.length - 1, states.indexOf(state) + step))] ?? state);
  }, { signal });

  const openSearch = () => {
    if (!mobile.matches || state === "full") return;
    searchReturn = state;
    settle("full");
  };
  const closeSearch = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || searchReturn === null) return;
    const previous = searchReturn;
    searchReturn = null;
    settle(previous);
  };
  search.addEventListener("focus", openSearch, { signal });
  search.addEventListener("input", openSearch, { signal });
  search.addEventListener("keydown", closeSearch, { signal });
  sheet.addEventListener("keydown", closeSearch, { signal });
  mobile.addEventListener("change", () => {
    gesture = null;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("transform");
  }, { signal });

  body.dataset.sheet = state;
  handle.ariaExpanded = "false";
  return Object.freeze({
    // A choice from search reveals its card over the scene.
    showSelection() {
      if (!mobile.matches || state !== "full") return;
      searchReturn = null;
      settle("peek");
    },
    destroy() {
      events.abort();
      gesture = null;
      sheet.classList.remove("is-dragging");
      sheet.style.removeProperty("transform");
      sheet.style.removeProperty("--sheet-snap-duration");
      delete body.dataset.sheet;
      handle.ariaExpanded = "false";
    },
  });
}

function createPanelController(drawer: HTMLElement, objectId: string, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const storageKey = `css.earth:${objectId}:panels`;
  const informationPanel = drawer.querySelector<HTMLElement>(".planet-information-panel");
  if (!(informationPanel instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell combined information panel is missing.");
  }
  const panels = [...informationPanel.querySelectorAll<HTMLElement>(':scope > details, :scope > [data-information-panel] > details')]
    .filter((element) => element instanceof windowTarget.HTMLDetailsElement)
    .map((panel) => [panelKey(panel), panel] as const);

  restorePanelState(panels, objectId, windowTarget);

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const save = () => {
    try {
      windowTarget.localStorage.setItem(
        storageKey,
        JSON.stringify(
          panels.filter(([, panel]) => panel.open).map(([name]) => name),
        ),
      );
    } catch {}
  };
  for (const [, panel] of panels) {
    panel.addEventListener("toggle", save, { signal: events.signal });
  }

  return Object.freeze({
    destroy() {
      events.abort();
    },
  });
}

function restorePanelState(panels: readonly Panel[], objectId: string, windowTarget: Window) {
  try {
    const saved: unknown = JSON.parse(windowTarget.localStorage.getItem(`css.earth:${objectId}:panels`) ?? "null");
    if (Array.isArray(saved) && saved.every(id => typeof id === 'string')) {
      const openPanels = new Set(saved);
      for (const [name, panel] of panels) panel.open = openPanels.has(name);
    }
  } catch {}
}

function panelKey(panel: HTMLDetailsElement) {
  if (!panel.id) throw new Error("Planet shell panel identity is missing.");
  return panel.id;
}
