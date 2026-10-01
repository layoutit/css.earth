import { bindTabPanels } from '../tab-panels.mts';
import { sectionElements, sectionPlaceholder, showSection } from '@cssearth/renderer';
import { createObjectBrowserController } from '../object-browser.mts';
import { applySeoHead, focusSeo, objectSeo } from '../seo.mts';
import { knownObject } from '../object-directory.mts';
import { overviewPage } from '../navigation/navigation-scope.mts';
import { presentPageDatasets } from '../page-datasets.mts';
import { navigationHref } from '../navigation/navigation-history.mts';
import type { SceneLifetime } from '@cssearth/engine';
import { createPreparedFocusCard } from '../prepared-focus-card.mts';
import { fetchFocusFragment, focusBanksPending, spliceFocusBanks } from '../focus-fragment.mts';
import { selectionKey } from '../scene/scene-selection.mts';
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
  let navigationTransition: (ShellNavigationTransition & { cardSubject: 'body' | 'satellite-system' | null; retainsSourceCard: boolean }) | null = null;
  let camera: ShellCamera | null = null;
  const focusRoot = sectionElements(drawer, '[data-prepared-focus-card]')[0] ?? null;
  const focusTabs = createTabsController(focusRoot, lifetime, 'prepared-focus');
  const focusCard = createPreparedFocusCard(focusRoot, id => focusTabs.show(id));
  lifetime.onDispose(() => focusCard.destroy());
  // The page ships the focus banks as a shared fragment; the first focus selection fetches it.
  let focusBanks: Promise<void> | null = null;
  function loadFocusBanks() {
    if (!focusRoot || focusBanks || !focusBanksPending(focusRoot)) return;
    focusBanks = fetchFocusFragment(url => windowTarget.fetch(url)).then(html => {
      if (lifetime.disposed) return;
      spliceFocusBanks(focusRoot, new windowTarget.DOMParser().parseFromString(html, 'text/html'));
      focusCard.adoptBanks();
    }).catch(error => {
      focusBanks = null; // The next focus selection retries.
      windowTarget.reportError(error);
    });
  }
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
  function updateBodyCard() {
    if (coasting || navigationTransition?.retainsSourceCard) return;
    if (!information || !drawer.contains(sectionPlaceholder(information))) information = sectionElement(drawer, '.object-information-panel');
    const subject = navigationTransition?.cardSubject ?? (readSelection().kind === 'satellite-system' ? 'satellite-system' : 'body');
    const view = subject === 'satellite-system' ? 'overview' : 'detail';
    if (information && information.dataset.cardView !== view) information.dataset.cardView = view;
    if (information && information.dataset.cardSubject !== subject) information.dataset.cardSubject = subject;
    // The satellite system's header, tabs and bodies are mounted only while the system is the subject (detached-sections.ts).
    if (information) for (const part of sectionElements(information, '[data-satellite-system]'))
      if (sectionPlaceholder(part).parentElement === information) showSection(part, subject === 'satellite-system');
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
    // A page's datasets follow its address on every publication, a dataset-only change included (page-datasets.mts).
    presentPageDatasets(documentTarget, navigationHref(windowTarget), objectId);
    if (presentedSubject === subject) { updateBodyCard(); return; }
    // What the world draws around the scene (a catalogue focus, an overview) is its own page, `/<id>/`.
    const drawnPage = (selected: typeof subject | null) => {
      if (selected?.kind === 'focus') return selected.record ? { id: selected.record.id, seo: focusSeo(selected.record) } : null;
      const overview = selected?.kind === 'overview' ? knownObject(overviewPage(objectId, selected.overview.scope) ?? '') : undefined;
      return overview?.kind === 'overview' ? { id: overview.id, seo: objectSeo(overview) } : null;
    };
    const leftPage = presentedSubject?.kind === 'focus' || drawnPage(presentedSubject) !== null;
    presentedSubject = subject;
    const focus = subject.kind === 'focus' ? subject : null, page = drawnPage(subject);
    // Leaving one returns to the scene's page, whose head and forms a scene change would otherwise write
    // (object-browser.mts bindObject).
    if (page) presentPage(`/${page.id}/`, page.seo);
    // A focus whose record is still loading is already this page's subject: its head waits for the record.
    else if (leftPage && !focus) {
      const scene = knownObject(subject.kind === 'object' ? subject.objectId : subject.kind === 'satellite-system' ? subject.hostId : objectId);
      if (scene?.kind === 'scene') presentPage(scene.route, objectSeo(scene));
    } else pendingPage = null;
    focusCard.set(focus?.record ?? null, focus?.sources ?? [], focus?.presentation ?? null);
    if (focus) loadFocusBanks();
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
    const retainsSourceCard = target.kind !== 'overview' && target.object.id !== objectId;
    const transition: NonNullable<typeof navigationTransition> = {
      // Removing the offscreen context rail repaints the resident 3D surface in
      // WebKit. Publish the prepared card only after the router retires that scene.
      retainsSourceCard,
      cardSubject: target.kind === 'overview' ? null : target.kind === 'satellite-system' ? 'satellite-system' : 'body',
      arrive({ subject, content }) {
        if (navigationTransition !== transition || arrived) return;
        const keep = content ? target.kind !== 'overview' && target.object.id === content.id
          : (subject.kind === 'overview') === (target.kind === 'overview');
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
      if (target.kind === 'overview') {
        if (target.preview) restoreBrowser = objectBrowser.previewSelection({ kind: 'overview', overview: target.overview });
      } else {
        const object = target.object;
        if (!retainsSourceCard) sheet.showSelection();
        restoreBrowser = objectBrowser.previewSelection(target.kind === 'satellite-system'
          ? { kind: 'satellite-system', hostId: object.id } : { kind: 'object', objectId: object.id });
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
    viewReadout.setPreparedFocus(subject.kind === 'focus' ? subject.record : null);
    informationCard.activatePanels();
  }
}
