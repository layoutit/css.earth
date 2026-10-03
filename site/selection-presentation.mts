import type { SceneView, SelectionTarget } from './scene/scene-selection.mts';
import { selectionKey, starSystem, subjectHost, subjectView } from './scene/scene-selection.mts';
import { requiredSection, setLinkSelected } from './browser/browser-types.mts';
import type { CatalogueSelection } from './search/catalogue-window.mts';
import { renderSourceLink, type SourceDocumentReference } from './source-link.mts';
import { sectionElements, sectionPlaceholder, showSection } from '@cssearth/renderer';

/** The view a card can show of its object: its system when the card carries the system's parts (a host's card does),
 * otherwise the body. */
export const cardView = (card: HTMLElement, view: SceneView): SceneView => view === 'body'
  || sectionElements(card, '[data-view-part]').some(part => part.dataset.viewPart === view) ? view : 'body';

/** Show a card in one view of its object. Each part of the card that belongs to a view names it (`data-view-part`); the
 * parts of the other views are not mounted (detached-sections.ts). The server's document and the live page share this. */
export function presentCardView(card: HTMLElement, view: SceneView) {
  const layout = view === 'body' ? 'detail' : 'overview';
  if (card.dataset.cardView !== layout) card.dataset.cardView = layout;
  if (card.dataset.cardSubject !== view) card.dataset.cardSubject = view;
  const radios = sectionElements<HTMLInputElement>(card, 'input.object-native-tab');
  // A closed tab's panel stays off the page: its tab mounts it (tab-panels.mts).
  const closed = (part: HTMLElement) => part.classList.contains('object-card-tabpanel')
    && radios.some(radio => radio.getAttribute('aria-controls') === part.id && !radio.checked);
  for (const part of sectionElements(card, '[data-view-part]')) {
    if (sectionPlaceholder(part).parentElement === card) showSection(part, part.dataset.viewPart === view && !closed(part));
  }
}

/** Present the selected subject in the retained result rows and the source link. The card itself shows its subject's parts
 * (the body or its system) in `updateBodyCard` (shell/object-shell-client.mts). */
export function createSelectionPresentation(documentTarget: Document, { card: presentsCard = false }: { /** The server's document has no shell client: its card takes its subject here. */ card?: boolean } = {}) {
  const browser = requiredSection(documentTarget, '.object-browser');
  const present = (subject: SelectionTarget, sourceLinks?: ReadonlyMap<string, SourceDocumentReference>): CatalogueSelection => {
    if (presentsCard) {
      const card = sectionElements(documentTarget, '.object-information-panel')[0];
      if (card) presentCardView(card, cardView(card, subjectView(subject)));
    }
    renderSourceLink(documentTarget, selectionKey(subject), sourceLinks);
    const view = subjectView(subject), ofStar = starSystem(subject);
    const kind = view === 'body' ? 'object' : ofStar ? 'system' : 'satellite-system';
    if (documentTarget.documentElement.dataset.selection !== kind) documentTarget.documentElement.dataset.selection = kind;
    // A planet seen out to its moons keeps its own row marked; a star's planetary system marks none.
    const selection = ofStar ? null : { id: subjectHost(subject) } as const;
    for (const anchor of browser.querySelectorAll<HTMLElement>('.object-link')) {
      const selected = selection !== null && anchor.dataset.objectId === selection.id;
      setLinkSelected(anchor, selected);
    }
    return selection;
  };
  return { present, bindObject() {} };
}
