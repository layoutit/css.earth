import { sectionElements, sectionPlaceholder } from '@cssearth/renderer';
/** Keep one copy of body content while presenting it on the system card, including native responses. */
export function createSystemCardContent(documentTarget: Document) {
  const groups = [
    { source: '[data-system-dataset]', target: '[data-system-dataset-options]' },
    // The card's container carries the bare attribute; a dataset's details carry its id.
    { source: '[data-system-dataset-details]:not([data-system-dataset-details=""])', target: '[data-system-dataset-details=""]' },
    { source: 'details.object-gallery-panel', target: '[data-system-galleries]' },
  ];
  const entries = groups.flatMap(({ source, target }) => {
    // The system card is mounted only while a system is the subject: its containers are found in or out of the page.
    const destination = sectionElements(documentTarget, target)[0];
    if (!destination) return [];
    // A detached dataset's details (detached-sections.ts) travel as their template placeholder.
    const nodes = new Set([...sectionElements(documentTarget, '.object-information-panel'), ...documentTarget.querySelectorAll<HTMLElement>(target)].flatMap(root => sectionElements(root, source)));
    return [...nodes].map(node => {
      // Homes survive server serialization, so hydration can return already-moved content in authored order.
      let home = [...documentTarget.querySelectorAll<HTMLElement>('[data-system-content-home]')]
        .find(candidate => candidate.dataset.systemContentHome === node.id);
      if (!home) {
        home = documentTarget.createElement('span'); home.hidden = true;
        home.dataset.systemContentHome = node.id;
        home.toggleAttribute('data-system-content-open', node.hasAttribute('open'));
        sectionPlaceholder(node).before(home);
      }
      return { node, home, destination };
    });
  });
  const show = (onSystem: boolean) => {
    for (const { node, home, destination } of entries) {
      const placed = sectionPlaceholder(node);
      if (onSystem) { if (placed.parentElement !== destination) destination.append(placed); }
      else if (placed.previousElementSibling !== home) home.after(placed);
      const open = onSystem || home.hasAttribute('data-system-content-open');
      if (node.tagName === 'DETAILS' && node.hasAttribute('open') !== open) node.toggleAttribute('open', open);
    }
    for (const selector of ['[data-system-datasets]', '[data-system-galleries]']) {
      const root = documentTarget.querySelector<HTMLElement>(selector);
      const hidden = !onSystem || !entries.some(entry => root?.contains(entry.destination));
      if (root && root.hidden !== hidden) root.hidden = hidden;
    }
  };
  return { show, restore() { show(false); for (const { home } of entries) home.remove(); } };
}
