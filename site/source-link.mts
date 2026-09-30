import { sectionElements } from '@cssearth/renderer';
export interface SourceDocumentReference {
  readonly dataset: { readonly sourceDocument?: string; readonly sourceLabel?: string };
}

/** Reuse document links prepared on the retained navigation rows. */
export function sourceDocuments(document: Document): Map<string, SourceDocumentReference> {
  // The browser, context and body card may wait off the page (detached-sections.ts); their rows still name the sources.
  return new Map(sectionElements(document, '.object-browser, .object-context, .object-information-panel')
    .flatMap(root => [...root.querySelectorAll<HTMLElement>('[data-source-subject]')]).map(node => [node.dataset.sourceSubject!, node]));
}

export function renderSourceLink(document: Document, subject: string,
  documents: ReadonlyMap<string, SourceDocumentReference> = sourceDocuments(document)) {
  // Wide layouts show the footer's link; phones and portrait tablets show the sheet's. Both name the same subject.
  // The link the layout does not show waits off the page (layout-sections.mts) and stays current for when it returns.
  for (const link of sectionElements<HTMLAnchorElement>(document, '[data-source-link]')) {
    const source = documents.get(subject) ?? link;
    const href = source.dataset.sourceDocument, label = source.dataset.sourceLabel;
    if (!href || !label) continue;
    if (link.getAttribute('href') !== href) link.setAttribute('href', href);
    if (link.getAttribute('aria-label') !== label) link.setAttribute('aria-label', label);
    if (link.title !== label) link.title = label;
    const text = link.querySelector('[data-source-link-label]');
    if (text && text.textContent !== label) text.textContent = label;
  }
}
