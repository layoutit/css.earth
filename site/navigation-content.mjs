/** Reuse the route's Astro output; this transport does not render a second shell. */
export function createNavigationContent({ documentTarget, windowTarget, fetchPage = windowTarget.fetch.bind(windowTarget) }) {
  let styles = [...documentTarget.head.querySelectorAll('style, link[rel="stylesheet"]')];
  const key = element => element.tagName === 'LINK' ? `link:${element.href}`
    : `style:${element.dataset.viteDevId ?? element.textContent}`;

  return Object.freeze({
    async load(object, { signal }) {
      const response = await fetchPage(object.route, { signal });
      if (!response.ok) throw new Error(`Object content request failed: ${response.status}.`);
      const source = new windowTarget.DOMParser().parseFromString(await response.text(), 'text/html');
      if (signal.aborted) throw signal.reason;
      if (source.body.dataset.objectShell !== object.id || source.querySelector('.planet-stage')?.dataset.objectId !== object.id) {
        throw new Error('Object route content does not match its registry identity.');
      }
      const required = ['.planet-sidebar', '.planet-sidebar-search', '.planet-drawer-content',
        '.planet-object-browser', '.planet-information-panel', '.planet-settings-panel'];
      for (const selector of required) if (!source.querySelector(selector) || !documentTarget.querySelector(selector)) {
        throw new Error(`Object shell content is missing ${selector}.`);
      }
      const existing = new Map(styles.map(style => [key(style), style]));
      const added = [], next = [];
      let committed = false;
      const dispose = () => { if (!committed) for (const element of added) element.remove(); };
      signal.addEventListener('abort', dispose, { once: true });
      try {
        for (const element of source.head.querySelectorAll('style, link[rel="stylesheet"]')) {
          if (element.tagName === 'LINK') element.href = new URL(element.getAttribute('href'), new URL(object.route, windowTarget.location.href)).href;
          const reused = existing.get(key(element));
          if (reused) { next.push({ element: reused }); continue; }
          const native = documentTarget.importNode(element, true), media = native.getAttribute('media');
          next.push({ element: native, media }); added.push(native);
          if (native.tagName === 'LINK') {
            native.media = 'not all';
            await new Promise((resolve, reject) => {
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
            // Shared stylesheet nodes survive; only the outgoing object's
            // exclusive CSS is removed before the incoming CSS becomes active.
            const retained = new Set(next.map(({ element }) => element));
            for (const element of styles) if (!retained.has(element)) element.remove();
            for (const item of next) {
              if (Object.hasOwn(item, 'media')) {
                if (item.media === null) item.element.removeAttribute('media');
                else item.element.setAttribute('media', item.media);
              }
              // Moving an attached link clears its CSSStyleSheet until the
              // browser reloads it. The destination camera measures immediately.
              if (item.element.parentNode !== documentTarget.head) documentTarget.head.append(item.element);
            }
            styles = next.map(({ element }) => element);
            committed = true; signal.removeEventListener('abort', dispose);
            for (const selector of ['.planet-information-panel', '.planet-settings-panel']) {
              if (preserveSidebar && selector === '.planet-information-panel') continue;
              const target = documentTarget.querySelector(selector), incoming = source.querySelector(selector);
              target.replaceChildren(...[...incoming.childNodes].map(node => documentTarget.importNode(node, true)));
            }
            for (const selector of [...required, '.planet-sidebar-view-all', '.planet-sheet-handle',
              '.explorer-rail-explore', '.explorer-rail-about', '.planet-settings-action', '.explorer-about-panel', '.explorer-about-panel h2']) {
              const target = documentTarget.querySelector(selector), incoming = source.querySelector(selector);
              if (!target || !incoming) continue;
              for (const name of ['id', 'aria-label', 'aria-controls', 'aria-labelledby', 'placeholder', 'data-has-destinations']) {
                const value = incoming.getAttribute(name);
                if (value === null) target.removeAttribute(name); else target.setAttribute(name, value);
              }
            }
            const footer = documentTarget.querySelector('.planet-attribution-footer'), incomingFooter = source.querySelector('.planet-attribution-footer');
            if (footer) {
              footer.hidden = !incomingFooter;
              if (incomingFooter) {
                footer.replaceChildren(...[...incomingFooter.childNodes].map(node => documentTarget.importNode(node, true)));
                footer.setAttribute('aria-label', incomingFooter.getAttribute('aria-label'));
              }
            } else if (incomingFooter) documentTarget.body.append(documentTarget.importNode(incomingFooter, true));
            documentTarget.title = source.title;
            for (const incoming of source.head.querySelectorAll(
              'link[rel="canonical"], meta[name="description"], meta[property^="og:"], meta[name^="twitter:"]',
            )) {
              const key = incoming.tagName === 'LINK' ? 'rel' : incoming.hasAttribute('property') ? 'property' : 'name';
              const target = documentTarget.head.querySelector(`${incoming.tagName}[${key}="${incoming.getAttribute(key)}"]`);
              if (target) {
                const value = incoming.tagName === 'LINK' ? 'href' : 'content';
                target.setAttribute(value, incoming.getAttribute(value));
              } else documentTarget.head.append(documentTarget.importNode(incoming, true));
            }
            documentTarget.body.dataset.objectShell = object.id;
            const stage = documentTarget.querySelector('.planet-stage'), input = documentTarget.querySelector('.planet-input-surface');
            stage.dataset.objectId = object.id;
            stage.setAttribute('aria-label', `Interactive 3D CSS visualization of ${object.name}`);
            input?.setAttribute('aria-label', `Explore ${object.name}`);
            for (const anchor of documentTarget.querySelectorAll('a.planet-object-link, a.scale-stop')) {
              const route = new URL(anchor.href, windowTarget.location.href);
              const selected = route.origin === windowTarget.location.origin && route.pathname === object.route;
              if (selected) anchor.setAttribute('aria-current', 'page');
              else if (anchor.getAttribute('aria-current') === 'page') anchor.removeAttribute('aria-current');
              if (anchor.classList.contains('planet-object-link')) anchor.classList.toggle('is-active', selected);
              anchor.closest('.scale-planet')?.classList.toggle('active', selected);
            }
          },
          dispose,
        });
      } catch (error) { signal.removeEventListener('abort', dispose); dispose(); throw error; }
    },
  });
}
