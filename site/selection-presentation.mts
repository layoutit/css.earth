import { createSystemCardContent } from './system-card-content.mts';
import type { SceneOverview, SceneSubject } from './scene-selection.mts';
import { selectionKey } from './scene-selection.mts';
import type { CatalogueSelection } from './catalogue-window.mts';
import { renderSourceLink, type SourceDocumentReference } from './source-link.mts';
import { selectGalaxyNeighbor } from './galaxy-neighbor-selection.mts';
import { SCENE_OBJECTS } from './objects.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';

export function setPanelHidden(panel: HTMLElement, hidden: boolean) {
  if (panel.hidden !== hidden) panel.hidden = hidden;
  const inert = hidden || panel.ariaBusy === 'true';
  if (panel.inert !== inert) panel.inert = inert;
}

/** Present the selected subject in the retained cards and navigation rows. */
export function createSelectionPresentation(documentTarget: Document, browser: HTMLElement, information: HTMLElement,
  selectNavigation: (id: string) => void) {
  // Search/navigation and the selection share one sidebar content owner. The
  // selected content stays retained while the browser temporarily replaces it.
  const context = documentTarget.querySelector<HTMLElement>('.object-context') ?? browser;
  const sharedLegacyContext = context === browser;
  const galaxy = context.querySelector<HTMLElement>('[data-galactic-overview]');
  const largeScaleCards = [...context.querySelectorAll<HTMLElement>('[data-large-scale-overview]')];
  const focusCard = context.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const system = context.querySelector<HTMLElement>('[data-system-results]');
  const systemHeaders = [...(system?.querySelectorAll<HTMLElement>('[data-system-header]') ?? [])];
  const solarSystemFacts = system?.querySelector<HTMLElement>('[data-solar-system-facts]');
  let systemContent = createSystemCardContent(documentTarget);
  const objectName = (id: string) => SCENE_OBJECTS.find(object => object.id === id)?.name ?? '';
  const overviewName = ({ scope, systemId }: SceneOverview) => scope === 'system'
    ? systemById(SCENE_OBJECTS, systemId)?.name ?? 'Solar System'
    : ({ 'milky-way': 'Milky Way', 'local-group': 'Local Group', 'nearby-universe': 'Nearby Universe' })[scope];
  const publishSource = (subject: SceneSubject, sourceLinks: ReadonlyMap<string, SourceDocumentReference>) => {
    const sourceFocus = subject.kind === 'focus' ? subject.id : '';
    if (browser.dataset.sourceFocus !== sourceFocus) browser.dataset.sourceFocus = sourceFocus;
    renderSourceLink(documentTarget, selectionKey(subject), sourceLinks);
  };
  const render = (subject: SceneSubject) => {
    const focus = subject.kind === 'focus' ? subject : null;
    const overview = subject.kind === 'overview' ? subject.overview : null;
    const galactic = overview?.scope === 'milky-way';
    const neighborCard = largeScaleCards.find(card => card.dataset.largeScaleOverview === 'local-group');
    const galaxySelected = focus && neighborCard
      && [...neighborCard.querySelectorAll<HTMLElement>('[data-neighbor-id]')]
        .some(row => row.dataset.neighborId === focus.id);
    const largeScale = galaxySelected ? neighborCard : overview
      ? largeScaleCards.find(card => card.dataset.largeScaleOverview === overview.scope) : undefined;
    if (neighborCard && (galaxySelected || galactic || largeScale === neighborCard)) {
      selectGalaxyNeighbor(neighborCard, galaxySelected && focus ? focus.id : 'milky-way');
    }
    for (const card of largeScaleCards) setPanelHidden(card, card !== largeScale);
    if (focusCard) setPanelHidden(focusCard, !focus);
    if (galaxy) setPanelHidden(galaxy, !galactic);
    const systemSelected = overview?.scope === 'system';
    if (system) setPanelHidden(system, !systemSelected);
    systemContent.show(systemSelected);
    const showContext = Boolean(focus) || galactic || Boolean(largeScale) || systemSelected;
    setPanelHidden(information, showContext);
    if (!sharedLegacyContext) setPanelHidden(context, !showContext);
    const headerSystemId = systemSelected ? overview.systemId : SOLAR_SYSTEM_ID;
    for (const header of systemHeaders) header.toggleAttribute('data-system-current', header.dataset.systemHeader === headerSystemId);
    if (solarSystemFacts) solarSystemFacts.hidden = headerSystemId !== SOLAR_SYSTEM_ID;
    const navigationSelection = subject.kind === 'focus' ? subject.id
      : subject.kind === 'overview' ? subject.overview.scope === 'system' ? subject.overview.systemId : subject.overview.scope
      : subject.objectId;
    selectNavigation(navigationSelection);
    context.ariaLabel = subject.kind === 'focus' ? subject.record?.name ?? 'Selected object'
      : subject.kind === 'overview' ? largeScale?.dataset.largeScaleName ?? overviewName(subject.overview)
      : objectName(subject.objectId) || 'Selected object';
  };
  const mark = (subject: SceneSubject): CatalogueSelection => {
    documentTarget.documentElement.dataset.selection = subject.kind === 'focus' ? 'prepared-focus'
      : subject.kind === 'overview' ? subject.overview.scope : 'object';
    const selection = subject.kind === 'focus' ? { kind: 'prepared-focus', id: subject.id } as const
      : subject.kind === 'object' ? { kind: 'scene', id: subject.objectId } as const : null;
    for (const anchor of browser.querySelectorAll<HTMLElement>('.object-link')) {
      const selected = selection?.kind === 'prepared-focus' ? anchor.dataset.preparedFocusId === selection.id
        : selection?.kind === 'scene' && anchor.dataset.objectId === selection.id;
      anchor.classList.toggle('is-active', selected);
      if (selected) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
    return selection;
  };
  return {
    render, mark, publishSource,
    bindObject() {
      systemContent.restore();
      systemContent = createSystemCardContent(documentTarget);
    },
  };
}
