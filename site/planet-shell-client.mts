import { selectGalaxyNeighbor } from './galaxy-neighbor-selection.mts';
import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import { readInitialFocus } from './focus-catalog.mts';
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
export interface ShellOptions { objectId: string; documentTarget?: Document; windowTarget?: BrowserWindow; motionEnabled?: boolean; onMotionChange?(enabled: boolean): void; heliosphereEnabled?: boolean; onHeliosphereChange?(enabled: boolean): void; illustrationModelsEnabled?: boolean; onIllustrationModelsChange?(enabled: boolean): void; surfaceLabelsEnabled?: boolean; onSurfaceLabelsChange?(enabled: boolean): void; minimapEnabled?: boolean; onMinimapChange?(enabled: boolean): void; threeDStarsEnabled?: boolean; onThreeDStarsChange?(enabled: boolean): void; onCategoryChange?(classification: string | null): void; }
interface SelectionPreview { id: string | null; frame?: PreparedWorldCameraFrame | null; commit?(): void; restore(): void; }
type Panel = readonly [string, HTMLDetailsElement];
import { matchesObjectCategory, objectCategoryCount } from "./object-categories.mts";
import { createDatasetContextController } from './dataset-context-controller.mts';
import { renderSourceLink, sourceDocuments } from './source-link.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createChartPixelAlignmentController } from "./chart-pixel-alignment.mts";
import { createDestinationBrowser } from "./destination-browser.mts";
import { createFeatureBrowser } from "./feature-browser.mts";
import { objectSearchLabels, searchObjects, type ObjectSearchLabels } from './object-search.mts';
import { presentOverviewResults, presentSearchResults } from './search-results-presentation.mts';
import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { createSceneLifetime } from "@cssearth/engine";
import { createExplorerRailController } from "./explorer-rail.mts";
import { createSurfaceMinimap, loadSurfacePreview } from "./surface-minimap.mts";
import { createViewReadout } from "./view-readout.mts";
import { createSurfaceMapReader } from "./surface-map-context.mts";
import { mountDiagnosticRecorder } from './diagnostic-recorder.mts';
import { bodyCardViewAtCamera, overviewScopeAtCamera } from './overview-context.mts';
import { bindNavigationIntent, navigationFragments } from './navigation-fragments.mts';
import { loadCatalogueFragment, loadCatalogueIndex, readCatalogueFragmentPin, readCatalogueIndexPin } from './catalogue-fragment-loader.mts';
import type { CatalogueIndexEntry } from './catalogue-index.mts';
import { createCatalogueWindow } from './catalogue-window.mts';
import { createNavigationTreeController } from './navigation-tree-client.mts';
import { SCENE_OBJECTS } from './objects.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';
import { objectClassificationLabel } from './planet-search-objects.mts';
import { MOBILE_SHEET_POLICY, MOBILE_VIEWPORT_QUERY, mobileSheetKeyboardInset } from './runtime-policy.mts';

