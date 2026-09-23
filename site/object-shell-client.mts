import { createObjectBrowserController } from './object-browser.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';
import { SCENE_OBJECTS } from './objects.mts';
import type { OverviewScope } from './overview-context.mts';
import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedCatalogObject, SpatialCitation } from '@cssearth/catalog';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import { readInitialFocus } from './focus-catalog.mts';
import { shellSubjectKey, type ShellSelection } from './shell-selection.mts';
import type { PreparedFocusPresentation } from './prepared-context-navigation.mts';
import type { PreparedWorldCameraFrame, WorldCameraPose } from '../src/renderers/css/navigation/world-camera.js';
import type { PreparedDestinationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { ShellCamera, PlaybackState } from './browser-types.mts';
import { errorMessage, requiredElement } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import type { NavigationContent } from './navigation-content.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { createSceneLifetime } from "@cssearth/engine";
import { createExplorerRailController } from "./explorer-rail.mts";
import { createSurfaceMinimap, loadSurfacePreview } from "./surface-minimap.mts";
import { createViewReadout } from "./view-readout.mts";
import { createSurfaceMapReader } from "./surface-map-context.mts";
import { mountDiagnosticRecorder } from './diagnostic-recorder.mts';
import { bodyCardViewAtCamera, overviewScopeAtCamera } from './overview-context.mts';
import { bindNavigationIntent, navigationFragments } from './navigation-fragments.mts';
import { createSheetController } from './shell-sheet.mts';
import { createSettingsController } from './shell-settings.mts';
import { mountInformationCard, createInformationTabsController, createTabsController, restoreInformationPanels, objectCardPreview } from './information-card.mts';
import type { ObjectShell, ShellOptions, ShellNavigationTarget, ShellNavigationTransition } from './object-shell-types.mts';

interface SelectionPreview {
  id: string | null;
  frame?: PreparedWorldCameraFrame | null;
  commit(): void;
  restore(): void;
}

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
}: ShellOptions): ObjectShell {
  const drawer = requiredElement(documentTarget, ".object-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  const fragments = navigationFragments(windowTarget);
  let informationCard: ReturnType<typeof mountInformationCard>;
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
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime, { readSelection: () => selection, onCategoryChange, illustrationModelsEnabled }));
    // Hover, focus or press on another body fetches its card before the click.
    own(bindNavigationIntent({ documentTarget, windowTarget, objects: SCENE_OBJECTS, fragments, skip: id => id === selection.objectId }));
    sheet = own(createSheetController(documentTarget, windowTarget, lifetime,
      () => `${selection.objectId}:${shellSubjectKey(objectBrowser.readSubject())}`));
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
    showDataset() { informationCard.show('dataset'); },
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
      restoreInformationPanels(information, object.id, windowTarget);
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
    informationCard = mountInformationCard(drawer, id, documentTarget, windowTarget, owner);
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
    informationCard.activatePanels();
  }
}
