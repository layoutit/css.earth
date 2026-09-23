/** Keep one copy of body content while presenting it on the system card, including native responses. */
export function createSystemCardContent(documentTarget: Document) {
  const groups = [
    { source: '[data-lens-volume]', target: '[data-system-dataset-options]' },
    { source: '[data-lens-volume-details]', target: '[data-system-dataset-details]' },
    { source: 'details.object-gallery-panel', target: '[data-system-galleries]' },
  ];
  const entries = groups.flatMap(({ source, target }) => {
    const destination = documentTarget.querySelector<HTMLElement>(target);
    if (!destination) return [];
    return [...documentTarget.querySelectorAll<HTMLElement>(`.object-information-panel ${source}, ${target} ${source}`)].map(node => {
      // Homes survive server serialization, so hydration can return already-moved content in authored order.
      let home = [...documentTarget.querySelectorAll<HTMLElement>('[data-system-content-home]')]
        .find(candidate => candidate.dataset.systemContentHome === node.id);
      if (!home) {
        home = documentTarget.createElement('span'); home.hidden = true;
        home.dataset.systemContentHome = node.id;
        home.toggleAttribute('data-system-content-open', node.hasAttribute('open'));
        node.before(home);
      }
      return { node, home, destination };
    });
  });
  const show = (onSystem: boolean) => {
    for (const { node, home, destination } of entries) {
      if (onSystem) { if (node.parentElement !== destination) destination.append(node); }
      else if (node.previousElementSibling !== home) home.after(node);
      if (node.tagName === 'DETAILS') node.toggleAttribute('open', onSystem || home.hasAttribute('data-system-content-open'));
    }
    for (const selector of ['[data-system-datasets]', '[data-system-galleries]']) {
      const root = documentTarget.querySelector<HTMLElement>(selector);
      if (root) root.hidden = !onSystem || !entries.some(entry => root.contains(entry.destination));
    }
  };
  return { show, restore() { show(false); for (const { home } of entries) home.remove(); } };
}
