import { cardView, presentCardView } from '../selection-presentation.mts';
import { createSystemBodiesPresentation } from '../system-bodies-fragment.mts';
import { renderSourceLink } from '../source-link.mts';
import { ladderOf } from '../level-view.mts';
import { isExtendedClassification } from '@cssearth/objects';
import { bindTabPanels } from '../tab-panels.mts';
import { sectionElements, sectionPlaceholder, showSection } from '@cssearth/renderer';
import { createObjectBrowserController } from '../object-browser.mts';
import { applySeoHead, objectSeo } from '../seo.mts';
import { knownLevel, knownObject } from '../object-directory.mts';
import { navigationHref } from '../navigation/navigation-history.mts';
import type { SceneLifetime } from '@cssearth/engine';
import { selectionKey, type SceneView } from '../scene/scene-selection.mts';
import type { DestinationPresentation } from '../destination-browser.mts';
import type { ShellCamera, PlaybackState } from '../browser/browser-types.mts';
import { errorMessage, requiredElement, sectionElement } from '../browser/browser-types.mts';
import type { NavigationContent } from '../navigation/navigation-content.mts';
import { DIAGNOSTICS_ENABLED } from '../diagnostics-policy.mts';
import { createSceneLifetime } from "@cssearth/engine";
import { createViewReadout } from "../view-readout.mts";
import { createSurfaceMapReader } from "../minimap/surface-map-context.mts";
import { mountDiagnosticRecorder } from '../diagnostic-recorder.mts';
import { bindNavigationIntent, navigationFragments } from '../navigation/navigation-fragments.mts';
import { createSheetController } from './shell-sheet.mts';
import { bindDatasetPicker } from '../dataset-picker.mts';
import { mountLayoutSections } from '../layout-sections.mts';
import { createSettingsController } from './shell-settings.mts';
import { mountInformationCard, createTabsController } from '../information-card.mts';
import type { ObjectShell, ShellOptions, ShellNavigationTarget, ShellNavigationTransition } from './object-shell-types.mts';

