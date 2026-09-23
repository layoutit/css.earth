import type { BrowserWindow } from './browser-types.mts';
import { requiredElement } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import { navigationFragments, type NavigationFragments } from './navigation-fragments.mts';
import { publishPreparedDescriptor, readPreparedDescriptor } from './prepared-descriptor.mts';
type StyleNode = HTMLStyleElement | HTMLLinkElement;
interface IncomingStyle { element: StyleNode; media?: string | null; }
export function objectLinkIsCurrent(anchor: Pick<HTMLAnchorElement, 'origin' | 'pathname' | 'search' | 'hasAttribute'>,
  origin: string, route: string) {
  if (anchor.hasAttribute('data-prepared-focus-id') || anchor.origin !== origin || anchor.pathname !== route) return false;
  const query = new URLSearchParams(anchor.search);
  return !query.has('focus') && !query.has('overview');
}
/** Load the static navigation fragment without a second resident card bank. */
export function createNavigationContent({ documentTarget, windowTarget, fragments = navigationFragments(windowTarget) }: { documentTarget: Document; windowTarget: BrowserWindow; fragments?: NavigationFragments }) {
  let styles = [...documentTarget.head.querySelectorAll<StyleNode>('style, link[rel="stylesheet"]')];
  const styleKey = (element: StyleNode) => `style:${element.dataset.viteDevId ?? element.textContent}`;
  const key = (element: StyleNode) => element instanceof windowTarget.HTMLLinkElement ? `link:${element.href}` : styleKey(element);

  return Object.freeze({
    async descriptor(object: ObjectEntry, { signal }: { signal: AbortSignal }) {
      const fragment = await fragments.get(object.id, signal);
      try {
        const descriptor = readPreparedDescriptor(fragment.document, object.id);
        if (!descriptor) throw new Error(`Object ${object.id} navigation content has no prepared descriptor.`);
        return descriptor;
      } finally { fragment.release(); }
    },
    async load(object: ObjectEntry, { signal }: { signal: AbortSignal }) {
      // Selection intent usually requested this fragment already; reuse its
      // encoded HTML while this transition owns the parsed document lease.
      const fragment = await fragments.get(object.id, signal);
      let source: Document | null = fragment.document;
      const readSource = () => {
        if (!source) throw new Error('Object content released its parsed navigation fragment.');
        return source;
      };
      const releaseSource = () => { if (!source) return; source = null; fragment.release(); };
      const descriptor = readPreparedDescriptor(readSource(), object.id);
      if (!descriptor) { releaseSource(); throw new Error(`Object ${object.id} navigation content has no prepared descriptor.`); }
      const required = ['.object-sidebar', '.object-sidebar-search', '.object-drawer-content',
        '.object-information-panel', '.object-settings-panel'];
      for (const selector of required) if (!readSource().querySelector(selector) || !documentTarget.querySelector(selector)) {
        releaseSource();
        throw new Error(`Object shell content is missing ${selector}.`);
      }
      // Navigation fragments deliberately omit the shared object browser. Its
      // Atlas tree and deferred catalogue belong to the retained shell, not to
      // every destination fragment.
      if (!documentTarget.querySelector('.object-browser')) {
        releaseSource();
        throw new Error('Retained object shell content is missing .object-browser.');
      }
      const existing = new Map(styles.map(style => [key(style), style]));
      const added: StyleNode[] = [], next: IncomingStyle[] = [];
      let committed = false;
      const dispose = () => { if (!committed) for (const element of added) element.remove(); releaseSource(); };
      signal.addEventListener('abort', dispose, { once: true });
      try {
        for (const element of readSource().head.querySelectorAll<StyleNode>('style, link[rel="stylesheet"]')) {
          const href = element instanceof windowTarget.HTMLLinkElement
            ? new URL(element.getAttribute('href') ?? '', new URL(object.route, windowTarget.location.href)).href : null;
          const reused = existing.get(href === null ? styleKey(element) : `link:${href}`);
          if (reused) { next.push({ element: reused }); continue; }
          const native = documentTarget.importNode(element, true), media = native.getAttribute('media');
          if (href !== null && native instanceof windowTarget.HTMLLinkElement) native.href = href;
          next.push({ element: native, media }); added.push(native);
          if (native instanceof windowTarget.HTMLLinkElement) {
            native.media = 'not all';
            await new Promise<void>((resolve, reject) => {
              const clear = () => { native.onload = native.onerror = null; signal.removeEventListener('abort', cancel); };
              const cancel = () => { clear(); reject(signal.reason); };
              native.onload = () => { clear(); resolve(); };
              native.onerror = () => { clear(); reject(new Error(`Object stylesheet failed: ${native.href}.`)); };
              signal.addEventListener('abort', cancel, { once: true });
              documentTarget.head.append(native);
              if (signal.aborted) cancel();
            });
          }
        }
        return Object.freeze({
          id: object.id, name: object.name,
          apply({ preserveSidebar = false } = {}) {
            if (signal.aborted || committed) throw new Error('Object content no longer owns this transition.');
            const incomingSource = readSource();
            try {
            // Shared stylesheet nodes survive; only the outgoing object's
            // exclusive CSS is removed before the incoming CSS becomes active.
            const retained = new Set(next.map(({ element }) => element));
            for (const element of styles) if (!retained.has(element)) element.remove();
            for (const item of next) {
              if (item.media !== undefined) {
                if (item.media === null) item.element.removeAttribute('media');
                else item.element.setAttribute('media', item.media);
              }
              // Moving an attached link clears its CSSStyleSheet until the
              // browser reloads it. The destination camera measures immediately.
              if (item.element.parentNode !== documentTarget.head) documentTarget.head.append(item.element);
            }
            styles = next.map(({ element }) => element);
            committed = true; signal.removeEventListener('abort', dispose);
            for (const selector of ['.object-information-panel', '.object-settings-panel', '[data-settings-form]']) {
              const target = documentTarget.querySelector<HTMLElement>(selector), incoming = incomingSource.querySelector<HTMLElement>(selector);
              if (!target || !incoming) throw new Error(`Object shell content disappeared: ${selector}.`);
              // The selection preview was imported from this same fragment and
              // keeps its retained nodes. Only a registry-only preview, whose
              // fragment had not arrived, is replaced by the destination card.
              if (preserveSidebar && selector === '.object-information-panel' && !target.querySelector(':scope > [data-card-preview]')) continue;
              target.replaceChildren(...[...incoming.childNodes].map(node => documentTarget.importNode(node, true)));
            }
            for (const selector of [...required, '[data-settings-form]', '.object-sidebar-view-all', '.object-sheet-handle',
              '.explorer-rail-explore', '.explorer-rail-about', '.object-settings-action', '.explorer-about-panel', '.explorer-about-panel h2']) {
              const target = documentTarget.querySelector<HTMLElement>(selector), incoming = incomingSource.querySelector<HTMLElement>(selector);
              if (!target || !incoming) continue;
              for (const name of ['id', 'action', 'aria-label', 'aria-controls', 'aria-labelledby', 'popovertarget', 'placeholder', 'data-has-destinations']) {
                const value = incoming.getAttribute(name);
                if (value === null) target.removeAttribute(name); else target.setAttribute(name, value);
              }
            }
            const footer = documentTarget.querySelector<HTMLElement>('.object-attribution-footer'), incomingFooter = incomingSource.querySelector('.object-attribution-footer');
            if (footer) {
              footer.hidden = !incomingFooter;
              if (incomingFooter) {
                footer.replaceChildren(...[...incomingFooter.childNodes].map(node => documentTarget.importNode(node, true)));
                for (const name of ['href', 'aria-label', 'title', 'data-source-document', 'data-source-label']) {
                  const value = incomingFooter.getAttribute(name);
                  if (value === null) footer.removeAttribute(name); else footer.setAttribute(name, value);
                }
              }
            } else if (incomingFooter) {
              const readout = documentTarget.querySelector('.object-view-readout') ?? documentTarget.body;
              readout.prepend(documentTarget.importNode(incomingFooter, true));
            }
            documentTarget.title = incomingSource.title;
            for (const incoming of incomingSource.head.querySelectorAll(
              'link[rel="canonical"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]',
            )) {
              const key = incoming.tagName === 'LINK' ? 'rel' : incoming.hasAttribute('property') ? 'property' : 'name';
              const target = documentTarget.head.querySelector(`${incoming.tagName}[${key}="${incoming.getAttribute(key)}"]`);
              if (target) {
                const value = incoming.tagName === 'LINK' ? 'href' : 'content';
                target.setAttribute(value, incoming.getAttribute(value) ?? '');
              } else documentTarget.head.append(documentTarget.importNode(incoming, true));
            }
            documentTarget.body.dataset.objectShell = object.id;
            requiredElement(documentTarget, '.object-browser').id = `${object.id}-object-browser`;
            publishPreparedDescriptor(documentTarget, descriptor);
            const stage = requiredElement(documentTarget, '.object-stage'), input = documentTarget.querySelector('.object-input-surface');
            stage.dataset.objectId = object.id;
            stage.setAttribute('aria-label', `Interactive 3D CSS visualization of ${object.name}`);
            input?.setAttribute('aria-label', `Explore ${object.name}`);
            // Anchors expose their resolved origin and path: ~500 menu links need no URL parse.
            for (const anchor of documentTarget.querySelectorAll<HTMLAnchorElement>('a.object-link')) {
              const selected = objectLinkIsCurrent(anchor, windowTarget.location.origin, object.route);
              if (selected) anchor.setAttribute('aria-current', 'page');
              else if (anchor.getAttribute('aria-current') === 'page') anchor.removeAttribute('aria-current');
              anchor.classList.toggle('is-active', selected);
            }
            } finally { releaseSource(); }
          },
          dispose,
        });
      } catch (error) { signal.removeEventListener('abort', dispose); dispose(); throw error; }
    },
  });
}