export function mountPlanetShell({
  objectId,
  documentTarget = document,
  windowTarget = window,
  motionEnabled = false,
  onMotionChange = () => {},
  heliosphereEnabled = false,
  onHeliosphereChange = () => {},
  illustrationModelsEnabled = false,
  onIllustrationModelsChange = () => {},
  surfaceLabelsEnabled = false,
  onSurfaceLabelsChange = () => {},
  minimapEnabled = false,
  onMinimapChange = () => {},
  threeDStarsEnabled = false,
  onThreeDStarsChange = () => {},
  onCategoryChange = () => {},
}: ShellOptions) {
  const drawer = requiredElement(documentTarget, ".planet-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  const fragments = navigationFragments(windowTarget);
  let informationTabs: ReturnType<typeof createInformationTabsController>;
  let sheet: ReturnType<typeof createSheetController>;
  let settingsController: ReturnType<typeof createSettingsController>, objectBrowser: ReturnType<typeof createObjectBrowserController>, contentLifetime: SceneLifetime | null, minimapController: ReturnType<typeof createSurfaceMinimap>, viewReadout: ReturnType<typeof createViewReadout>;
  let selectionPreview: SelectionPreview | null = null;
  let cardNavigation: { view: 'detail' | 'overview' } | null = null;
  let cardObjectId = objectId;
  let overview = false, overviewScope: OverviewScope = 'system', camera: ShellCamera | null = null, unsubscribeOverview: (() => void) | null = null;
  let preparedFocus: PreparedCatalogObject | null = readInitialFocus(documentTarget);
  const focusRoot = drawer.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const focusTabs = createTabsController(focusRoot, lifetime, 'prepared-focus');
  const focusCard = createPreparedFocusCard(focusRoot, id => focusTabs.show(id));
  lifetime.onDispose(() => focusCard.destroy());
  lifetime.onDispose(() => unsubscribeOverview?.());
  // The card panel is retained; a camera frame re-queries it only after a card swap.
  let information: HTMLElement | null = null;
  function updateBodyCard(world = camera?.navigation?.capture()) {
    if (!information?.isConnected || !drawer.contains(information)) information = drawer.querySelector<HTMLElement>('.planet-information-panel');
    const previous = information?.dataset.cardView;
    const view = cardNavigation?.view ?? bodyCardViewAtCamera(world, selectionPreview?.frame ?? camera?.navigation?.frame,
      camera?.navigation?.optics?.(), selectionPreview?.id ?? cardObjectId,
      previous === 'detail' || previous === 'overview' ? previous : undefined);
    if (information && information.dataset.cardView !== view) information.dataset.cardView = view;
  }
  function updateOverview(force = false, world = camera?.navigation?.capture()) {
    updateBodyCard(world);
    if (selectionPreview) return;
    const scope = overview && world ? overviewScopeAtCamera(world, overviewScope) : 'system';
    if (!force && scope === overviewScope) return;
    overviewScope = scope;
    // An overview mounts its system's star, so the card's object names the system.
    objectBrowser.setOverview(overview, scope, cardObjectId);
    viewReadout.setOverviewScope(scope);
  }
  function own<T extends { destroy(): void }>(controller: T) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    if (DIAGNOSTICS_ENABLED) own(mountDiagnosticRecorder({ documentTarget, windowTarget, readCamera: () => camera }));
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime, { objectId, onCategoryChange, illustrationModelsEnabled }));
    // Hover, focus or press on another body fetches its card before the click.
    own(bindNavigationIntent({ documentTarget, windowTarget, objects: SCENE_OBJECTS, fragments, skip: id => id === cardObjectId }));
    sheet = own(createSheetController(documentTarget, windowTarget, lifetime));
    own(createExplorerRailController(documentTarget, windowTarget, {
      onOpenSolarSystem: () => objectBrowser.showSystem(SOLAR_SYSTEM_ID),
    }));
    lifetime.onDispose(() => disposeContent());
    lifetime.onDispose(() => selectionPreview?.restore());
    mountContent(objectId, motionEnabled);
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
    beginOverviewSelection(scope: OverviewScope, systemId: string) {
      selectionPreview?.restore();
      const restoreBrowser = objectBrowser.previewOverview(scope, systemId);
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
      const previewLifetime = createSceneLifetime();
      let pendingControls: (readonly [HTMLElement, boolean])[] = [];
      const showCard = (card: Element) => {
        information.replaceChildren(...[...card.childNodes].map(node => documentTarget.importNode(node, true)));
        restorePanelState([...information.querySelectorAll<HTMLElement>(':scope > details, :scope > [data-information-panel] > details')].filter(node => node instanceof windowTarget.HTMLDetailsElement)
          .map(node => [panelKey(node), node] as const), object.id, windowTarget);
        for (const map of information.querySelectorAll<HTMLElement>('.planet-surface-minimap')) {
          if (!map.closest('[hidden], details:not([open])')) loadSurfacePreview(map);
        }
        // Detail controls wait for their renderer; navigation anchors stay usable
        // so another breadcrumb or moon can replace an in-progress selection.
        pendingControls = [...information.querySelectorAll<HTMLElement>('.planet-card-tabs, [data-information-panel], .planet-destination-intro')]
          .filter(node => node.dataset.informationGroup !== 'overview')
          .map(node => [node, node.inert] as const);
        for (const [node] of pendingControls) node.inert = true;
        createInformationTabsController(drawer, previewLifetime, 'overview');
      };
      // The destination's static fragment is its card; intent usually fetched it.
      const cached = fragments.peek(object.id);
      const card = cached?.document.querySelector('.planet-information-panel');
      if (cached && card) {
        try { showCard(card); } finally { cached.release(); }
      }
      else {
        cached?.release();
        // Registry facts show at once; the card follows its fragment without
        // blocking the flight. A failed fragment fails the destination load.
        information.replaceChildren(objectCardPreview(documentTarget, object));
        fragments.get(object.id).then(fragment => {
          try {
            const arrived = fragment.document.querySelector('.planet-information-panel');
            if (arrived && selectionPreview === preview) { showCard(arrived); updateBodyCard(); }
          } finally { fragment.release(); }
        }, () => {});
      }
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
      disposeContent();
      content.apply({ preserveSidebar });
      cardObjectId = content.id;
      overview = false; overviewScope = 'system';
      preparedFocus = null; focusCard.set(null);
      objectBrowser.setObject(content.name);
      mountContent(content.id, motion);
    },
    setDestinations(provider: PreparedDestinationRuntime | null | undefined) { if (!lifetime.disposed) objectBrowser.setDestinations(provider); },
    setFeatures(provider: SurfaceFeatureNavigationRuntime | null | undefined) { if (!lifetime.disposed) objectBrowser.setFeatures(provider); },
    setPreparedFocus(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[] = [], presentation: PreparedFocusPresentation | null = null) {
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
    setNavigationInFlight(active: boolean) { if (!lifetime.disposed) viewReadout.setNavigationInFlight(active); },
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
  function mountContent(id: string, motionEnabled: boolean) {
    const owner = contentLifetime = createSceneLifetime();
    const retain = <T extends { destroy(): void }>(controller: T): T => { owner.onDispose(() => controller.destroy()); return controller; };
    informationTabs = retain(createInformationTabsController(drawer, owner));
    retain(createDatasetContextController(drawer, documentTarget, windowTarget, owner));
    retain(createChartSwitcherController(drawer, windowTarget, owner));
    retain(createChartPixelAlignmentController(drawer, windowTarget));
    retain(createLensBrowserController(drawer, windowTarget, owner));
    settingsController = retain(createSettingsController(documentTarget, windowTarget,
      { motionEnabled, onMotionChange, heliosphereEnabled, illustrationModelsEnabled, surfaceLabelsEnabled, minimapEnabled, threeDStarsEnabled,
        onHeliosphereChange(enabled) { heliosphereEnabled = enabled; onHeliosphereChange(enabled); },
        onIllustrationModelsChange(enabled) {
          illustrationModelsEnabled = enabled;
          objectBrowser.setIllustrationModelsEnabled(enabled);
          onIllustrationModelsChange(enabled);
        },
        onSurfaceLabelsChange(enabled) { surfaceLabelsEnabled = enabled; onSurfaceLabelsChange(enabled); },
        onMinimapChange(enabled) { minimapEnabled = enabled; onMinimapChange(enabled); },
        onThreeDStarsChange(enabled) { threeDStarsEnabled = enabled; onThreeDStarsChange(enabled); },
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

/** Programmatic selection for camera/dataset navigation. The browser owns
 * pointer selection, keyboard focus and panel visibility. */
export function createTabsController(card: HTMLElement | null, lifetime: SceneLifetime, requestedGroup?: string) {
  const tabs = [...(card?.querySelectorAll<HTMLInputElement>('[data-information-tab]:not([hidden])') ?? [])]
    .filter(tab => requestedGroup === undefined || (tab.dataset.informationGroup ?? 'detail') === requestedGroup);
  let disposed = false;
  const destroy = () => { disposed = true; };
  lifetime.onDispose(destroy);
  return { show(id: string) {
    if (disposed) return;
    const tab = tabs.find(tab => tab.dataset.informationTab === id);
    if (tab) { tab.checked = true; tab.dispatchEvent(new Event('change', { bubbles: true })); }
  }, destroy };
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
    requiredElement<HTMLButtonElement>(option, 'button[name="dataset"]'));
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
  { motionEnabled, onMotionChange, heliosphereEnabled, onHeliosphereChange,
    illustrationModelsEnabled, onIllustrationModelsChange, surfaceLabelsEnabled, onSurfaceLabelsChange,
    minimapEnabled, onMinimapChange, threeDStarsEnabled, onThreeDStarsChange }: Required<Pick<ShellOptions, 'motionEnabled' | 'onMotionChange' | 'heliosphereEnabled' | 'onHeliosphereChange' | 'illustrationModelsEnabled' | 'onIllustrationModelsChange' | 'surfaceLabelsEnabled' | 'onSurfaceLabelsChange' | 'minimapEnabled' | 'onMinimapChange' | 'threeDStarsEnabled' | 'onThreeDStarsChange'>>,
  lifetime: SceneLifetime,
) {
  if (typeof onMotionChange !== "function") {
    throw new TypeError("Planet shell motion change handler must be a function.");
  }
  const motion = documentTarget.querySelector(".planet-motion-setting");
  const heliosphere = documentTarget.querySelector(".planet-heliosphere-setting");
  const illustrationModels = documentTarget.querySelector(".planet-illustration-models-setting");
  const surfaceLabels = documentTarget.querySelector(".planet-surface-labels-setting");
  const minimap = documentTarget.querySelector(".planet-minimap-setting");
  const threeDStars = documentTarget.querySelector(".planet-three-d-stars-setting");
  const speed = documentTarget.querySelector(
    '.planet-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(illustrationModels instanceof windowTarget.HTMLInputElement) ||
      !(surfaceLabels instanceof windowTarget.HTMLInputElement) ||
      !(minimap instanceof windowTarget.HTMLInputElement) ||
      !(threeDStars instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement))) {
    throw new Error("Planet shell settings controls are incomplete.");
  }
  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let motionOn = motionEnabled === true;
  for (const input of [motion, heliosphere, illustrationModels, surfaceLabels, minimap, threeDStars]) input.disabled = false;

  const renderMotion = () => {
    motion.checked = motionOn;
    if (speed) speed.disabled = !motionOn || speed.dataset?.runtimeReady === "false";
  };
  motion.addEventListener("change", () => {
    motionOn = motion.checked;
    renderMotion();
    onMotionChange(motionOn);
  }, { signal: events.signal });
  heliosphere.checked = heliosphereEnabled === true;
  heliosphere.addEventListener("change", () => onHeliosphereChange(heliosphere.checked), { signal: events.signal });
  const renderIllustrationModels = () => {
    illustrationModels.checked = illustrationModelsEnabled === true;
    documentTarget.body.dataset.illustrationModels = illustrationModels.checked ? 'on' : 'off';
  };
  illustrationModels.addEventListener("change", () => {
    illustrationModelsEnabled = illustrationModels.checked;
    renderIllustrationModels();
    onIllustrationModelsChange(illustrationModelsEnabled);
  }, { signal: events.signal });
  renderIllustrationModels();
  const renderSurfaceLabels = () => {
    surfaceLabels.checked = surfaceLabelsEnabled === true;
    documentTarget.body.dataset.surfaceLabels = surfaceLabels.checked ? 'on' : 'off';
  };
  surfaceLabels.addEventListener("change", () => {
    surfaceLabelsEnabled = surfaceLabels.checked;
    renderSurfaceLabels();
    onSurfaceLabelsChange(surfaceLabelsEnabled);
  }, { signal: events.signal });
  renderSurfaceLabels();
  // The stylesheet reads this flag: off hides the minimap and frees its corner.
  const renderMinimap = () => {
    minimap.checked = minimapEnabled === true;
    documentTarget.body.dataset.minimap = minimap.checked ? 'on' : 'off';
  };
  minimap.addEventListener("change", () => {
    minimapEnabled = minimap.checked;
    renderMinimap();
    onMinimapChange(minimapEnabled);
  }, { signal: events.signal });
  renderMinimap();
  threeDStars.checked = threeDStarsEnabled === true;
  threeDStars.addEventListener("change", () => {
    threeDStarsEnabled = threeDStars.checked;
    onThreeDStarsChange(threeDStarsEnabled);
  }, { signal: events.signal });
  renderMotion();

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
      for (const input of [motion, heliosphere, illustrationModels, surfaceLabels, minimap, threeDStars]) input.disabled = true;
      delete documentTarget.body.dataset.surfaceLabels;
    },
  });
}

