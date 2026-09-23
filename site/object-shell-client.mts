import { createObjectBrowserController } from './object-browser.mts';
import { SOLAR_SYSTEM_ID } from './object-systems.mts';
import { SCENE_OBJECTS } from './objects.mts';
import type { SceneLifetime } from '@cssearth/engine';
import { createPreparedFocusCard } from './prepared-focus-card.mts';
import { selectionKey } from './scene-selection.mts';
import type { PreparedDestinationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import type { ShellCamera, PlaybackState } from './browser-types.mts';
import { errorMessage, requiredElement } from './browser-types.mts';
import type { NavigationContent } from './navigation-content.mts';
import { DIAGNOSTICS_ENABLED } from './diagnostics-policy.mts';
import type { SurfaceFeatureNavigationRuntime } from '../src/renderers/css/runtime/object-runtime-types.js';
import { createSceneLifetime } from "@cssearth/engine";
import { createExplorerRailController } from "./explorer-rail.mts";
import { createSurfaceMinimap, loadSurfacePreview } from "./surface-minimap.mts";
import { createViewReadout } from "./view-readout.mts";
import { createSurfaceMapReader } from "./surface-map-context.mts";
import { mountDiagnosticRecorder } from './diagnostic-recorder.mts';
import { bodyCardViewAtCamera } from './overview-context.mts';
import { bindNavigationIntent, navigationFragments } from './navigation-fragments.mts';
import { createSheetController } from './shell-sheet.mts';
import { createSettingsController } from './shell-settings.mts';
import { mountInformationCard, createInformationTabsController, createTabsController, restoreInformationPanels, objectCardPreview } from './information-card.mts';
import type { ObjectShell, ShellOptions, ShellNavigationTarget, ShellNavigationTransition } from './object-shell-types.mts';

export function mountObjectShell({
  objectId,
  readSelection,
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
  let navigationTransition: (ShellNavigationTransition & { cardView: 'detail' | 'overview' | null }) | null = null;
  let camera: ShellCamera | null = null;
  let unsubscribeCamera: (() => void) | null = null;
  const focusRoot = drawer.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const focusTabs = createTabsController(focusRoot, lifetime, 'prepared-focus');
  const focusCard = createPreparedFocusCard(focusRoot, id => focusTabs.show(id));
  lifetime.onDispose(() => focusCard.destroy());
  lifetime.onDispose(() => unsubscribeCamera?.());
  // The card panel is retained; a camera frame re-queries it only after a card swap.
  let information: HTMLElement | null = null;
  function updateBodyCard(world = camera?.navigation?.capture()) {
    if (!information?.isConnected || !drawer.contains(information)) information = drawer.querySelector<HTMLElement>('.object-information-panel');
    const previous = information?.dataset.cardView;
    const view = navigationTransition?.cardView ?? bodyCardViewAtCamera(world, camera?.navigation?.frame,
      camera?.navigation?.optics?.(), objectId,
      previous === 'detail' || previous === 'overview' ? previous : undefined);
    if (information && information.dataset.cardView !== view) information.dataset.cardView = view;
  }
  function presentSelection() {
    if (lifetime.disposed) return;
    const subject = readSelection(), focus = subject.kind === 'focus' ? subject : null;
    focusCard.set(focus?.record ?? null, focus?.sources ?? [], focus?.presentation ?? null);
    objectBrowser.refreshSelection();
    viewReadout.setPreparedFocus(focus?.record ?? null);
    viewReadout.setOverviewScope(subject.kind === 'overview' ? subject.overview.scope : 'system');
    updateBodyCard();
  }
  function own<T extends { destroy(): void }>(controller: T) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    if (DIAGNOSTICS_ENABLED) own(mountDiagnosticRecorder({ documentTarget, windowTarget, readCamera: () => camera }));
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime, { readSelection, readObjectId: () => objectId, onCategoryChange, illustrationModelsEnabled }));
    // Hover, focus or press on another body fetches its card before the click.
    own(bindNavigationIntent({ documentTarget, windowTarget, objects: SCENE_OBJECTS, fragments, skip: id => id === objectId }));
    sheet = own(createSheetController(documentTarget, windowTarget, lifetime,
      () => `${objectId}:${selectionKey(objectBrowser.readSubject())}`));
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
    presentSelection,
    setCamera(provider: ShellCamera | null) {
      if (!lifetime.disposed) {
        unsubscribeCamera?.(); camera = provider;
        minimapController.setCamera(provider); viewReadout.setCamera(provider);
        unsubscribeCamera = provider?.navigation?.subscribe(world => updateBodyCard(world)) ?? null;
        updateBodyCard();
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
    const previewLifetime = createSceneLifetime();
    let arrived = false;
    let restoreBrowser = () => {};
    let settleCard = (_keep: boolean) => {};
    const settlePreview = (keep: boolean) => {
      previewLifetime.destroy();
      settleCard(keep);
      if (!keep) restoreBrowser();
    };
    const transition: NonNullable<typeof navigationTransition> = {
      // Classify the endpoint once; intermediate flight poses must not toggle
      // the destination's retained overview/detail card.
      cardView: target.kind === 'object' ? (target.targetWorldCamera
        ? bodyCardViewAtCamera(target.targetWorldCamera, target.object.worldFrame, camera?.navigation?.optics?.(), target.object.id)
        : 'detail') : null,
      arrive({ subject, content }) {
        if (navigationTransition !== transition || arrived) return;
        const preserveSidebar = content !== undefined && target.kind === 'object' && target.object.id === content.id;
        const keep = content ? preserveSidebar : (subject.kind === 'overview') === (target.kind === 'overview');
        // Invalidate pending fragment callbacks before committing or restoring DOM.
        arrived = true;
        settlePreview(keep);
        if (content) setObject(content, { preserveSidebar });
        presentSelection();
      },
      dispose() {
        if (navigationTransition !== transition) return;
        navigationTransition = null;
        try { if (!arrived) settlePreview(false); }
        finally { updateBodyCard(); }
      },
    };
    navigationTransition = transition;
    try {
      if (target.kind === 'overview') {
        if (target.preview) restoreBrowser = objectBrowser.previewSelection({ kind: 'overview', overview: target.overview });
      } else {
        const object = target.object;
        sheet.showSelection();
        restoreBrowser = objectBrowser.previewSelection({ kind: 'object', objectId: object.id });
        if (object.id !== objectId) {
          const panel = requiredElement(drawer, '.object-information-panel');
          const previous = [...panel.childNodes], previousBusy = panel.ariaBusy;
          let pendingControls: (readonly [HTMLElement, boolean])[] = [];
          settleCard = keep => {
            if (keep) { for (const [node, inert] of pendingControls) node.inert = inert; }
            else panel.replaceChildren(...previous);
            panel.ariaBusy = previousBusy;
          };
          const showCard = (card: Element) => {
            panel.replaceChildren(...[...card.childNodes].map(node => documentTarget.importNode(node, true)));
            restoreInformationPanels(panel, object.id, windowTarget);
            for (const map of panel.querySelectorAll<HTMLElement>('.object-surface-minimap')) {
              if (!map.closest('[hidden], details:not([open])')) loadSurfacePreview(map);
            }
            // Detail controls wait for their renderer; navigation stays usable
            // so another destination can supersede this request.
            pendingControls = [...panel.querySelectorAll<HTMLElement>('.object-card-tabs, [data-information-panel]')]
              .filter(node => node.dataset.informationGroup !== 'overview')
              .map(node => [node, node.inert] as const);
            for (const [node] of pendingControls) node.inert = true;
            createInformationTabsController(drawer, previewLifetime, 'overview');
          };
          const cached = fragments.peek(object.id);
          const card = cached?.document.querySelector('.object-information-panel');
          if (cached && card) {
            try { showCard(card); } finally { cached.release(); }
          } else {
            cached?.release();
            panel.replaceChildren(objectCardPreview(documentTarget, object));
            fragments.get(object.id).then(fragment => {
              try {
                const card = fragment.document.querySelector('.object-information-panel');
                if (card && navigationTransition === transition && !arrived) { showCard(card); updateBodyCard(); }
              } finally { fragment.release(); }
            }, () => {});
          }
          panel.ariaBusy = 'true';
        }
        updateBodyCard();
      }
      return transition;
    } catch (error) {
      transition.dispose();
      throw error;
    }
  }

  function setObject(content: NavigationContent, { preserveSidebar = false } = {}) {
    if (lifetime.disposed) return;
    const motion = requiredElement<HTMLInputElement>(documentTarget, '.object-motion-setting').checked;
    disposeContent();
    content.apply({ preserveSidebar });
    objectId = content.id;
    focusCard.set(null);
    objectBrowser.bindObject(content.id);
    mountContent(content.id, motion);
  }

  function disposeContent() {
    const errors = contentLifetime?.destroy() ?? [];
    contentLifetime = null;
    if (errors.length) throw new AggregateError(errors, 'Object shell content cleanup failed.');
  }
  function mountContent(id: string, motionEnabled: boolean) {
    const owner = contentLifetime = createSceneLifetime();
    const retain = <T extends { destroy(): void }>(controller: T): T => { owner.onDispose(() => controller.destroy()); return controller; };
    informationCard = mountInformationCard(drawer, id, windowTarget, owner);
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
    const subject = readSelection();
    viewReadout.setPreparedFocus(subject.kind === 'focus' ? subject.record : null);
    informationCard.activatePanels();
  }
}
