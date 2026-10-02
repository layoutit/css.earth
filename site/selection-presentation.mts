import type { SceneView, SelectionTarget } from './scene/scene-selection.mts';
import { selectionKey } from './scene/scene-selection.mts';
import { requiredSection, setLinkSelected } from './browser/browser-types.mts';
import type { CatalogueSelection } from './search/catalogue-window.mts';
import { renderSourceLink, type SourceDocumentReference } from './source-link.mts';
import { sectionElements, sectionPlaceholder, showSection } from '@cssearth/renderer';

/** The view a card can show of its object: the one asked for when the card carries that view's parts (a star's card
 * carries its system's, a host's its moons'), otherwise the body. */
export const cardView = (card: HTMLElement, view: SceneView): SceneView => view === 'body'
  || sectionElements(card, '[data-view-part]').some(part => part.dataset.viewPart === view) ? view : 'body';

/** Show a card in one view of its object. Each part of the card that belongs to a view names it (`data-view-part`); the
 * parts of the other views are not mounted (detached-sections.ts). The server's document and the live page share this. */
export function presentCardView(card: HTMLElement, view: SceneView) {
  const layout = view === 'body' ? 'detail' : 'overview';
  if (card.dataset.cardView !== layout) card.dataset.cardView = layout;
  if (card.dataset.cardSubject !== view) card.dataset.cardSubject = view;
  for (const part of sectionElements(card, '[data-view-part]')) if (sectionPlaceholder(part).parentElement === card) showSection(part, part.dataset.viewPart === view);
}

/** Present the selected subject in the retained result rows and the source link. The card itself shows its subject's parts
 * (the body, its moons or its planetary system) in `updateBodyCard` (shell/object-shell-client.mts). */
export function createSelectionPresentation(documentTarget: Document, { card: presentsCard = false }: { /** The server's document has no shell client: its card takes its subject here. */ card?: boolean } = {}) {
  const browser = requiredSection(documentTarget, '.object-browser');
  const present = (subject: SelectionTarget, sourceLinks?: ReadonlyMap<string, SourceDocumentReference>): CatalogueSelection => {
    if (presentsCard) {
      const card = sectionElements(documentTarget, '.object-information-panel')[0];
      if (card) presentCardView(card, cardView(card, subject.view));
    }
    renderSourceLink(documentTarget, selectionKey(subject), sourceLinks);
    const kind = subject.view === 'system' ? 'system' : subject.view === 'moons' ? 'satellite-system' : 'object';
    if (documentTarget.documentElement.dataset.selection !== kind) documentTarget.documentElement.dataset.selection = kind;
    const selection = subject.view === 'system' ? null : { kind: 'scene', id: subject.objectId } as const;
    for (const anchor of browser.querySelectorAll<HTMLElement>('.object-link')) {
      const selected = selection?.kind === 'scene' && anchor.dataset.objectId === selection.id;
      setLinkSelected(anchor, selected);
    }
    return selection;
  };
  return { present, bindObject() {} };
}
