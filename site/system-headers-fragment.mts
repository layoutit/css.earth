/**
 * Every planetary system's card header renders once, at `site/pages/system-headers-fragment/`. A page carries only the
 * Solar System's and its own, with an empty `[data-system-headers-slot]` after them; the first overview of another
 * system fetches the rest and inserts the missing ones there.
 */
export const SYSTEM_HEADERS_FRAGMENT_URL = '/system-headers-fragment/';

export async function fetchSystemHeaders(fetchUrl: (url: string) => Promise<Response>): Promise<string> {
  const response = await fetchUrl(SYSTEM_HEADERS_FRAGMENT_URL);
  if (!response.ok) throw new Error(`System headers ${SYSTEM_HEADERS_FRAGMENT_URL} failed: HTTP ${response.status}.`);
  return response.text();
}

/** Insert the headers the card lacks, in the fragment's order, at the slot. Returns the card's headers afterwards. */
export function spliceSystemHeaders(card: HTMLElement, fragment: ParentNode): HTMLElement[] {
  const slot = card.querySelector<HTMLElement>(':scope > [data-system-headers-slot]');
  if (!slot) throw new Error('System results card has no header slot.');
  const present = new Set([...card.querySelectorAll<HTMLElement>(':scope > [data-system-header]')].map(header => header.dataset.systemHeader));
  const group = fragment.querySelector('[data-system-headers]');
  if (!group) throw new Error(`System headers ${SYSTEM_HEADERS_FRAGMENT_URL} has no header group.`);
  const document = card.ownerDocument;
  for (const header of group.querySelectorAll<HTMLElement>('[data-system-header]')) {
    if (!present.has(header.dataset.systemHeader)) slot.before(document.importNode(header, true));
  }
  slot.remove();
  return [...card.querySelectorAll<HTMLElement>(':scope > [data-system-header]')];
}
