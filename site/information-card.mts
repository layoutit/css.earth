import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser/browser-types.mts';
import { createChartPixelAlignmentController } from './chart-pixel-alignment.mts';

type Panel = readonly [string, HTMLDetailsElement];
const TREE_PANEL_STATE = 'tree-sections@1';

/** Bind only the controls replaced with an object's information card. */
export function mountInformationCard(drawer: HTMLElement, objectId: string,
  windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const retain = <T extends { destroy(): void }>(controller: T): T => {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  };
  const tabs = retain(createInformationTabsController(drawer, lifetime));
  const dataset = drawer.querySelector<HTMLDetailsElement>('.object-information-panel > .object-dataset-content');
  // The dataset is a desktop tab and a stacked mobile section, always expanded.
  if (dataset && !dataset.open) dataset.open = true;
  retain(createChartPixelAlignmentController(drawer, windowTarget));
  return {
    show: tabs.show,
    // Restore saved openness after the minimap and view readout are bound.
    activatePanels() { retain(createPanelController(drawer, objectId, windowTarget, lifetime)); },
  };
}

/** A preview restores panel choices without installing live save listeners. */
export function restoreInformationPanels(card: HTMLElement, objectId: string, windowTarget: BrowserWindow) {
  restorePanelState(informationPanels(card, windowTarget), objectId, windowTarget);
}

function informationPanels(card: HTMLElement, windowTarget: BrowserWindow): Panel[] {
  return [...card.querySelectorAll<HTMLElement>(':scope > details, :scope > [data-information-panel] > details')]
    .filter((panel) => panel instanceof windowTarget.HTMLDetailsElement)
    .filter((panel) => !panel.classList.contains('object-dataset-content'))
    .map(panel => [panelKey(panel), panel] as const);
}

export function createInformationTabsController(drawer: HTMLElement, lifetime: SceneLifetime, requestedGroup?: string) {
  return createTabsController(drawer.querySelector<HTMLElement>('.object-information-panel'), lifetime, requestedGroup);
}

/** Programmatic selection for camera/dataset navigation. The browser owns
 * pointer selection, keyboard focus and panel visibility. */
export function createTabsController(card: HTMLElement | null, lifetime: SceneLifetime, requestedGroup?: string) {
  const tabs = [...(card?.querySelectorAll<HTMLInputElement>('[data-information-tab]:not([hidden])') ?? [])]
    .filter(tab => requestedGroup === undefined || (tab.dataset.informationGroup ?? 'detail') === requestedGroup);
  const sections = requestedGroup === undefined
    ? [...(card?.querySelectorAll<HTMLDetailsElement>(':scope > details[data-information-panel]') ?? [])]
    : [];
  let disposed = false;
  const destroy = () => { disposed = true; };
  lifetime.onDispose(destroy);
  return { show(id: string) {
    if (disposed) return;
    const tab = tabs.find(tab => tab.dataset.informationTab === id);
    if (tab) {
      tab.checked = true;
      // A tab in a detached section (detached-sections.ts) belongs to its template's inert document, which has no window.
      tab.dispatchEvent(new (tab.ownerDocument.defaultView ?? globalThis).Event('change', { bubbles: true }));
    }
    const section = sections.find(panel => panel.dataset.informationPanel === id);
    if (section && !section.open) section.open = true;
  }, destroy };
}

function createPanelController(drawer: HTMLElement, objectId: string, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const storageKey = `css.earth:${objectId}:panels`;
  const informationPanel = drawer.querySelector<HTMLElement>(".object-information-panel");
  if (!(informationPanel instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell combined information panel is missing.");
  }
  const panels = informationPanels(informationPanel, windowTarget);

  restorePanelState(panels, objectId, windowTarget);

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  const save = () => {
    try {
      windowTarget.localStorage.setItem(
        storageKey,
        JSON.stringify(
          [TREE_PANEL_STATE, ...panels.filter(([, panel]) => panel.open).map(([name]) => name)],
        ),
      );
    } catch {}
  };
  for (const [, panel] of panels) {
    panel.addEventListener("toggle", save, { signal: events.signal });
  }

  return Object.freeze({
    destroy() {
      events.abort();
    },
  });
}

function restorePanelState(panels: readonly Panel[], objectId: string, windowTarget: Window) {
  try {
    const saved: unknown = JSON.parse(windowTarget.localStorage.getItem(`css.earth:${objectId}:panels`) ?? "null");
    if (Array.isArray(saved) && saved.every(id => typeof id === 'string')) {
      const openPanels = new Set(saved);
      for (const [name, panel] of panels) {
        // Older saved lists predate the main tree disclosures; keep their authored default openness.
        if (!openPanels.has(TREE_PANEL_STATE) && panel.classList.contains('atlas-tree-disclosure')) continue;
        const open = openPanels.has(name);
        if (panel.open !== open) panel.open = open;
      }
    }
  } catch {}
}

function panelKey(panel: HTMLDetailsElement) {
  if (!panel.id) throw new Error("Object shell panel identity is missing.");
  return panel.id;
}
