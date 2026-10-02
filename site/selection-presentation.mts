import type { SelectionTarget } from './scene/scene-selection.mts';
import { selectionKey } from './scene/scene-selection.mts';
import { requiredSection, setLinkSelected } from './browser/browser-types.mts';
import type { CatalogueSelection } from './search/catalogue-window.mts';
import { renderSourceLink, type SourceDocumentReference } from './source-link.mts';
import { sectionElements, sectionPlaceholder, showSection } from '@cssearth/renderer';

/** Whether a card carries a planetary system's parts: its star's card does (SystemCard.astro). */
export const hasPlanetarySystem = (card: HTMLElement) => sectionElements(card, '[data-planetary-system]').length > 0;

/** Show a card as its subject: the body's parts, its moons' or its planetary system's. The parts of the other subjects are
 * not mounted (detached-sections.ts). The server's document and the live page share this. */
export function presentCardSubject(card: HTMLElement, subject: 'body' | 'satellite-system' | 'planetary-system') {
  const view = subject === 'body' ? 'detail' : 'overview';
  if (card.dataset.cardView !== view) card.dataset.cardView = view;
  if (card.dataset.cardSubject !== subject) card.dataset.cardSubject = subject;
  for (const [selector, shown] of [['[data-satellite-system]', subject === 'satellite-system'], ['[data-planetary-system]', subject === 'planetary-system']] as const) {
    for (const part of sectionElements(card, selector)) if (sectionPlaceholder(part).parentElement === card) showSection(part, shown);
  }
}

/** Present the selected subject in the retained result rows and the source link. The card itself shows its subject's parts
 * (the body, its moons or its planetary system) in `updateBodyCard` (shell/object-shell-client.mts). */
export function createSelectionPresentation(documentTarget: Document, { card: presentsCard = false }: { /** The server's document has no shell client: its card takes its subject here. */ card?: boolean } = {}) {
  const browser = requiredSection(documentTarget, '.object-browser');
  const present = (subject: SelectionTarget, sourceLinks?: ReadonlyMap<string, SourceDocumentReference>): CatalogueSelection => {
    if (presentsCard) {
      const card = sectionElements(documentTarget, '.object-information-panel')[0];
      if (card) presentCardSubject(card, subject.kind === 'satellite-system' ? 'satellite-system' : subject.kind === 'overview' && hasPlanetarySystem(card) ? 'planetary-system' : 'body');
    }
    renderSourceLink(documentTarget, selectionKey(subject), sourceLinks);
    const kind = subject.kind === 'overview' ? subject.overview.scope : subject.kind === 'satellite-system' ? 'satellite-system' : 'object';
    if (documentTarget.documentElement.dataset.selection !== kind) documentTarget.documentElement.dataset.selection = kind;
    const selection = subject.kind === 'object' ? { kind: 'scene', id: subject.objectId } as const
      : subject.kind === 'satellite-system' ? { kind: 'scene', id: subject.hostId } as const : null;
    for (const anchor of browser.querySelectorAll<HTMLElement>('.object-link')) {
      const selected = selection?.kind === 'scene' && anchor.dataset.objectId === selection.id;
      setLinkSelected(anchor, selected);
    }
    return selection;
  };
  return { present, bindObject() {} };
}
