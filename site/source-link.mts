export interface SourceDocumentReference {
  readonly dataset: { readonly sourceDocument?: string; readonly sourceLabel?: string };
}

/** Reuse document links prepared on the retained navigation rows. */
export function sourceDocuments(document: Document): Map<string, SourceDocumentReference> {
  return new Map([...document.querySelectorAll<HTMLElement>(':is(.object-browser, .object-context, .object-information-panel) [data-source-subject]')]
    .map(node => [node.dataset.sourceSubject!, node]));
}

export function renderSourceLink(document: Document, subject: string,
  documents: ReadonlyMap<string, SourceDocumentReference> = sourceDocuments(document)) {
  // Wide layouts show the footer's link; phones and portrait tablets show the sheet's. Both name the same subject.
  for (const link of document.querySelectorAll<HTMLAnchorElement>('[data-source-link]')) {
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
