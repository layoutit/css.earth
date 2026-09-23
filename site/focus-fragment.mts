/**
 * The prepared focus card's dataset banks (every deep-sky volume and image-layer
 * bank, with their controls, context panels and resource maps) are the same on
 * every object page and are needed only once a focus is selected. They render
 * once, at `site/pages/focus-fragment/`; each object page carries two empty
 * `[data-focus-banks-slot]` placeholders. The browser and the no-JS focus
 * response fetch that page and splice its bank groups into the placeholders.
 */
export const FOCUS_FRAGMENT_URL = '/focus-fragment/';

/** True while the card still holds the empty placeholders. */
export function focusBanksPending(root: ParentNode): boolean {
  return root.querySelector('[data-focus-banks-slot]') !== null;
}

export async function fetchFocusFragment(fetchUrl: (url: string) => Promise<Response>): Promise<string> {
  const response = await fetchUrl(FOCUS_FRAGMENT_URL);
  if (!response.ok) throw new Error(`Focus fragment ${FOCUS_FRAGMENT_URL} failed: HTTP ${response.status}.`);
  return response.text();
}

/** Replace each placeholder with the matching bank group of a parsed fragment. */
export function spliceFocusBanks(root: HTMLElement, fragment: ParentNode): void {
  const document = root.ownerDocument;
  for (const slot of [...root.querySelectorAll<HTMLElement>('[data-focus-banks-slot]')]) {
    const name = slot.dataset.focusBanksSlot;
    const group = fragment.querySelector<HTMLElement>(`[data-focus-banks="${name}"]`);
    if (!group) throw new Error(`Focus fragment ${FOCUS_FRAGMENT_URL} has no "${name}" bank group.`);
    slot.replaceWith(...[...group.childNodes].map(node => document.importNode(node, true)));
  }
}