export function mountObjectShell({
  objectId,
  readSelection,
  documentTarget = document,
  windowTarget = window,
  preferences, onResetDestination, onFrameCategory, navigable, prefetch,
}: ShellOptions): ObjectShell {
  const drawer = requiredElement(documentTarget, ".object-drawer-content");
  if (!(drawer instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell information drawer is missing.");
  }
  const lifetime = createSceneLifetime();
  const navigationProgress = documentTarget.querySelector<HTMLElement>('.explorer-navigation-progress');
  lifetime.onDispose(() => { if (navigationProgress) navigationProgress.ariaHidden = 'true'; });
  bindDatasetPicker(documentTarget, windowTarget, lifetime);
  const layoutSections = new AbortController();
  lifetime.onDispose(() => layoutSections.abort());
  mountLayoutSections(documentTarget, windowTarget, layoutSections.signal);
  // Closed tabs' panels are not mounted (tab-panels.mts).
  const tabPanels = new AbortController();
  lifetime.onDispose(() => tabPanels.abort());
  const tabs = bindTabPanels(documentTarget, tabPanels.signal);
  const fragments = navigationFragments(windowTarget);
  let informationCard: ReturnType<typeof mountInformationCard>;
  let sheet: ReturnType<typeof createSheetController>;
  let settingsController: ReturnType<typeof createSettingsController>;
  let objectBrowser: ReturnType<typeof createObjectBrowserController>;
  let contentLifetime: SceneLifetime | null = null;
  let viewReadout: ReturnType<typeof createViewReadout>;
  let boundCardMaps: HTMLElement[] = [];
  let surfaceReader: ReturnType<typeof createSurfaceMapReader>;
  let releaseArrivalControls = () => {};
  let navigationTransition: (ShellNavigationTransition & { cardView: SceneView | null; retainsSourceCard: boolean }) | null = null;
  let camera: ShellCamera | null = null;
  // The selected card panel stays retained across subject changes.
  let information: HTMLElement | null = null;
  // Switching between a body and its system changes layout, so it waits while the camera coasts and
  // follows once the coast stops (docs/performance/motion-freezes-membership.md).
  let coasting = false;
  // Zooming across overviews changes the page while the camera may coast; its head and forms follow once it stops.
  let pendingPage: Parameters<typeof presentPage> | null = null;
  const motionChanged = (event: Event) => {
    const next = event instanceof CustomEvent && (event.detail as { coasting?: unknown } | null)?.coasting === true;
    if (next === coasting) return;
    coasting = next;
    if (coasting) return;
    if (pendingPage) presentPage(...pendingPage);
    updateBodyCard();
  };
  drawer.ownerDocument.addEventListener('objectmotionchange', motionChanged, { capture: true });
  lifetime.onDispose(() => drawer.ownerDocument.removeEventListener('objectmotionchange', motionChanged, { capture: true }));
  let systemBodies: { card: HTMLElement; presentation: ReturnType<typeof createSystemBodiesPresentation> } | null = null;
  function updateBodyCard() {
    if (coasting || navigationTransition?.retainsSourceCard) return;
    if (!information || !drawer.contains(sectionPlaceholder(information))) information = sectionElement(drawer, '.object-information-panel');
    const selected = readSelection();
    // The card shows the selected view of its object: the body, its moons, or (a star's) its planetary system.
    const view = information ? navigationTransition?.cardView ?? cardView(information, selected.view) : 'body';
    if (information) presentCardView(information, view);
    // The card names its subjects' source documents. The selection is presented before the card's new content arrives, so
    // the footer link is read from the card whenever the card is: a system opened from a planet's breadcrumb kept the
    // planet's README (2026-10-02). The link is written only when it differs.
    const subject = selectionKey(selected), named = information && sectionElements(information, '[data-source-subject]').find(node => node.dataset.sourceSubject === subject);
    if (named) renderSourceLink(documentTarget, subject, new Map([[subject, named]]));
    // The system's body list arrives the first time it is shown.
    if (information && view === 'system') {
      if (systemBodies?.card !== information) systemBodies = { card: information, presentation: createSystemBodiesPresentation(information, windowTarget) };
      systemBodies.presentation.show(selected.objectId);
    }
  }
  /** The page the shell shows changed in place: its head, and the forms and links that return to it. */
  function presentPage(route: string, seo: Parameters<typeof applySeoHead>[1]) {
    if (coasting) { pendingPage = [route, seo]; return; }
    pendingPage = null;
    applySeoHead(documentTarget, seo);
    for (const [selector, attribute] of [['.object-sidebar-search-card', 'action'], ['.object-sidebar-search-clear', 'href'], ['[data-settings-form]', 'action']] as const) {
      const element = documentTarget.querySelector(selector);
      if (element && element.getAttribute(attribute) !== route) element.setAttribute(attribute, route);
    }
  }
  let presentedSubject: ReturnType<typeof readSelection> | null = null;
  function presentSelection() {
    if (lifetime.disposed) return;
    const subject = readSelection();
    if (presentedSubject === subject) { updateBodyCard(); return; }
    presentedSubject = subject;
    // Every subject is its scene's own page: a scene change writes the head and forms (object-browser.mts bindObject).
    pendingPage = null;
    objectBrowser.refreshSelection();
    // A galaxy, a cluster or a nebula has no surface to stand above: the readout measures to its centre.
    const shown = knownObject(objectId);
    // A level is seen from inside, around the star it is centred on: its readout is an overview's, from that star.
    const ladder = ladderOf(subject);
    viewReadout.setExtendedSubject(!ladder && shown?.worldFrame && isExtendedClassification(shown.classification) ? { name: shown.name, positionM: shown.worldFrame.originM } : null);
    viewReadout.setOverviewScope(ladder?.scope ?? 'system');
    updateBodyCard();
  }
  function own<T extends { destroy(): void }>(controller: T) {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  }
  try {
    if (DIAGNOSTICS_ENABLED) own(mountDiagnosticRecorder({ documentTarget, windowTarget, readCamera: () => camera }));
    objectBrowser = own(createObjectBrowserController(documentTarget, windowTarget, lifetime, { readSelection, readObjectId: () => objectId,
      onCategoryChange: value => preferences.set('highlightedClassification', value),
      onResetDestination,
      // The fit measures the shell around the scene, so it waits for the sheet a pill just opened to come to rest.
      onFrameCategory: classification => { void sheet.whenSettled().then(() => { if (!lifetime.disposed) onFrameCategory?.(classification); }); },
      readIllustrationModels: () => preferences.state.illustrationModelsEnabled,
      onSearchChange: (open, browsing) => sheet.followSearch(open, browsing) }));
    lifetime.onDispose(preferences.subscribe(key => {
      if (key === 'illustrationModelsEnabled') objectBrowser.refreshIllustrations();
    }));
    // Hover, focus or press on another body fetches its card, entry and system view before the click.
    own(bindNavigationIntent({ documentTarget, windowTarget, navigable, skip: id => id === objectId,
      prefetch: id => { fragments.prefetch(id); prefetch(id); } }));
    sheet = own(createSheetController(documentTarget, windowTarget, lifetime,
      () => `${objectId}:${selectionKey(objectBrowser.readSubject())}`));
    settingsController = own(createSettingsController(documentTarget, windowTarget, preferences, lifetime));
    surfaceReader = own(createSurfaceMapReader({ documentTarget, windowTarget }));
    viewReadout = own(createViewReadout({ drawer, documentTarget, windowTarget, surfaceReader }));
    lifetime.onDispose(() => disposeContent());
    lifetime.onDispose(() => navigationTransition?.dispose());
    mountContent(objectId);
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
      // Written on change: a camera-driven overview change clears it, possibly while the camera coasts.
      if (notice && notice.textContent !== (message ?? '')) notice.textContent = message ?? '';
      if (notice && notice.hidden !== (message === null)) notice.hidden = message === null;
    },
    beginNavigation,
    setObject,
    presentDestination(value: DestinationPresentation | null) { if (!lifetime.disposed) objectBrowser.presentDestination(value); },
    presentSelection,
    setCamera(provider: ShellCamera | null) {
      if (!lifetime.disposed) {
        camera = provider;
        viewReadout.setCamera(provider);
        updateBodyCard();
      }
    },
    setPlaybackState(state: PlaybackState) {
      if (!lifetime.disposed) {
        settingsController.setPlaybackState(state);
        viewReadout.setPlaybackState(state);
      }
    },
    setNavigationInFlight(active: boolean) {
      if (lifetime.disposed) return;
      const hidden = String(!active);
      if (navigationProgress && navigationProgress.ariaHidden !== hidden) navigationProgress.ariaHidden = hidden;
      viewReadout.setNavigationInFlight(active);
      if (!active) { releaseArrivalControls(); releaseArrivalControls = () => {}; }
    },
    destroy() {
      const errors = lifetime.destroy();
      if (errors.length) throw new AggregateError(errors, "Shell cleanup failed.");
    },
  });

  function beginNavigation(target: ShellNavigationTarget): ShellNavigationTransition | null {
    if (lifetime.disposed) return null;
    navigationTransition?.dispose();
    let arrived = false;
    let restoreBrowser = () => {};
    const settlePreview = (keep: boolean) => {
      if (!keep) restoreBrowser();
    };
    const retainsSourceCard = target.object.id !== objectId;
    const transition: NonNullable<typeof navigationTransition> = {
      // Removing the offscreen context rail repaints the resident 3D surface in
      // WebKit. Publish the prepared card only after the router retires that scene.
      retainsSourceCard,
      // A system's card is its star's: which parts it shows is read from the selection once the star's card is there.
      cardView: target.view === 'system' ? null : target.view,
      arrive({ subject, content }) {
        if (navigationTransition !== transition || arrived) return;
        const keep = content ? target.object.id === content.id : subject.view === target.view;
        arrived = true;
        transition.retainsSourceCard = false;
        settlePreview(keep);
        if (content) {
          setObject(content);
          const controls = [...sectionElement(drawer, '.object-information-panel')?.querySelectorAll<HTMLElement>('.object-card-tabs, [data-information-panel]') ?? []]
            .filter(node => node.dataset.informationGroup !== 'overview').map(node => [node, node.inert] as const);
          for (const [node] of controls) node.inert = true;
          releaseArrivalControls = () => { for (const [node, inert] of controls) if (node.inert !== inert) node.inert = inert; };
        }
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
      if (target.view === 'system') {
        if (target.preview) restoreBrowser = objectBrowser.previewSelection({ objectId: target.object.id, view: 'system' });
      } else {
        if (!retainsSourceCard) sheet.showSelection();
        restoreBrowser = objectBrowser.previewSelection({ objectId: target.object.id, view: target.view });
        updateBodyCard();
      }
      return transition;
    } catch (error) {
      transition.dispose();
      throw error;
    }
  }

  function setObject(content: NavigationContent) {
    if (lifetime.disposed) return;
    disposeContent();
    content.apply();
    objectId = content.id;
    presentedSubject = null; pendingPage = null;
    objectBrowser.bindObject(content.id);
    mountContent(content.id);
  }

  function bindCardMaps() {
    const next = [...drawer.querySelectorAll<HTMLElement>('.object-surface-minimap')];
    if (next.length === boundCardMaps.length && next.every((map, index) => map === boundCardMaps[index])) return;
    boundCardMaps = next;
    surfaceReader.reset();
    viewReadout.bindObject();
  }
  function disposeContent() {
    const errors = contentLifetime?.destroy() ?? [];
    contentLifetime = null;
    if (errors.length) throw new AggregateError(errors, 'Object shell content cleanup failed.');
  }
  function mountContent(id: string) {
    const owner = contentLifetime = createSceneLifetime();
    informationCard = mountInformationCard(drawer, id, windowTarget, owner);
    tabs.sync();
    settingsController.bindObject();
    bindCardMaps();
    const subject = readSelection();
    informationCard.activatePanels();
  }
}
