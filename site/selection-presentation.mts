import { createSystemCardContent } from './system-card-content.mts';
import type { SceneOverview, SelectionTarget } from './scene/scene-selection.mts';
import { selectionKey } from './scene/scene-selection.mts';
import { requiredElement, setPanelHidden, type BrowserWindow } from './browser-types.mts';
import type { CatalogueSelection } from './catalogue-window.mts';
import { renderSourceLink, type SourceDocumentReference } from './source-link.mts';
import { selectGalaxyNeighbor } from './galaxy-neighbor-selection.mts';
import { WORLD_OBJECTS } from './world-objects.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';
import { fetchSystemHeaders, spliceSystemHeaders } from './system-headers-fragment.mts';

/** Present the selected subject in the retained cards and navigation rows. */
export function createSelectionPresentation(documentTarget: Document, {
  windowTarget, selectNavigation = () => {},
}: { windowTarget?: BrowserWindow; selectNavigation?(id: string): void } = {}) {
  const browser = requiredElement<HTMLElement>(documentTarget, '.object-browser');
  const information = requiredElement<HTMLElement>(documentTarget, '.object-information-panel');
  // Search/navigation and the selection share one sidebar content owner. The
  // selected content stays retained while the browser temporarily replaces it.
  const context = requiredElement<HTMLElement>(documentTarget, '.object-context');
  const galaxy = context.querySelector<HTMLElement>('[data-galactic-overview]');
  const largeScaleCards = [...context.querySelectorAll<HTMLElement>('[data-large-scale-overview]')];
  const focusCard = context.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const system = context.querySelector<HTMLElement>('[data-system-results]');
  let systemHeaders = [...(system?.querySelectorAll<HTMLElement>('[data-system-header]') ?? [])];
  // Other systems' headers load with the first overview that needs one (`system-headers-fragment.mts`).
  let currentSystemHeader = SOLAR_SYSTEM_ID, systemHeadersLoading: Promise<void> | null = null;
  const showSystemHeader = (id: string) => {
    currentSystemHeader = id;
    for (const header of systemHeaders) header.toggleAttribute('data-system-current', header.dataset.systemHeader === id);
    // Native pages already carry their own system header; only live navigation loads others.
    if (!system || !windowTarget || systemHeadersLoading || systemHeaders.some(header => header.dataset.systemHeader === id)) return;
    systemHeadersLoading = fetchSystemHeaders(url => windowTarget.fetch(url)).then(html => {
      systemHeaders = spliceSystemHeaders(system, new windowTarget.DOMParser().parseFromString(html, 'text/html'));
      showSystemHeader(currentSystemHeader);
    }).catch(error => { systemHeadersLoading = null; windowTarget.reportError(error); });
  };
  const solarSystemFacts = system?.querySelector<HTMLElement>('[data-solar-system-facts]');
  let systemContent = createSystemCardContent(documentTarget);
  const objectName = (id: string) => WORLD_OBJECTS.find(object => object.id === id)?.name ?? '';
  const overviewName = ({ scope, systemId }: SceneOverview) => scope === 'system'
    ? systemById(WORLD_OBJECTS, systemId)?.name ?? 'Solar System'
    : ({ 'milky-way': 'Milky Way', 'local-group': 'Local Group', 'nearby-universe': 'Nearby Universe' })[scope];
  const present = (subject: SelectionTarget, sourceLinks?: ReadonlyMap<string, SourceDocumentReference>): CatalogueSelection => {
    renderSourceLink(documentTarget, selectionKey(subject), sourceLinks);
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
    const showContext = subject.kind !== 'object';
    setPanelHidden(information, showContext);
    setPanelHidden(context, !showContext);
    const headerSystemId = systemSelected ? overview.systemId : SOLAR_SYSTEM_ID;
    showSystemHeader(headerSystemId);
    if (solarSystemFacts) solarSystemFacts.hidden = headerSystemId !== SOLAR_SYSTEM_ID;
    const navigationSelection = subject.kind === 'focus' ? subject.id
      : subject.kind === 'overview' ? subject.overview.scope === 'system' ? subject.overview.systemId : subject.overview.scope
      : subject.objectId;
    selectNavigation(navigationSelection);
    context.setAttribute('aria-label', subject.kind === 'focus'
      ? (focusCard?.dataset.preparedFocusId === subject.id ? focusCard.querySelector('[data-focus-name]')?.textContent : null) || 'Selected object'
      : subject.kind === 'overview' ? largeScale?.dataset.largeScaleName ?? overviewName(subject.overview)
      : objectName(subject.objectId) || 'Selected object');
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
    present,
    bindObject() {
      systemContent.restore();
      systemContent = createSystemCardContent(documentTarget);
    },
  };
}
