export interface SourceDocumentReference {
  readonly dataset: { readonly sourceDocument?: string; readonly sourceLabel?: string };
}

/** Reuse document links prepared on the retained navigation rows. */
export function sourceDocuments(document: Document): Map<string, SourceDocumentReference> {
  return new Map([...document.querySelectorAll<HTMLElement>('.planet-object-browser [data-source-subject]')]
    .map(node => [node.dataset.sourceSubject!, node]));
}

export function renderSourceLink(document: Document, subject: string,
  documents: ReadonlyMap<string, SourceDocumentReference> = sourceDocuments(document)) {
  const link = document.querySelector<HTMLAnchorElement>('[data-source-link]');
  if (!link) return;
  const source = documents.get(subject) ?? link;
  const href = source.dataset.sourceDocument, label = source.dataset.sourceLabel;
  if (!href || !label) return;
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
  if (link.getAttribute('aria-label') !== label) link.setAttribute('aria-label', label);
  if (link.title !== label) link.title = label;
  const text = link.querySelector('[data-source-link-label]');
  if (text && text.textContent !== label) text.textContent = label;
}
