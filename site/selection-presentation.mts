import { createSystemBodiesPresentation } from './system-bodies-fragment.mts';
import { createSystemCardContent } from './system-card-content.mts';
import type { SceneOverview, SelectionTarget } from './scene/scene-selection.mts';
import { selectionKey } from './scene/scene-selection.mts';
import { requiredElement, setPanelHidden, setSectionShown, setLinkSelected, type BrowserWindow } from './browser/browser-types.mts';
import { sectionElements } from '@cssearth/renderer';
import type { CatalogueSelection } from './search/catalogue-window.mts';
import { renderSourceLink, type SourceDocumentReference } from './source-link.mts';
import { selectGalaxyNeighbor } from './galaxy-neighbor-selection.mts';
import { WORLD_OBJECTS } from './world-objects.mts';
import { SOLAR_SYSTEM_ID, systemById } from './object-systems.mts';
import { knownObject } from './object-directory.mts';
import { fetchSystemHeaders, spliceSystemHeaders } from './system-headers-fragment.mts';

/** Present the selected subject in the retained cards and result rows. */
export function createSelectionPresentation(documentTarget: Document, {
  windowTarget,
}: { windowTarget?: BrowserWindow } = {}) {
  const browser = requiredElement<HTMLElement>(documentTarget, '.object-browser');
  const information = requiredElement<HTMLElement>(documentTarget, '.object-information-panel');
  // Search/navigation and the selection share one sidebar content owner. The
  // selected content stays retained while the browser temporarily replaces it.
  // The context and each of its cards are mounted only while shown (detached-sections.ts); the others wait in templates.
  const context = sectionElements(documentTarget, '.object-context')[0];
  if (!context) throw new Error('Object shell context is missing.');
  // One card per overview (OverviewCard.astro).
  const overviewCards = sectionElements(context, '[data-large-scale-overview]');
  const focusCard = sectionElements(context, '[data-prepared-focus-card]')[0] ?? null;
  const system = sectionElements(context, '[data-system-results]')[0] ?? null;
  let systemHeaders = [...(system?.querySelectorAll<HTMLElement>('[data-system-header]') ?? [])];
  // Other systems' headers load with the first overview that needs one (`system-headers-fragment.mts`).
  let currentSystemHeader = SOLAR_SYSTEM_ID, systemHeadersLoading: Promise<void> | null = null;
  const showSystemHeader = (id: string) => {
    currentSystemHeader = id;
    for (const header of systemHeaders) {
      const current = header.dataset.systemHeader === id;
      if (header.hasAttribute('data-system-current') !== current) header.toggleAttribute('data-system-current', current);
    }
    // Native pages already carry their own system header; only live navigation loads others.
    if (!system || !windowTarget || systemHeadersLoading || systemHeaders.some(header => header.dataset.systemHeader === id)) return;
    systemHeadersLoading = fetchSystemHeaders(url => windowTarget.fetch(url)).then(html => {
      systemHeaders = spliceSystemHeaders(system, new windowTarget.DOMParser().parseFromString(html, 'text/html'));
      showSystemHeader(currentSystemHeader);
    }).catch(error => { systemHeadersLoading = null; windowTarget.reportError(error); });
  };
  const solarSystemFacts = system ? sectionElements(system, '[data-solar-system-facts]')[0] ?? null : null;
  const systemBodies = createSystemBodiesPresentation(system, windowTarget);
  let systemContent = createSystemCardContent(documentTarget);
  const objectName = (id: string) => WORLD_OBJECTS.find(object => object.id === id)?.name ?? '';
  const overviewName = ({ scope, systemId }: SceneOverview) => scope === 'system'
    ? systemById(WORLD_OBJECTS, systemId)?.name ?? 'Solar System'
    : knownObject(scope)?.name ?? '';
  const present = (subject: SelectionTarget, sourceLinks?: ReadonlyMap<string, SourceDocumentReference>): CatalogueSelection => {
    const focus = subject.kind === 'focus' ? subject : null;
    const overview = subject.kind === 'overview' ? subject.overview : null;
    // The subject a card may list: a catalogue focus, or an overview that is a member of a larger level (the Milky Way in
    // the Local Group).
    const subjectId = focus ? focus.id : overview && overview.scope !== 'system' ? overview.scope : null;
    const lists = (card: HTMLElement) => subjectId !== null
      && sectionElements(card, '[data-neighbor-id]').some(row => row.dataset.neighborId === subjectId);
    // An overview shows its own card; a catalogue focus shows the card of the level that lists it.
    const shown = overview && overview.scope !== 'system' ? overviewCards.find(card => card.dataset.largeScaleOverview === overview.scope)
      : focus ? overviewCards.find(lists) : undefined;
    // Each card measures its distances from the subject it lists, or else from its home (the member holding the stars, or
    // the observer).
    for (const card of overviewCards) selectGalaxyNeighbor(card, lists(card) ? subjectId! : card.dataset.neighborHome ?? 'observer');
    const systemSelected = overview?.scope === 'system';
    const showContext = subject.kind === 'overview' || subject.kind === 'focus';
    for (const card of overviewCards) setSectionShown(card, card === shown);
    if (focusCard) setSectionShown(focusCard, !!focus);
    if (system) setSectionShown(system, systemSelected);
    systemContent.show(systemSelected);
    setPanelHidden(information, showContext);
    setSectionShown(context, showContext);
    renderSourceLink(documentTarget, selectionKey(subject), sourceLinks);
    const headerSystemId = systemSelected ? overview.systemId : SOLAR_SYSTEM_ID;
    showSystemHeader(headerSystemId);
    systemBodies.show(systemSelected ? headerSystemId : null);
    if (solarSystemFacts && solarSystemFacts.hidden !== (headerSystemId !== SOLAR_SYSTEM_ID)) solarSystemFacts.hidden = headerSystemId !== SOLAR_SYSTEM_ID;
    const label = subject.kind === 'focus'
      ? (focusCard?.dataset.preparedFocusId === subject.id ? focusCard.querySelector('[data-focus-name]')?.textContent : null) || 'Selected object'
      : subject.kind === 'overview' ? overviewName(subject.overview)
      : subject.kind === 'satellite-system' ? objectName(subject.hostId) || 'Selected system'
      : objectName(subject.objectId) || 'Selected object';
    if (context.getAttribute('aria-label') !== label) context.setAttribute('aria-label', label);
    const kind = subject.kind === 'focus' ? 'prepared-focus'
      : subject.kind === 'overview' ? subject.overview.scope : subject.kind === 'satellite-system' ? 'satellite-system' : 'object';
    if (documentTarget.documentElement.dataset.selection !== kind) documentTarget.documentElement.dataset.selection = kind;
    const selection = subject.kind === 'focus' ? { kind: 'prepared-focus', id: subject.id } as const
      : subject.kind === 'object' ? { kind: 'scene', id: subject.objectId } as const
      : subject.kind === 'satellite-system' ? { kind: 'scene', id: subject.hostId } as const : null;
    for (const anchor of browser.querySelectorAll<HTMLElement>('.object-link')) {
      const selected = selection?.kind === 'prepared-focus' ? anchor.dataset.preparedFocusId === selection.id
        : selection?.kind === 'scene' && anchor.dataset.objectId === selection.id;
      setLinkSelected(anchor, selected);
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
