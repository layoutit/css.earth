import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';

/** Only reveal prepared content; dataset attribution stays out of the runtime. */
export function createDatasetContextController(drawer: HTMLElement, documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const card = drawer.querySelector<HTMLElement>('.planet-information-panel');
  const template = card?.querySelector<HTMLTemplateElement>('template[data-prepared-detail="dataset-context"]');
  const rail = documentTarget.querySelector<HTMLElement>('.planet-dataset-context-rail');
  const dock = documentTarget.querySelector<HTMLElement>('.planet-dataset-context-dock');
  if (!card || !template || !rail || !dock) return { destroy() {} };
  // The retained header toggle outlives object mounts, so a dismissed card stays dismissed.
  const toggleNode = documentTarget.querySelector('.planet-spacecraft-toggle');
  const toggle = toggleNode && toggleNode instanceof windowTarget.HTMLButtonElement ? toggleNode : null;
  rail.replaceChildren(documentTarget.importNode(template.content, true));
  const contexts = [...rail.querySelectorAll<HTMLElement>('[data-dataset-context]')];
  const desktop = windowTarget.matchMedia('(min-width: 821px) and (orientation: landscape)');
  const place = () => (desktop.matches ? dock : drawer).append(rail);
  const render = () => {
    const lens = card.querySelector<HTMLButtonElement>('button[name="lens"][aria-pressed="true"]')?.value;
    for (const context of contexts) context.hidden = context.dataset.datasetContext !== lens;
    const available = !card.closest('[hidden]') && card.ariaBusy !== 'true' && card.dataset.cardView !== 'overview'
      && card.querySelector<HTMLElement>('[data-information-panel="dataset"]')?.hidden === false
      && contexts.some(context => !context.hidden && context.children.length > 0);
    // Settings borrows this slot while it is open.
    rail.hidden = !available || toggle?.dataset.dismissed === 'true' || documentTarget.body.dataset.contextPanel === 'settings';
    if (toggle) {
      toggle.disabled = !available;
      toggle.ariaPressed = String(!rail.hidden);
    }
  };
  const events = new AbortController();
  // A pressed toggle dismisses the card; otherwise it shows it, taking the slot back from Settings.
  // Capture reads the pressed state before the shell closes Settings and re-renders this card.
  toggle?.addEventListener('click', () => {
    if (toggle.ariaPressed === 'true') toggle.dataset.dismissed = 'true';
    else delete toggle.dataset.dismissed;
    render();
  }, { capture: true, signal: events.signal });
  const observer = new windowTarget.MutationObserver(render);
  observer.observe(card, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden', 'data-card-view', 'aria-busy'] });
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
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
