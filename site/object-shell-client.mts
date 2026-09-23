import { createObjectBrowserController } from './object-browser.mts';
import { objectClassificationLabel } from './search-objects.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';
import { SCENE_OBJECTS } from './objects.mts';
import type { OverviewScope } from './overview-context.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import { readInitialFocus } from './focus-catalog.mts';
import { selectedShellSubject, type ShellOverview, type ShellSelection } from './shell-selection.mts';
import type { PreparedFocusPresentation } from './prepared-context-navigation.mts';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedDestinationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { BrowserWindow, ShellCamera, PlaybackState } from './browser-types.mts';
import { errorMessage, requiredElement } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { createNavigationContent } from './navigation-content.mts';
import { createDatasetContextController } from './dataset-context-controller.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import { createChartPixelAlignmentController } from "./chart-pixel-alignment.mts";
import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { createSceneLifetime } from "@cssearth/engine";
import { createExplorerRailController } from "./explorer-rail.mts";
import { createSurfaceMinimap, loadSurfacePreview } from "./surface-minimap.mts";
import { createViewReadout } from "./view-readout.mts";
import { createSurfaceMapReader } from "./surface-map-context.mts";
import { mountDiagnosticRecorder } from './diagnostic-recorder.mts';
import { bodyCardViewAtCamera, overviewScopeAtCamera } from './overview-context.mts';
import { bindNavigationIntent, navigationFragments } from './navigation-fragments.mts';
import { MOBILE_SHEET_POLICY, MOBILE_VIEWPORT_QUERY, mobileSheetKeyboardInset } from './runtime-policy.mts';

export type NavigationContent = Awaited<ReturnType<ReturnType<typeof createNavigationContent>['load']>>;

export interface ShellOptions {
  objectId: string;
  documentTarget?: Document;
  windowTarget?: BrowserWindow;
  motionEnabled?: boolean;
  onMotionChange?(enabled: boolean): void;
  heliosphereEnabled?: boolean;
  onHeliosphereChange?(enabled: boolean): void;
  illustrationModelsEnabled?: boolean;
  onIllustrationModelsChange?(enabled: boolean): void;
  surfaceLabelsEnabled?: boolean;
  onSurfaceLabelsChange?(enabled: boolean): void;
  minimapEnabled?: boolean;
  onMinimapChange?(enabled: boolean): void;
  threeDStarsEnabled?: boolean;
  onThreeDStarsChange?(enabled: boolean): void;
  onCategoryChange?(classification: string | null): void;
}

interface SelectionPreview {
  id: string | null;
  frame?: PreparedWorldCameraFrame | null;
  commit(): void;
  restore(): void;
}

export type ShellNavigationTarget =
  | { kind: 'object'; object: ObjectEntry; targetWorldCamera?: WorldCameraPose }
  | { kind: 'overview'; overview: ShellOverview; preview: boolean };

export interface ShellNavigationTransition {
  /** Publish the arriving selection while its camera can still be in flight. */
  arrive(selection: { overview: boolean; content?: NavigationContent }): void;
  /** Roll back an unarrived preview and release the card's flight lock. */
  dispose(): void;
}

type Panel = readonly [string, HTMLDetailsElement];

