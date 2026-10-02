import { sectionElements } from '@cssearth/renderer';
import type { BrowserWindow } from './browser/browser-types.mts';

/** Only the selected system's body list travels to the shell, alongside its retained headers. */
export function createSystemBodiesPresentation(card: HTMLElement | null | undefined, windowTarget?: BrowserWindow) {
  // The slot waits off the page until the system is the card's subject (detached-sections.ts).
  const slot = card ? sectionElements(card, '[data-system-bodies-slot]')[0] : undefined;
  let requestedId: string | null = null, loadingId: string | null = null;
  return { show(id: string | null) {
    requestedId = id;
    if (!slot) return;
    if (id && slot.querySelector<HTMLElement>('[data-system-bodies]')?.dataset.systemBodies === id) {
      slot.hidden = false;
      return;
    }
    slot.hidden = true;
    if (!id || !windowTarget || loadingId === id) return;
    loadingId = id;
    const path = `/system-bodies-fragment/${encodeURIComponent(id)}/`;
    void windowTarget.fetch(path).then(async response => {
      if (!response.ok) throw new Error(`System bodies ${path} failed: HTTP ${response.status}.`);
      const fragment = new windowTarget.DOMParser().parseFromString(await response.text(), 'text/html');
      const content = fragment.querySelector<HTMLElement>('[data-system-bodies]');
      if (!content || content.dataset.systemBodies !== id) throw new Error(`System bodies ${path} have the wrong identity.`);
      if (requestedId !== id) return;
      slot.replaceChildren(slot.ownerDocument.importNode(content, true));
      slot.hidden = false;
    }).catch(error => windowTarget.reportError(error)).finally(() => { if (loadingId === id) loadingId = null; });
  } };
}
