import { sectionElements, showSection } from '@cssearth/renderer';

/** A closed tab's panel is not mounted: the server ships it in a template (Detached.astro) and the checked tab's panel is
 * mounted in its place (detached-sections.ts). The body card's own panels stay: narrow screens show them stacked. */
const stacked = (panel: HTMLElement) => panel.parentElement?.classList.contains('object-information-panel') === true;

/** Mounts the panel of each checked tab and detaches the others, in the server's document or the live page. */
export function syncTabPanels(root: ParentNode, radios: Iterable<HTMLInputElement> = root.querySelectorAll<HTMLInputElement>('input.object-native-tab')) {
  const panels = new Map(sectionElements(root, '.object-card-tabpanel').map(panel => [panel.id, panel]));
  for (const radio of radios) {
    const panel = panels.get(radio.getAttribute('aria-controls') ?? '');
    if (panel && !stacked(panel)) showSection(panel, radio.checked);
  }
}

/** Keeps tab panels in step with their tabs for the page's lifetime. */
export function bindTabPanels(document: Document, signal: AbortSignal) {
  syncTabPanels(document);
  document.addEventListener('change', event => {
    const radio = event.target;
    if (!(radio instanceof document.defaultView!.HTMLInputElement) || !radio.classList.contains('object-native-tab')) return;
    syncTabPanels(document, document.querySelectorAll<HTMLInputElement>(`input.object-native-tab[name="${radio.name}"]`));
  }, { signal });
}