export function mountObjectShell({
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
  const drawer = requiredElement(documentTarget, ".object-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  const fragments = navigationFragments(windowTarget);
  let informationTabs: ReturnType<typeof createInformationTabsController>;
  let sheet: ReturnType<typeof createSheetController>;
  let settingsController: ReturnType<typeof createSettingsController>;
  let objectBrowser: ReturnType<typeof createObjectBrowserController>;
  let contentLifetime: SceneLifetime | null = null;
  let minimapController: ReturnType<typeof createSurfaceMinimap>;
  let viewReadout: ReturnType<typeof createViewReadout>;
  let selectionPreview: SelectionPreview | null = null;
  let navigationTransition: ShellNavigationTransition | null = null;
  let cardNavigation: { view: 'detail' | 'overview' } | null = null;
  let selection: ShellSelection = { objectId, overview: null, focus: readInitialFocus(documentTarget) };
  let camera: ShellCamera | null = null;
  let unsubscribeOverview: (() => void) | null = null;
  const focusRoot = drawer.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const focusTabs = createTabsController(focusRoot, lifetime, 'prepared-focus');
  const focusCard = createPreparedFocusCard(focusRoot, id => focusTabs.show(id));
  lifetime.onDispose(() => focusCard.destroy());
  lifetime.onDispose(() => unsubscribeOverview?.());
  // The card panel is retained; a camera frame re-queries it only after a card swap.
  let information: HTMLElement | null = null;
  function updateBodyCard(world = camera?.navigation?.capture()) {
    if (!information?.isConnected || !drawer.contains(information)) information = drawer.querySelector<HTMLElement>('.object-information-panel');
    const previous = information?.dataset.cardView;
    const view = cardNavigation?.view ?? bodyCardViewAtCamera(world, selectionPreview?.frame ?? camera?.navigation?.frame,
      camera?.navigation?.optics?.(), selectionPreview?.id ?? selection.objectId,
      previous === 'detail' || previous === 'overview' ? previous : undefined);
    if (information && information.dataset.cardView !== view) information.dataset.cardView = view;
  }
  function updateOverview(force = false, world = camera?.navigation?.capture()) {
    updateBodyCard(world);
    if (selectionPreview) return;
    const previousScope = selection.overview?.scope ?? 'system';
    const scope = selection.overview && world ? overviewScopeAtCamera(world, previousScope) : 'system';
    if (!force && scope === previousScope) return;
    if (selection.overview) selection = { ...selection, overview: { ...selection.overview, scope } };
    objectBrowser.refreshSelection({ clearObjectProviders: selection.overview !== null });
    viewReadout.setOverviewScope(scope);
  }
  function own<T extends { destroy(): void }>(controller: T) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    if (DIAGNOSTICS_ENABLED) own(mountDiagnosticRecorder({ documentTarget, windowTarget, readCamera: () => camera }));
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime, { readSelection: () => selectedShellSubject(selection), onCategoryChange, illustrationModelsEnabled }));
    // Hover, focus or press on another body fetches its card before the click.
    own(bindNavigationIntent({ documentTarget, windowTarget, objects: SCENE_OBJECTS, fragments, skip: id => id === selection.objectId }));
    sheet = own(createSheetController(documentTarget, windowTarget, lifetime));
    own(createExplorerRailController(documentTarget, windowTarget, {
      onOpenSolarSystem: () => objectBrowser.showSystem(SOLAR_SYSTEM_ID),
    }));
    lifetime.onDispose(() => disposeContent());
    lifetime.onDispose(() => navigationTransition?.dispose());
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
    beginNavigation,
    setObject,
    setDestinations(provider: PreparedDestinationRuntime | null | undefined) { if (!lifetime.disposed) objectBrowser.setDestinations(provider); },
    selectPlace(id: string) { return lifetime.disposed ? Promise.resolve() : objectBrowser.selectPlace(id); },
    setFeatures(provider: SurfaceFeatureNavigationRuntime | null | undefined) { if (!lifetime.disposed) objectBrowser.setFeatures(provider); },
    setPreparedFocus(record: PreparedCatalogObject | null, sources: readonly SpatialCitation[] = [], presentation: PreparedFocusPresentation | null = null) {
      if (lifetime.disposed) return;
      selection = { ...selection, focus: record };
      focusCard.set(record, sources, presentation);
      objectBrowser.refreshFocus();
      viewReadout.setPreparedFocus(record);
    },
    setOverview,
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

  function beginNavigation(target: ShellNavigationTarget): ShellNavigationTransition | null {
    if (lifetime.disposed) return null;
    navigationTransition?.dispose();
    let preview: SelectionPreview | null = null;
    let releaseCard: (() => void) | undefined;
    try {
      if (target.kind === 'object') {
        releaseCard = beginCardNavigation(target.object, target.targetWorldCamera);
        preview = beginObjectSelection(target.object);
      } else if (target.preview) {
        preview = beginOverviewSelection(target.overview.scope, target.overview.systemId);
      }
    } catch (error) {
      releaseCard?.();
      throw error;
    }
    let arrived = false;
    const transition: ShellNavigationTransition = {
      arrive({ overview, content }) {
        if (navigationTransition !== transition || arrived) return;
        const preserveSidebar = content !== undefined && preview?.id === content.id;
        // A content handoff can retain its previewed card. An in-place arrival
        // commits the requested subject without replacing the mounted body.
        const acceptsPreview = content ? preserveSidebar : overview === (target.kind === 'overview');
        if (acceptsPreview) preview?.commit();
        else preview?.restore();
        if (content) setObject(content, { preserveSidebar });
        setOverview(overview);
        arrived = true;
      },
      dispose() {
        if (navigationTransition !== transition) return;
        navigationTransition = null;
        try { if (!arrived) preview?.restore(); }
        finally { releaseCard?.(); }
      },
    };
    navigationTransition = transition;
    return transition;
  }

  function beginCardNavigation(object: ObjectEntry, targetWorldCamera?: WorldCameraPose) {
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
  }
  function beginOverviewSelection(scope: OverviewScope, systemId: string) {
    const restoreBrowser = objectBrowser.previewOverview(scope, systemId);
    const preview = { id: null, commit() { selectionPreview = null; }, restore() {
      if (selectionPreview !== preview) return;
      selectionPreview = null;
      restoreBrowser();
    } };
    selectionPreview = preview;
    return preview;
  }
  function beginObjectSelection(object: ObjectEntry) {
    sheet.showSelection();
    if (object.id === selection.objectId) {
      const restoreBrowser = objectBrowser.previewObject(object.id);
      const preview = { id: object.id, commit() { selectionPreview = null; }, restore() {
        if (selectionPreview !== preview) return;
        selectionPreview = null; restoreBrowser();
      } };
      selectionPreview = preview;
      updateBodyCard();
      return preview;
    }
    const information = requiredElement(drawer, '.object-information-panel');
    const previous = [...information.childNodes], restoreBrowser = objectBrowser.previewObject(object.id);
    const previousBusy = information.ariaBusy;
    const previewLifetime = createSceneLifetime();
    let pendingControls: (readonly [HTMLElement, boolean])[] = [];
    const showCard = (card: Element) => {
      information.replaceChildren(...[...card.childNodes].map(node => documentTarget.importNode(node, true)));
      restorePanelState([...information.querySelectorAll<HTMLElement>(':scope > details, :scope > [data-information-panel] > details')].filter(node => node instanceof windowTarget.HTMLDetailsElement)
        .map(node => [panelKey(node), node] as const), object.id, windowTarget);
      for (const map of information.querySelectorAll<HTMLElement>('.object-surface-minimap')) {
        if (!map.closest('[hidden], details:not([open])')) loadSurfacePreview(map);
      }
      // Detail controls wait for their renderer; navigation anchors stay usable
      // so another breadcrumb or moon can replace an in-progress selection.
      pendingControls = [...information.querySelectorAll<HTMLElement>('.object-card-tabs, [data-information-panel]')]
        .filter(node => node.dataset.informationGroup !== 'overview')
        .map(node => [node, node.inert] as const);
      for (const [node] of pendingControls) node.inert = true;
      createInformationTabsController(drawer, previewLifetime, 'overview');
    };
    // The destination's static fragment is its card; intent usually fetched it.
    const cached = fragments.peek(object.id);
    const card = cached?.document.querySelector('.object-information-panel');
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
          const arrived = fragment.document.querySelector('.object-information-panel');
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
    return preview;
  }

  function setObject(content: NavigationContent, { preserveSidebar = false } = {}) {
    if (lifetime.disposed) return;
    const motion = requiredElement<HTMLInputElement>(documentTarget, '.object-motion-setting').checked;
    disposeContent();
    content.apply({ preserveSidebar });
    selection = { objectId: content.id, overview: null, focus: null };
    focusCard.set(null);
    objectBrowser.bindObject(content.id);
    mountContent(content.id, motion);
  }

  function setOverview(enabled: boolean) {
    if (!lifetime.disposed) {
      selection = { ...selection, overview: enabled ? {
        scope: selection.overview?.scope ?? 'system',
        systemId: systemById(SCENE_OBJECTS, selection.objectId)?.id ?? SOLAR_SYSTEM_ID,
      } : null };
      updateOverview(true);
    }
  }

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
    viewReadout.setPreparedFocus(selection.focus);
    retain(createPanelController(drawer, id, windowTarget, owner));
  }
}

