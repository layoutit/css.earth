/** Reuse document links prepared on the retained navigation rows. */
export function sourceDocuments(document: Document) {
  return new Map([...document.querySelectorAll<HTMLElement>(':is(.planet-object-browser, .planet-object-context) [data-source-subject]')]
    .map(node => [node.dataset.sourceSubject!, node]));
}

export function renderSourceLink(document: Document, subject: string, documents = sourceDocuments(document)) {
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
