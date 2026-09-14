import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';

/** Only reveal prepared content; dataset attribution stays out of the runtime. */
export function createDatasetContextController(drawer: HTMLElement, documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const card = drawer.querySelector<HTMLElement>('.planet-information-panel');
  const focusCard = drawer.querySelector<HTMLElement>('[data-prepared-focus-card]');
  const rail = documentTarget.querySelector<HTMLElement>('.planet-dataset-context-rail');
  const dock = documentTarget.querySelector<HTMLElement>('.planet-dataset-context-dock');
  if (!rail || !dock) return { destroy() {} };
  const hosts = [card, ...drawer.querySelectorAll<HTMLElement>('[data-focus-lens-bank]')]
    .filter((host): host is HTMLElement => host !== null)
    .flatMap(host => {
      const template = host.querySelector<HTMLTemplateElement>('template[data-prepared-detail="dataset-context"]');
      if (!template) return [];
      const region = documentTarget.createElement('div');
      region.dataset.datasetContextOwner = template.dataset.contextObject ?? '';
      region.append(documentTarget.importNode(template.content, true));
      return [{ host, region, contexts: [...region.querySelectorAll<HTMLElement>('[data-dataset-context]')] }];
    });
  if (!hosts.length) return { destroy() {} };
  // The retained header toggle outlives object mounts, so a dismissed card stays dismissed.
  const toggleNode = documentTarget.querySelector('.planet-machine-toggle');
  const toggle = toggleNode && toggleNode instanceof windowTarget.HTMLButtonElement ? toggleNode : null;
  rail.replaceChildren(...hosts.map(owner => owner.region));
  const desktop = windowTarget.matchMedia('(min-width: 821px) and (orientation: landscape)');
  const place = () => (desktop.matches ? dock : drawer).append(rail);
  const hide = (node: HTMLElement, hidden: boolean) => { if (node.hidden !== hidden) node.hidden = hidden; };
  const render = () => {
    let available = false;
    for (const { host, region, contexts } of hosts) {
      const owner = host === card ? card : focusCard;
      const active = !host.closest('[hidden]') && owner?.ariaBusy !== 'true' && owner?.dataset.cardView !== 'overview'
        && Boolean(owner?.querySelector('[data-information-tab="dataset"]:checked'));
      const lens = host.querySelector<HTMLButtonElement>('button:is([name="dataset"], [name="focusLens"])[aria-pressed="true"]')?.value;
      hide(region, !active);
      for (const context of contexts) hide(context, context.dataset.datasetContext !== lens);
      available ||= active && contexts.some(context => !context.hidden && context.children.length > 0);
    }
    // Settings borrows this slot while it is open.
    hide(rail, !available || toggle?.dataset.dismissed === 'true' || documentTarget.body.dataset.contextPanel === 'settings');
    if (toggle) {
      toggle.disabled = !available;
      toggle.ariaPressed = String(!rail.hidden);
    }
  };
  const events = new AbortController();
  drawer.addEventListener('change', render, { signal: events.signal });
  // A pressed toggle dismisses the card; otherwise it shows it, taking the slot back from Settings.
  // Capture reads the pressed state before the shell closes Settings and re-renders this card.
  toggle?.addEventListener('click', () => {
    if (toggle.ariaPressed === 'true') toggle.dataset.dismissed = 'true';
    else delete toggle.dataset.dismissed;
    render();
  }, { capture: true, signal: events.signal });
  const observer = new windowTarget.MutationObserver(render);
  observer.observe(drawer, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden', 'data-card-view', 'aria-busy'] });
  observer.observe(documentTarget.body, { attributes: true, attributeFilter: ['data-context-panel'] });
  desktop.addEventListener('change', place);
  place();
  render();
  const destroy = () => {
    events.abort();
    observer.disconnect();
    desktop.removeEventListener('change', place);
    rail.hidden = true;
    if (toggle) {
      toggle.disabled = true;
      toggle.ariaPressed = 'false';
    }
    rail.replaceChildren();
    dock.append(rail);
  };
  lifetime.onDispose(destroy);
  return { destroy };
}
