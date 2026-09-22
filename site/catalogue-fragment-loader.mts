import type { BrowserWindow } from './browser-types.mts';
import type { CatalogueFragmentPin, CatalogueIndexPin } from './catalogue-fragment-pin.mts';
import { parseCatalogueIndex, type CatalogueIndex } from './catalogue-index.mts';

export { readCatalogueFragmentPin, readCatalogueIndexPin } from './catalogue-fragment-pin.mts';

type FetchPage = (url: string) => Promise<Response>;

/**
 * Fetches the shared object catalogue fragment, verifies its bytes against
 * the pin embedded on the page, and returns the parsed `<ul class="object-list">`.
 * The caller inserts it in place of the empty placeholder list.
 */
export async function loadCatalogueFragment(pin: CatalogueFragmentPin, { windowTarget, fetchPage = url => windowTarget.fetch(url) }: {
  windowTarget: BrowserWindow; fetchPage?: FetchPage;
}): Promise<HTMLUListElement> {
  const response = await fetchPage(pin.url);
  if (!response.ok) throw new Error(`Object catalogue request failed: ${response.status}.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== pin.bytes) throw new Error('Object catalogue size drifted.');
  const digest = [...new Uint8Array(await windowTarget.crypto.subtle.digest('SHA-256', buffer))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== pin.sha256) throw new Error('Object catalogue identity drifted.');
  const html = new windowTarget.TextDecoder().decode(buffer);
  const source = new windowTarget.DOMParser().parseFromString(html, 'text/html');
  const rows = source.querySelector('ul.object-list');
  if (!(rows instanceof windowTarget.HTMLUListElement)) throw new Error('Object catalogue content is missing its list.');
  return rows;
}

/** Fetch and verify compact catalogue data without parsing or retaining an HTML document. */
export async function loadCatalogueIndex(pin: CatalogueIndexPin, { windowTarget, fetchPage = url => windowTarget.fetch(url) }: {
  windowTarget: BrowserWindow; fetchPage?: FetchPage;
}): Promise<CatalogueIndex> {
  const response = await fetchPage(pin.url);
  if (!response.ok) throw new Error(`Object catalogue index request failed: ${response.status}.`);
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength !== pin.bytes) throw new Error('Object catalogue index size drifted.');
  const digest = [...new Uint8Array(await windowTarget.crypto.subtle.digest('SHA-256', buffer))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  if (digest !== pin.sha256) throw new Error('Object catalogue index identity drifted.');
  return parseCatalogueIndex(JSON.parse(new windowTarget.TextDecoder().decode(buffer)) as unknown);
}

/** Runs `task` once the browser is idle, or soon after if it never reports one. */
export function scheduleWhenIdle(windowTarget: BrowserWindow, task: () => void): void {
  if (typeof windowTarget.requestIdleCallback === 'function') windowTarget.requestIdleCallback(() => task(), { timeout: 4000 });
  else windowTarget.setTimeout(task, 1500);
}
