import type { BrowserWindow } from '../browser/browser-types.mts';
import { requiredElement, requiredSection, sectionElement, setLinkSelected } from '../browser/browser-types.mts';
import type { ObjectEntry } from '../directory/objects.mts';
import { navigationFragments, type NavigationFragments } from './navigation-fragments.mts';
import { createNavigationStyles, type NavigationStyleStage } from './navigation-styles.mts';
import { publishPreparedDescriptor, readPreparedDescriptor } from './prepared-descriptor.mts';
import { updateSettingsPanel, updateShellElement } from './navigation-shell-content.mts';
export interface NavigationContent {
  readonly id: string;
  readonly name: string;
  apply(): void;
  dispose(): void;
}
export type NavigationContentLoader = (object: ObjectEntry, options: { signal: AbortSignal }) => Promise<NavigationContent>;

export function objectLinkIsCurrent(anchor: Pick<HTMLAnchorElement, 'origin' | 'pathname' | 'search'>,
  origin: string, route: string) {
  return anchor.origin === origin && anchor.pathname === route;
}
/** Load the static navigation fragment without a second resident card bank. */
export function createNavigationContent({ documentTarget, windowTarget, fragments = navigationFragments(windowTarget) }: { documentTarget: Document; windowTarget: BrowserWindow; fragments?: NavigationFragments }) {
  const styles = createNavigationStyles(documentTarget, windowTarget);

  return Object.freeze({
    async descriptor(object: ObjectEntry, { signal }: { signal: AbortSignal }) {
      const fragment = await fragments.get(object.id, signal);
      try {
        const descriptor = readPreparedDescriptor(fragment.document, object.id);
        if (!descriptor) throw new Error(`Object ${object.id} navigation content has no prepared descriptor.`);
        return descriptor;
      } finally { fragment.release(); }
    },
    async load(object: ObjectEntry, { signal }: { signal: AbortSignal }): Promise<NavigationContent> {
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
      for (const selector of required) if (!sectionElement(readSource(), selector) || !sectionElement(documentTarget, selector)) {
        releaseSource();
        throw new Error(`Object shell content is missing ${selector}.`);
      }
      // Navigation fragments deliberately omit the shared object browser. Its
      // Atlas tree and deferred catalogue belong to the retained shell, not to
      // every destination fragment.
      if (!sectionElement(documentTarget, '.object-browser')) {
        releaseSource();
        throw new Error('Retained object shell content is missing .object-browser.');
      }
      let preparedStyles: NavigationStyleStage | null = null;
      let committed = false;
      const dispose = () => {
        signal.removeEventListener('abort', dispose);
        preparedStyles?.dispose();
        releaseSource();
      };
      signal.addEventListener('abort', dispose, { once: true });
      try {
        const incomingStyles = await styles.prepare(readSource(), new URL(object.route, windowTarget.location.href), signal);
        preparedStyles = incomingStyles;
        signal.throwIfAborted();
        return Object.freeze({
          id: object.id, name: object.name,
          apply() {
            if (signal.aborted || committed) throw new Error('Object content no longer owns this transition.');
            const incomingSource = readSource();
            try {
              incomingStyles.apply();
              committed = true;
              signal.removeEventListener('abort', dispose);
              for (const selector of ['.object-information-panel', '.object-settings-panel']) {
                // Either card may wait off its page (detached-sections.ts); its contents still swap.
                const target = sectionElement(documentTarget, selector), incoming = sectionElement(incomingSource, selector);
                if (!target || !incoming) throw new Error(`Object shell content disappeared: ${selector}.`);
                // The router retires the source scene before publishing this card.
                if (selector === '.object-settings-panel') updateSettingsPanel(target, incoming);
                else target.replaceChildren(...[...incoming.childNodes].map(node => documentTarget.importNode(node, true)));
              }
              // The hidden form and its view-context inputs belong to the shell.
              // Native submission refreshes their values from the current URL.
              for (const selector of [...required, '[data-settings-form]', '.object-sheet-handle', '.object-settings-action']) {
                const target = sectionElement(documentTarget, selector), incoming = sectionElement(incomingSource, selector);
                if (!target || !incoming) continue;
                for (const name of ['id', 'action', 'aria-label', 'aria-controls', 'aria-labelledby', 'popovertarget', 'placeholder', 'data-has-destinations']) {
                  const value = incoming.getAttribute(name);
                  if (target.getAttribute(name) !== value) {
                    if (value === null) target.removeAttribute(name); else target.setAttribute(name, value);
                  }
                }
              }
              const footer = sectionElement(documentTarget, '.object-attribution-footer'), incomingFooter = incomingSource.querySelector('.object-attribution-footer');
              if (footer) {
                if (footer.hidden !== !incomingFooter) footer.hidden = !incomingFooter;
                if (incomingFooter) {
                  updateShellElement(footer, incomingFooter);
                }
              } else if (incomingFooter) {
                const readout = sectionElement(documentTarget, '.object-view-readout') ?? documentTarget.body;
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
                  const next = incoming.getAttribute(value) ?? '';
                  if (target.getAttribute(value) !== next) target.setAttribute(value, next);
                } else documentTarget.head.append(documentTarget.importNode(incoming, true));
              }
              // The shell marker is structural; scene identity belongs to the stage.
              requiredSection(documentTarget, '.object-browser').id = `${object.id}-object-browser`;
              publishPreparedDescriptor(documentTarget, descriptor);
              const stage = requiredElement(documentTarget, '.object-stage'), input = documentTarget.querySelector('.object-input-surface');
              if (stage.dataset.objectId !== object.id) stage.dataset.objectId = object.id;
              stage.setAttribute('aria-label', `Interactive 3D CSS visualization of ${object.name}`);
              input?.setAttribute('aria-label', `Explore ${object.name}`);
              // Anchors expose their resolved origin and path: ~500 menu links need no URL parse.
              for (const anchor of documentTarget.querySelectorAll<HTMLAnchorElement>('a.object-link')) {
                const selected = objectLinkIsCurrent(anchor, windowTarget.location.origin, object.route);
                setLinkSelected(anchor, selected);
              }
            } finally { releaseSource(); }
          },
          dispose,
        });
      } catch (error) { signal.removeEventListener('abort', dispose); dispose(); throw error; }
    },
  });
}
