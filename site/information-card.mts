import type { SceneLifetime } from '@cssearth/engine';
import type { BrowserWindow } from './browser-types.mts';
import type { ObjectEntry } from './object-schema.mts';
import { requiredElement } from './browser-types.mts';
import { objectTypeLabel } from './object-classification-label.mts';
import { createChartPixelAlignmentController } from './chart-pixel-alignment.mts';

type Panel = readonly [string, HTMLDetailsElement];

/** Bind only the controls replaced with an object's information card. */
export function mountInformationCard(drawer: HTMLElement, objectId: string,
  windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const retain = <T extends { destroy(): void }>(controller: T): T => {
    lifetime.onDispose(() => controller.destroy());
    return controller;
  };
  const tabs = retain(createInformationTabsController(drawer, lifetime));
  retain(createChartSwitcherController(drawer, windowTarget, lifetime));
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
  let disposed = false;
  const destroy = () => { disposed = true; };
  lifetime.onDispose(destroy);
  return { show(id: string) {
    if (disposed) return;
    const tab = tabs.find(tab => tab.dataset.informationTab === id);
    if (tab) { tab.checked = true; tab.dispatchEvent(new Event('change', { bubbles: true })); }
  }, destroy };
}

function createChartSwitcherController(drawer: HTMLElement, windowTarget: BrowserWindow, lifetime: SceneLifetime) {
  const switcher = drawer.querySelector<HTMLElement>(".object-chart-switcher");
  if (switcher === null) {
    return Object.freeze({ destroy() {} });
  }
  if (!(switcher instanceof windowTarget.HTMLElement)) {
    throw new Error("Object shell chart switcher is invalid.");
  }
  const previous = switcher.querySelector('.object-chart-step[data-chart-step="-1"]');
  const next = switcher.querySelector('.object-chart-step[data-chart-step="1"]');
  const slides = [...switcher.querySelectorAll(".object-chart-slide")]
    .filter((slide) => slide instanceof windowTarget.HTMLElement);
  const labels = [...switcher.querySelectorAll(".object-chart-label")]
    .filter((label) => label instanceof windowTarget.HTMLElement);
  if (!(previous instanceof windowTarget.HTMLButtonElement) ||
      !(next instanceof windowTarget.HTMLButtonElement) ||
      slides.length === 0 || labels.length !== slides.length) {
    throw new Error("Object shell chart switcher is incomplete.");
  }
  const chartIds = slides.map((slide) => slide.dataset.chartId ?? "");
  if (chartIds.some((id) => id.length === 0) ||
      new Set(chartIds).size !== chartIds.length ||
      labels.some((label) => !chartIds.includes(label.dataset.chartLabel ?? ""))) {
    throw new Error("Object shell chart switcher identities are incomplete.");
  }

  const events = new AbortController();
  lifetime.onDispose(() => events.abort());
  let activeIndex = Math.max(0, chartIds.indexOf(switcher.dataset.activeChart ?? ""));
  const render = (index: number, notify = true) => {
    activeIndex = (index + slides.length) % slides.length;
    const activeId = chartIds[activeIndex];
    switcher.dataset.activeChart = activeId;
    for (const slide of slides) slide.hidden = slide.dataset.chartId !== activeId;
    for (const label of labels) label.hidden = label.dataset.chartLabel !== activeId;

    const previousSlide = slides[(activeIndex - 1 + slides.length) % slides.length];
    const nextSlide = slides[(activeIndex + 1) % slides.length];
    previous.ariaLabel = `Previous chart: ${previousSlide.dataset.chartTitle}`;
    next.ariaLabel = `Next chart: ${nextSlide.dataset.chartTitle}`;
    previous.disabled = slides.length < 2;
    next.disabled = slides.length < 2;
    if (notify) switcher.dispatchEvent(new windowTarget.Event("chartchange"));
  };
  for (const button of [previous, next]) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      render(activeIndex + Number(button.dataset.chartStep));
    }, { signal: events.signal });
  }
  render(activeIndex, false);

  return Object.freeze({
    destroy() {
      events.abort();
    },
  });
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
          panels.filter(([, panel]) => panel.open).map(([name]) => name),
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

/** Fill the shell's one preview card with registry facts; no object content is derived. */
export function objectCardPreview(documentTarget: Document, object: ObjectEntry) {
  const template = requiredElement<HTMLTemplateElement>(documentTarget, 'template[data-object-card-preview]');
  const card = template.content.firstElementChild;
  if (!card) throw new Error('Object card preview is empty.');
  const preview = documentTarget.importNode(card, true);
  const name = requiredElement(preview, '[data-card-preview-name]');
  name.textContent = object.name;
  name.setAttribute('aria-label', object.name);
  requiredElement(preview, '[data-card-preview-classification]').textContent = objectTypeLabel(object);
  requiredElement(preview, '[data-card-preview-description]').textContent = object.description;
  return preview;
}

function restorePanelState(panels: readonly Panel[], objectId: string, windowTarget: Window) {
  try {
    const saved: unknown = JSON.parse(windowTarget.localStorage.getItem(`css.earth:${objectId}:panels`) ?? "null");
    if (Array.isArray(saved) && saved.every(id => typeof id === 'string')) {
      const openPanels = new Set(saved);
      for (const [name, panel] of panels) panel.open = openPanels.has(name);
    }
  } catch {}
}

function panelKey(panel: HTMLDetailsElement) {
  if (!panel.id) throw new Error("Object shell panel identity is missing.");
  return panel.id;
}
