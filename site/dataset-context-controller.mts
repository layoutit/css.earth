import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';

/** Only reveal prepared content; dataset attribution stays out of the runtime. */
export function createDatasetContextController(drawer: HTMLElement, documentTarget: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const card = drawer.querySelector<HTMLElement>('.planet-information-panel');
  const template = card?.querySelector<HTMLTemplateElement>('template[data-prepared-detail="dataset-context"]');
  const rail = documentTarget.querySelector<HTMLElement>('.planet-dataset-context-rail');
  const dock = documentTarget.querySelector<HTMLElement>('.planet-dataset-context-dock');
  if (!card || !template || !rail || !dock) return { destroy() {} };
  rail.replaceChildren(documentTarget.importNode(template.content, true));
  const contexts = [...rail.querySelectorAll<HTMLElement>('[data-dataset-context]')];
  const desktop = windowTarget.matchMedia('(min-width: 821px) and (orientation: landscape)');
  const place = () => (desktop.matches ? dock : drawer).append(rail);
  const render = () => {
    const lens = card.querySelector<HTMLButtonElement>('button[name="lens"][aria-pressed="true"]')?.value;
    for (const context of contexts) context.hidden = context.dataset.datasetContext !== lens;
    rail.hidden = !!card.closest('[hidden]') || card.ariaBusy === 'true' || card.dataset.cardView === 'overview'
      || card.querySelector<HTMLElement>('[data-information-panel="dataset"]')?.hidden !== false
      || !contexts.some(context => !context.hidden && context.children.length > 0);
  };
  const observer = new windowTarget.MutationObserver(render);
  observer.observe(card, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'hidden', 'data-card-view', 'aria-busy'] });
  observer.observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
  desktop.addEventListener('change', place);
  place();
  render();
  const destroy = () => {
    observer.disconnect();
    desktop.removeEventListener('change', place);
    rail.hidden = true;
    rail.replaceChildren();
    dock.append(rail);
  };
  lifetime.onDispose(destroy);
  return { destroy };
}