function createObjectBrowserController(documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime,
  { objectId = '', onCategoryChange = () => {}, illustrationModelsEnabled = false }: Pick<ShellOptions, 'objectId' | 'onCategoryChange' | 'illustrationModelsEnabled'> = { objectId: '' }) {
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
  if (!(search instanceof windowTarget.HTMLInputElement) ||
      !(searchCard instanceof windowTarget.HTMLElement) ||
      !(trigger instanceof windowTarget.HTMLButtonElement) ||
      !(information instanceof windowTarget.HTMLElement) ||
      !(browser instanceof windowTarget.HTMLElement) ||
      !(empty instanceof windowTarget.HTMLElement)) {
    throw new Error("Planet shell object browser is incomplete.");
  }
  // Search/navigation owns the header dropdown. The selected object or overview
  // owns the sidebar card; neither surface moves into the other at runtime.
  const context = documentTarget.querySelector<HTMLElement>('.planet-object-context') ?? browser;
  const sharedLegacyContext = context === browser;
  const galaxy = context.querySelector<HTMLElement>('[data-galactic-overview]');
  const largeScaleCards = [...context.querySelectorAll<HTMLElement>('[data-large-scale-overview]')];
  const focusCard = context.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const system = context.querySelector<HTMLElement>('[data-system-results]');
  const systemHeaders = [...(system?.querySelectorAll<HTMLElement>('[data-system-header]') ?? [])];
  const solarSystemFacts = system?.querySelector<HTMLElement>('[data-solar-system-facts]');
  const navigationRoot = browser.querySelector<HTMLElement>('[data-object-navigation-tree]');
  const navigation = navigationRoot ? createNavigationTreeController(navigationRoot, windowTarget) : null;
  lifetime.onDispose(() => navigation?.destroy());
  const selectNavigation = (current: string) => {
    if (!navigationRoot) return;
    navigationRoot.hidden = false;
    void navigation?.select(current);
  };
  const tabs = [...browser.querySelectorAll<HTMLElement>('[data-object-tab]')];
  const resultsPanel = requiredElement(browser, '#object-category-results');
  let items = [...browser.querySelectorAll<HTMLElement>(".planet-object-item")]
    .filter((item) => item instanceof windowTarget.HTMLLIElement);
  // Production pages ship the catalogue rows empty and reference shared,
  // content-addressed JSON and HTML transports (`catalogue-fragment-pin.mts`).
  // A page or fixture without either pin must still ship its rows inline.
  const cataloguePin = items.length === 0 ? readCatalogueFragmentPin(resultsPanel) : null;
  const catalogueIndexPin = items.length === 0 ? readCatalogueIndexPin(resultsPanel) : null;
  if (items.length === 0 && !catalogueIndexPin && !cataloguePin) {
    throw new Error("Planet shell object browser has no objects.");
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
  let planetEntries: readonly CatalogueIndexEntry[] = [];
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
  let chunks = [...browser.querySelectorAll<HTMLElement>('.planet-object-chunk')]
    .map(node => ({ node, items: [...node.querySelectorAll<HTMLElement>('.planet-object-item')] }));
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
  let planetOrder = [
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
    items = [...browser.querySelectorAll<HTMLElement>(".planet-object-item")]
      .filter((item) => item instanceof windowTarget.HTMLLIElement);
    searchLabels = items.map(item => ({ ...objectSearchLabels(item), item }));
    sourceLinks = sourceDocuments(documentTarget);
    chunks = [...browser.querySelectorAll<HTMLElement>('.planet-object-chunk')]
      .map(node => ({ node, items: [...node.querySelectorAll<HTMLElement>('.planet-object-item')] }));
    bindChunkVisibility();
    distanceOrder = items.toSorted((a, b) => Number(a.dataset.objectDistanceM) - Number(b.dataset.objectDistanceM));
    planetOrder = [
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
          planetEntries = [
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
      backfillCurrentSelection();
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
      const order = classification === 'planet' || classification === 'all' ? planetOrder : distanceOrder;
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
    if (catalogueWindow) {
      const order = classification === 'planet' || classification === 'all' ? planetEntries : distanceEntries;
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
  let selectedObjectName = "";
  let initialObject = true;
  let overview = false;
  let overviewScope: OverviewScope = 'system', overviewSystemId = SOLAR_SYSTEM_ID;
  let preparedFocus: PreparedCatalogObject | null = readInitialFocus(documentTarget);
  // A page's own row was previously marked by the server, from the id it was
  // built for. That id never reaches `setObject` (only a later in-app
  // navigation does), so back-fill it here: once at shell startup if the
  // rows are already present (inline in dev, or already spliced into a
  // server-rendered search page), and again once a fetched catalogue
  // inserts them, whichever finds the shell still showing its own object.
  const backfillCurrentSelection = () => {
    if (!selectedObjectName && !overview && !preparedFocus) {
      const current = SCENE_OBJECTS.find(object => object.id === documentTarget.body.dataset.objectShell);
      if (current) selectedObjectName = current.name;
    }
  };
  const overviewName = () => overviewScope === 'system' ? systemById(SCENE_OBJECTS, overviewSystemId)?.name ?? 'Solar System'
    : ({ 'milky-way': 'Milky Way', 'local-group': 'Local Group', 'nearby-universe': 'Nearby Universe' })[overviewScope];
  let visibleObjects = 0;
  let visibleOverviews = 0;
  let visibleDestinations = 0, visibleFeatures = 0;
  const updateEmpty = () => { setEmptyHidden(visibleObjects + visibleDestinations + visibleFeatures > 0); };
  const destinations = createDestinationBrowser({
    documentTarget,
    onResults(count) { visibleDestinations = count; updateEmpty(); },
    onSelected() { render(false); search.blur(); },
    onReset() { render(false); },
  });
  lifetime.onDispose(() => destinations?.destroy());
  const features = createFeatureBrowser({
    documentTarget, objectId: documentTarget.body.dataset.objectShell ?? '',
    onResults(count) { visibleFeatures = count; updateEmpty(); },
    onSelected() { render(false); search.blur(); },
  });
  lifetime.onDispose(() => features?.destroy());
  let open = searchCard.hasAttribute('data-search-submitted');
  let browsing = open;
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
  let filteredQuery: string | null = null, filteredClassification: string | null | undefined = null;
  const publishSourceContext = () => {
    const sourceFocus = preparedFocus?.id ?? '';
    if (browser.dataset.sourceFocus !== sourceFocus) browser.dataset.sourceFocus = sourceFocus;
    renderSourceLink(documentTarget, preparedFocus ? `focus:${preparedFocus.id}`
      : overview ? `overview:${overviewScope === 'system' ? `system:${overviewSystemId}` : overviewScope}` : `object:${selectedObjectName}`, sourceLinks);
  };
  const renderSelectionContext = () => {
    const focused = Boolean(preparedFocus);
    const focusId = preparedFocus?.id ?? '';
    const galactic = overview && overviewScope === 'milky-way';
    const neighborCard = largeScaleCards.find(card => card.dataset.largeScaleOverview === 'local-group');
    const galaxySelected = focused && neighborCard
      && [...neighborCard.querySelectorAll<HTMLElement>('[data-neighbor-id]')]
        .some(row => row.dataset.neighborId === focusId);
    const largeScale = galaxySelected ? neighborCard : overview
      ? largeScaleCards.find(card => card.dataset.largeScaleOverview === overviewScope) : undefined;
    if (neighborCard && (galaxySelected || galactic || largeScale === neighborCard)) {
      selectGalaxyNeighbor(neighborCard, galaxySelected ? focusId : 'milky-way');
    }
    for (const card of largeScaleCards) setPanelHidden(card, card !== largeScale);
    if (focusCard) setPanelHidden(focusCard, !focused);
    if (galaxy) setPanelHidden(galaxy, !galactic);
    const systemSelected = overview && overviewScope === 'system';
    if (system) setPanelHidden(system, !systemSelected);
    const showContext = focused || galactic || Boolean(largeScale) || systemSelected;
    setPanelHidden(information, showContext);
    if (!sharedLegacyContext) setPanelHidden(context, !showContext);
    const headerSystemId = systemSelected ? overviewSystemId : SOLAR_SYSTEM_ID;
    for (const header of systemHeaders) header.toggleAttribute('data-system-current', header.dataset.systemHeader === headerSystemId);
    if (solarSystemFacts) solarSystemFacts.hidden = headerSystemId !== SOLAR_SYSTEM_ID;
    const selectedObjectId = SCENE_OBJECTS.find(object => object.name === selectedObjectName)?.id ?? objectId;
    const navigationSelection = preparedFocus?.id ?? (galactic ? 'milky-way'
      : largeScale?.dataset.largeScaleOverview ?? (systemSelected ? overviewSystemId : selectedObjectId));
    selectNavigation(navigationSelection);
    context.ariaLabel = preparedFocus?.name ?? (galactic ? 'Milky Way'
      : largeScale?.dataset.largeScaleName ?? (systemSelected ? overviewName() : selectedObjectName || 'Selected object'));
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
      void destinations?.search(''); void features?.search('');
      return;
    }
    const result = searchObjects(searchLabels, query, activeCategory, { illustrations: illustrationModelsEnabled });
    const { classification, systemName, showAll } = result;
    markCategory(classification);
    filteredClassification = classification;
    visibleObjects = 0;
    void destinations?.search(classification || systemName || showAll ? "" : query);
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
      requiredElement(tab, '.planet-object-tab-count').textContent = `(${objectCategoryCount(classifications, tab.dataset.objectTab)})`;
    }
    const nextCategory = searching ? (classification ? result.category : 'all') : initialCategory ?? result.category;
    initialCategory = null;
    selectTab(nextCategory, { resetScroll: false });
    const navigationIds = [
      ...result.matches.flatMap(match => {
        const id = match.item?.dataset.navigationObjectId ?? match.entry?.id;
        return id ? [id] : [];
      }),
      ...[...browser.querySelectorAll<HTMLElement>('[data-search-overview]:not([hidden])')]
        .map(row => row.dataset.navigationObjectId),
    ].filter((id): id is string => Boolean(id));
    void navigation?.filter(navigationIds);
    setEmptyHidden(visibleObjects !== 0 || Boolean((destinations || features) && !classification && !showAll));
  };
  const render = (next: boolean, { resetQuery = false } = {}) => {
    publishSourceContext();
    if (!next) browsing = false;
    // Only an actual open/close transition may reset a scrolled result list.
    if (open !== next) resetResultsScroll();
    open = next;
    trigger.ariaExpanded = String(next);
    search.ariaExpanded = String(next);
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
  documentTarget.querySelector<HTMLElement>('.planet-sidebar-search-clear')?.addEventListener('click', event => {
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
      requiredElement(documentTarget, '.planet-sidebar').scrollTop = 0;
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
  const visibleControl = (element: HTMLElement) => !('disabled' in element && element.disabled) && !element.closest('[hidden], .planet-breadcrumbs')
    && (element.classList.contains('planet-object-link') || element.getClientRects().length > 0);
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
  render(open);

  const markSelection = () => {
    documentTarget.documentElement.dataset.selection = preparedFocus ? 'prepared-focus' : overview ? overviewScope : 'object';
    catalogueWindow?.setSelection(selectedObjectName, preparedFocus?.id ?? '');
    for (const anchor of browser.querySelectorAll<HTMLElement>('.planet-object-link')) {
      const selected = preparedFocus ? anchor.dataset.preparedFocusId === preparedFocus.id
        : !overview && !anchor.dataset.preparedFocusId && anchor.querySelector('.planet-object-name')?.textContent === selectedObjectName;
      anchor.classList.toggle('is-active', selected);
      if (selected) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
  };
  // Rows already present at startup (dev's inline render, or a server-rendered
  // search page that already spliced the shared fragment in) never reach the
  // fetch-path back-fill above, since no fetch happens; mark them once here.
  if (items.length > 0) { backfillCurrentSelection(); markSelection(); }
  return Object.freeze({
    setIllustrationModelsEnabled(enabled: boolean) {
      if (illustrationModelsEnabled === enabled) return;
      illustrationModelsEnabled = enabled;
      filteredQuery = null;
      if (open) filter(false);
    },
    previewOverview(scope: OverviewScope, systemId: string) {
      const previous = { selectedObjectName, overview, overviewScope, overviewSystemId, preparedFocus, browsing };
      preparedFocus = null;
      overview = true; overviewScope = scope; overviewSystemId = systemId; browsing = false;
      markSelection(); render(false);
      return () => {
        const editing = browsing;
        ({ selectedObjectName, overview, overviewScope, overviewSystemId, preparedFocus } = previous);
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
    showSystem(systemId: string) {
      overview = true; overviewScope = 'system'; overviewSystemId = systemId;
      if (systemId === SOLAR_SYSTEM_ID) collapseSolarSystemBranches();
      markSelection(); render(false);
    },
    setOverview(enabled: boolean, scope: OverviewScope, systemId: string) {
      const editing = browsing;
      overview = enabled;
      overviewScope = scope;
      if (enabled) overviewSystemId = systemById(SCENE_OBJECTS, systemId)?.id ?? SOLAR_SYSTEM_ID;
      if (enabled && scope === 'system' && overviewSystemId === SOLAR_SYSTEM_ID) collapseSolarSystemBranches();
      markSelection();
      if (enabled) { destinations?.bind(null); features?.bind(null); }
      render(editing);
    },
    setObject(name: string) {
      // A completed flight publishes the selection, but a newer search owns
      // its query and results until the user chooses or dismisses them.
      const editing = browsing;
      overview = false;
      if (!initialObject) preparedFocus = null;
      initialObject = false;
      selectedObjectName = name;
      const object = SCENE_OBJECTS.find(object => object.name === name);
      if (object) {
        searchCard.setAttribute('action', object.route);
        searchCard.dataset.searchObject = object.id;
        documentTarget.querySelector('.planet-sidebar-search-clear')?.setAttribute('href', object.route);
      }
      markSelection();
      destinations?.bind(null); features?.bind(null);
      render(editing);
    },
    setDestinations(provider: PreparedDestinationRuntime | null | undefined) { destinations?.bind(provider); },
    setFeatures(provider: SurfaceFeatureNavigationRuntime | null | undefined) { features?.bind(provider); },
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
      !(handle instanceof windowTarget.HTMLInputElement) ||
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
  let state: SheetState = handle.checked ? "full" : "peek";
  // Search opens the whole sheet; leaving search returns to the earlier height.
  let searchReturn: SheetState | null = null;
  let gesture: SheetGesture | null = null;
  let dragged = false;
  let snapFrame = 0;
  let readingPosition: { key: string; top: number } | null = null;
  let handleReadingPosition: number | null = null;
  const readingKey = () => `${body.dataset.objectShell}:${documentTarget.documentElement.dataset.selection}:${
    documentTarget.querySelector<HTMLElement>('.planet-object-browser')?.dataset.sourceFocus ?? ''}`;
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
    if (state === 'full' && next !== 'full') readingPosition = { key: readingKey(), top: handleReadingPosition ?? sheet.scrollTop };
    handleReadingPosition = null;
    const restoreScroll = next === 'full' && state !== 'full' && readingPosition?.key === readingKey() ? readingPosition.top : null;
    if (next !== "full") sheet.scrollTop = 0;
    state = next;
    body.dataset.sheet = next;
    handle.checked = next !== "peek";
    sheet.classList.remove("is-dragging");
    if (snapFrame) windowTarget.cancelAnimationFrame(snapFrame);
    snapFrame = windowTarget.requestAnimationFrame(() => {
      snapFrame = 0;
      if (!lifetime.disposed) {
        sheet.style.removeProperty("transform");
        if (restoreScroll !== null) sheet.scrollTop = restoreScroll;
      }
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
  const ownsGesture = (target: EventTarget | null) => target !== handle && target instanceof windowTarget.Element &&
    target.closest("input, select, textarea, [data-surface-minimap]") !== null;

  sheet.addEventListener("pointerdown", (event) => {
    dragged = false;
    if (!mobile.matches || !event.isPrimary || event.button > 0 || ownsGesture(event.target)) return;
    const fromHandle = event.target instanceof windowTarget.Node && handle.contains(event.target);
    // Native focus can scroll the checkbox into view before its change event.
    // Save the reading position before that default action, including a drag.
    if (fromHandle && state === 'full') handleReadingPosition = sheet.scrollTop;
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

  handle.addEventListener("change", () => {
    if (!mobile.matches) return;
    searchReturn = null;
    settle(handle.checked ? "full" : "peek");
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
  const leaveSearch = () => {
    if (searchReturn === null) return;
    const previous = searchReturn;
    searchReturn = null;
    settle(previous);
  };
  const closeSearch = (event: KeyboardEvent) => {
    if (event.key === "Escape") leaveSearch();
  };
  search.addEventListener("focus", openSearch, { signal });
  search.addEventListener("input", openSearch, { signal });
  search.addEventListener("keydown", closeSearch, { signal });
  sheet.addEventListener("keydown", closeSearch, { signal });
  // Clearing the query leaves the results behind, exactly as Escape does.
  documentTarget.querySelector(".planet-sidebar-search-clear")
    ?.addEventListener("click", leaveSearch, { signal });
  // The facility card sits inside the sheet, so opening it has to show it.
  const facilityToggle = documentTarget.querySelector(".planet-facility-toggle");
  facilityToggle?.addEventListener("click", () => {
    if (mobile.matches && state === "peek" && facilityToggle.getAttribute("aria-pressed") === "true") settle("half");
  }, { signal });
  mobile.addEventListener("change", () => {
    gesture = null;
    sheet.classList.remove("is-dragging");
    sheet.style.removeProperty("transform");
  }, { signal });
  // Typing in search opens a keyboard over the sheet it just opened. The layout
  // viewport keeps its height, so the visual viewport reports the lost room.
  const visual = windowTarget.visualViewport ?? null;
  const followKeyboard = () => {
    const inset = visual === null || !mobile.matches ? 0 : mobileSheetKeyboardInset({
      layoutHeight: windowTarget.innerHeight,
      visualHeight: visual.height,
      offsetTop: visual.offsetTop,
    });
    if (inset > 0) body.style.setProperty("--sheet-keyboard", `${inset}px`);
    else body.style.removeProperty("--sheet-keyboard");
  };
  visual?.addEventListener("resize", followKeyboard, { signal });
  visual?.addEventListener("scroll", followKeyboard, { signal });
  lifetime.onDispose(() => body.style.removeProperty("--sheet-keyboard"));

  body.dataset.sheet = state;
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

/** Fill the shell's one preview card with registry facts; no object content is derived. */
function objectCardPreview(documentTarget: Document, object: ObjectEntry) {
  const template = requiredElement<HTMLTemplateElement>(documentTarget, 'template[data-object-card-preview]');
  const card = template.content.firstElementChild;
  if (!card) throw new Error('Object card preview is empty.');
  const preview = documentTarget.importNode(card, true);
  const name = requiredElement(preview, '[data-card-preview-name]');
  name.textContent = object.name;
  name.setAttribute('aria-label', object.name);
  requiredElement(preview, '[data-card-preview-classification]').textContent = objectClassificationLabel(object.classification);
  requiredElement(preview, '[data-card-preview-description]').textContent = object.description;
  return preview;
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
