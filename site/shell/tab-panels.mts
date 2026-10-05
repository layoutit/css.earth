import { sectionElements, showSection } from '@cssearth/renderer';
import { NARROW_LAYOUT } from './narrow-layout.mts';

/** A closed tab's panel is not mounted: the server ships it in a template (Detached.astro) and the checked tab's panel is
 * mounted in its place (detached-sections.ts). The body card's own panels stack on narrow screens (NARROW_LAYOUT), so
 * there they all stay mounted; wide screens show them as tabs and mount only the checked one. */
const inBodyCard = (panel: HTMLElement) => panel.parentElement?.classList.contains('object-information-panel') === true;
// The body card panels a wide layout took off the page: a narrow one puts back only these, never a panel hidden for
// another reason.
const detachedForTabs = new WeakSet<HTMLElement>();

/** Mounts the panel of each checked tab and detaches the others, in the server's document or the live page. The server
 * does not know the layout and keeps the body card stacked. */
export function syncTabPanels(root: ParentNode, radios: Iterable<HTMLInputElement> = root.querySelectorAll<HTMLInputElement>('input.object-native-tab'),
  narrow = true) {
  const panels = new Map(sectionElements(root, '.object-card-tabpanel').map(panel => [panel.id, panel]));
  for (const radio of radios) {
    const panel = panels.get(radio.getAttribute('aria-controls') ?? '');
    if (!panel) continue;
    if (narrow && inBodyCard(panel)) {
      if (detachedForTabs.has(panel)) { detachedForTabs.delete(panel); showSection(panel, true); }
      continue;
    }
    showSection(panel, radio.checked);
    if (inBodyCard(panel) && !radio.checked) detachedForTabs.add(panel); else detachedForTabs.delete(panel);
  }
}

/** Keeps tab panels in step with their tabs and the layout for the page's lifetime; `sync` applies both to a card that
 * navigation has just swapped in. */
export function bindTabPanels(document: Document, signal: AbortSignal) {
  const layout = document.defaultView?.matchMedia(NARROW_LAYOUT);
  const narrow = () => layout?.matches ?? true;
  const sync = () => syncTabPanels(document, undefined, narrow());
  sync();
  layout?.addEventListener('change', sync, { signal });
  document.addEventListener('change', event => {
    const radio = event.target;
    if (!(radio instanceof document.defaultView!.HTMLInputElement) || !radio.classList.contains('object-native-tab')) return;
    syncTabPanels(document, document.querySelectorAll<HTMLInputElement>(`input.object-native-tab[name="${radio.name}"]`), narrow());
  }, { signal });
  return { sync };
}
