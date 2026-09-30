import { sectionElements, showSection } from '@cssearth/renderer';
import type { SceneSession } from './scene-session.mts';

/** The address names the open panorama, as it names the selected dataset: `?panorama=<id>` on the body's page. Like a
 * dataset choice, opening or closing one replaces the current entry; the view closes with its own button or Escape. */
export const PANORAMA_PARAMETER = 'panorama';

export function panoramaFromUrl(href: string, base?: string): string | null {
  const id = new URL(href, base).searchParams.get(PANORAMA_PARAMETER);
  return id && /^[a-z][a-z0-9-]*$/u.test(id) ? id : null;
}

/** Each bound session's opener, for a selected feature that is a panorama's standpoint (scene-feature.mts). */
const openers = new WeakMap<SceneSession, (id: string) => boolean>();
/** Open a panorama from a navigation that commits its own address: the caller adds the parameter to that address. */
export function openScenePanorama(session: SceneSession, id: string): boolean { return openers.get(session)?.(id) ?? false; }

export function withScenePanorama(url: URL, id: string | null): URL {
  const next = new URL(url);
  if (id) next.searchParams.set(PANORAMA_PARAMETER, id); else next.searchParams.delete(PANORAMA_PARAMETER);
  return next;
}

/** Opens the session's panoramas from the card's Imagery links and from the address, and writes the address back. */
export function bindScenePanoramas(session: SceneSession, { documentTarget, href, publish }: {
  documentTarget: Document;
  /** The address the scene currently publishes: a path, or a full address. */
  href: () => string;
  /** Replace the published address with this one. */
  publish: (url: string) => void;
}) {
  const panoramas = session.mount?.panoramas;
  if (!panoramas) return;
  const controller = new AbortController(), signal = AbortSignal.any([controller.signal, session.signal]);
  const base = () => documentTarget.location?.href ?? 'https://css.earth/';
  const setAddress = (id: string | null) => publish(withScenePanorama(new URL(href(), base()), id).href);
  // The Imagery panel presents the open panorama as the Datasets panel presents its dataset: the row pressed, its details
  // mounted below the list.
  const present = (id: string | null) => {
    for (const row of documentTarget.querySelectorAll<HTMLElement>('[data-panorama-open]')) row.setAttribute('aria-pressed', String(row.dataset.panoramaOpen === id));
    for (const details of sectionElements(documentTarget, '[data-panorama-details]')) showSection(details, details.dataset.panoramaDetails === id);
  };
  const close = () => {
    if (!panoramas.current()) return;
    panoramas.close();
    present(null);
    setAddress(null);
    documentTarget.querySelector<HTMLElement>(`[data-panorama-open]`)?.focus({ preventScroll: true });
  };
  const open = (id: string, address = true) => {
    const panorama = panoramas.plan.panoramas.find(entry => entry.id === id);
    if (!panorama) return false;
    // Zooming out past the widest view leaves for the globe, as zooming in on the globe comes closer.
    const view = panoramas.open(id, documentTarget.querySelector<HTMLElement>('.object-viewport') ?? undefined, close);
    if (!view) return false;
    present(id);
    view.root.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } }, { signal });
    view.root.focus({ preventScroll: true });
    if (address) setAddress(id);
    return true;
  };
  documentTarget.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-panorama-open]') : null;
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const id = link.dataset.panoramaOpen;
    if (id && panoramas.current() === id) { event.preventDefault(); close(); return; }
    // Captured ahead of the router's link navigation (navigation-history.mts), which skips a handled click.
    if (id && open(id)) event.preventDefault();
  }, { signal, capture: true });
  const initial = panoramaFromUrl(href(), base());
  if (initial && !open(initial)) setAddress(null);
  openers.set(session, id => open(id, false));
  session.own(() => { controller.abort(); openers.delete(session); });
}