function createInformationTabsController(drawer: HTMLElement, lifetime: SceneLifetime, requestedGroup?: string) {
  return createTabsController(drawer.querySelector<HTMLElement>('.object-information-panel'), lifetime, requestedGroup);
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
  const information = drawer.querySelector<HTMLElement>(".object-information-panel");
  const root = information?.querySelector<HTMLElement>(".object-lenses");
  if (!root || !information) {
    return Object.freeze({ destroy() {} });
  }

  const options = [...root.querySelectorAll("[data-lens-option]")]
    .filter((option) => option instanceof windowTarget.HTMLElement);
  const buttons = options.map((option) =>
    requiredElement<HTMLButtonElement>(option, 'button[name="dataset"]'));
  if (options.length === 0 || buttons.some((button) =>
    !(button instanceof windowTarget.HTMLButtonElement))) {
    throw new Error("Object shell surface lens browser has no valid lenses.");
  }

  const details = [...information.querySelectorAll<HTMLElement>("[data-lens-details]")];
  const lensIds = new Set(buttons.map((button) => button.value));
  if (details.some((detail) => !lensIds.has(detail.dataset.lensDetails ?? ""))) {
    throw new Error("Object shell surface lens details have no matching lens.");
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
    throw new TypeError("Object shell motion change handler must be a function.");
  }
  const motion = documentTarget.querySelector(".object-motion-setting");
  const heliosphere = documentTarget.querySelector(".object-heliosphere-setting");
  const illustrationModels = documentTarget.querySelector(".object-illustration-models-setting");
  const surfaceLabels = documentTarget.querySelector(".object-surface-labels-setting");
  const minimap = documentTarget.querySelector(".object-minimap-setting");
  const threeDStars = documentTarget.querySelector(".object-three-d-stars-setting");
  const speed = documentTarget.querySelector(
    '.object-speed-setting[type="range"][name="speed"]',
  );
  if (!(motion instanceof windowTarget.HTMLInputElement) ||
      !(heliosphere instanceof windowTarget.HTMLInputElement) ||
      !(illustrationModels instanceof windowTarget.HTMLInputElement) ||
      !(surfaceLabels instanceof windowTarget.HTMLInputElement) ||
      !(minimap instanceof windowTarget.HTMLInputElement) ||
      !(threeDStars instanceof windowTarget.HTMLInputElement) ||
      (speed !== null && !(speed instanceof windowTarget.HTMLInputElement))) {
    throw new Error("Object shell settings controls are incomplete.");
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
    documentTarget.body.dispatchEvent(new Event('objectsurfacelabelschange'));
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
      const row = motion.closest<HTMLElement>(".object-motion-setting-control")!;
      const explanation = requiredElement(row, ".object-motion-blocked");
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

function createChartSwitcherController(drawer: HTMLElement, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const switcher = drawer.querySelector<HTMLElement>(".object-chart-switcher");
  if (switcher === null) {
    return Object.freeze({ destroy() {} });
  }
  if (!(switcher instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell chart switcher is invalid.");
  }
  const previous = switcher.querySelector('.object-chart-step[data-chart-step="-1"]');
  const next = switcher.querySelector('.object-chart-step[data-chart-step="1"]');
  const slides = [...switcher.querySelectorAll(".object-chart-slide")]
    .filter((slide) => slide instanceof windowTarget.HTMLElement);
  const labels = [...switcher.querySelectorAll(".object-chart-label")]
    .filter((label) => label instanceof windowTarget.HTMLElement);
  if (!(previous instanceof windowTarget.HTMLButtonElement) ||
      !(next instanceof windowTarget.HTMLButtonElement) ||
      slides.length === 0 || labels.length !== slides.length) {
    throw new Error("Object shell chart switcher is incomplete.");
  }
  const chartIds = slides.map((slide) => slide.dataset.chartId ?? "");
  if (chartIds.some((id) => id.length === 0) ||
      new Set(chartIds).size !== chartIds.length ||
      labels.some((label) => !chartIds.includes(label.dataset.chartLabel ?? ""))) {
    throw new Error("Object shell chart switcher identities are incomplete.");
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
  const sheet = documentTarget.querySelector(".object-sidebar");
  const handle = documentTarget.querySelector(".object-sheet-handle");
  const search = documentTarget.querySelector(".object-sidebar-search");
  if (!(sheet instanceof windowTarget.HTMLElement) ||
      !(handle instanceof windowTarget.HTMLInputElement) ||
      !(search instanceof windowTarget.HTMLInputElement)) {
    throw new Error("Object shell sheet is incomplete.");
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
    documentTarget.querySelector<HTMLElement>('.object-browser')?.dataset.sourceFocus ?? ''}`;
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
      throw new Error("Object shell sheet heights are missing.");
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
  documentTarget.querySelector(".object-sidebar-search-clear")
    ?.addEventListener("click", leaveSearch, { signal });
  // The facility card sits inside the sheet, so opening it has to show it.
  const facilityToggle = documentTarget.querySelector(".object-facility-toggle");
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
  const informationPanel = drawer.querySelector<HTMLElement>(".object-information-panel");
  if (!(informationPanel instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell combined information panel is missing.");
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
  if (!panel.id) throw new Error("Object shell panel identity is missing.");
  return panel.id;
}
