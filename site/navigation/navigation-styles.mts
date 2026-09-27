import type { BrowserWindow } from '../browser/browser-types.mts';

type StyleNode = HTMLStyleElement | HTMLLinkElement;
interface IncomingStyle { element: StyleNode; media?: string | null; }

export interface NavigationStyleStage {
  apply(): void;
  dispose(): void;
}

/** Install prepared object styles once, before arrival; stage other route styles. */
export function createNavigationStyles(documentTarget: Document, windowTarget: BrowserWindow) {
  let current = [...documentTarget.head.querySelectorAll<StyleNode>('style, link[rel="stylesheet"]')];
  const styleKey = (element: StyleNode) => `style:${element.dataset.viteDevId ?? element.textContent}`;
  const key = (element: StyleNode) => element instanceof windowTarget.HTMLLinkElement ? `link:${element.href}` : styleKey(element);

  return {
    async prepare(source: Document, baseUrl: URL, signal: AbortSignal): Promise<NavigationStyleStage> {
      const existing = new Map(current.map(style => [key(style), style]));
      const added: StyleNode[] = [], next: IncomingStyle[] = [];
      let state: 'prepared' | 'applied' | 'disposed' = 'prepared';
      const dispose = () => {
        signal.removeEventListener('abort', dispose);
        if (state !== 'prepared') return;
        state = 'disposed';
        for (const element of added) element.remove();
      };
      signal.addEventListener('abort', dispose, { once: true });
      try {
        signal.throwIfAborted();
        for (const element of source.head.querySelectorAll<StyleNode>('style, link[rel="stylesheet"]')) {
          const href = element instanceof windowTarget.HTMLLinkElement
            ? new URL(element.getAttribute('href') ?? '', baseUrl).href : null;
          const reused = existing.get(href === null ? styleKey(element) : `link:${href}`);
          if (reused) { next.push({ element: reused }); continue; }
          const native = documentTarget.importNode(element, true), media = native.getAttribute('media');
          if (href !== null && native instanceof windowTarget.HTMLLinkElement) native.href = href;
          if (native instanceof windowTarget.HTMLStyleElement && native.hasAttribute('data-object-style')) {
            // ObjectPage emits shared shell/material rules and object-scoped
            // rules. These are document residents, even if selection changes
            // before arrival. Installing here keeps stylesheet work out of the
            // handoff; cancellation and return visits never remove/reinsert it.
            documentTarget.head.append(native);
            current.push(native);
            existing.set(key(native), native);
            next.push({ element: native });
            continue;
          }
          next.push({ element: native, media });
          added.push(native);
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
        return {
          apply() {
            if (state !== 'prepared' || signal.aborted) throw new Error('Object styles no longer own this transition.');
            const retained = new Set(next.map(({ element }) => element));
            // Keep the installed shared and object sheets across destinations.
            for (const element of current) {
              if (element.hasAttribute('data-object-style')) retained.add(element);
              else if (!retained.has(element)) element.remove();
            }
            for (const item of next) {
              if (item.media !== undefined) {
                if (item.media === null) item.element.removeAttribute('media');
                else item.element.setAttribute('media', item.media);
              }
              // Moving an attached link clears its CSSStyleSheet until it reloads.
              if (item.element.parentNode !== documentTarget.head) documentTarget.head.append(item.element);
            }
            current = [...retained];
            state = 'applied';
            signal.removeEventListener('abort', dispose);
          },
          dispose,
        };
      } catch (error) { dispose(); throw error; }
    },
  };
}
