import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';

/** Adopt the existing cards. CSS owns placement, tabs and the native visibility toggle. */
export function createDatasetContextController(drawer: HTMLElement, _document: Document, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const hosts = [...drawer.querySelectorAll<HTMLElement>('.object-information-panel, [data-focus-lens-bank]')]
    .flatMap(host => {
      const rail = host.querySelector<HTMLElement>(':scope > .object-dataset-context-rail');
      return rail ? [{ host, contexts: [...rail.querySelectorAll<HTMLElement>('[data-dataset-context]')] }] : [];
    });
  const render = () => {
    for (const { host, contexts } of hosts) {
      const lens = host.querySelector<HTMLButtonElement>('button:is([name="dataset"], [name="focusLens"])[aria-pressed="true"]')?.value;
      for (const context of contexts) {
        const hidden = context.dataset.datasetContext !== lens;
        if (context.hidden !== hidden) context.hidden = hidden;
      }
    }
  };
  const observer = hosts.length ? new windowTarget.MutationObserver(render) : null;
  observer?.observe(drawer, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
  render();
  const destroy = () => observer?.disconnect();
  lifetime.onDispose(destroy);
  return { destroy };
}
