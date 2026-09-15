import { labelOcclusionFor } from '../src/renderers/css/dist/index.js';

const selectors = '.explorer-brand-row, .planet-search-categories, .planet-header-actions, .planet-sidebar-search-card, .planet-sidebar, .planet-dataset-context-rail, .planet-settings-panel:popover-open';

/** Measure shell layout changes, never camera/renderer publications. */
export function createLabelOcclusionController(document: Document) {
  const window = document.defaultView!;
  const state = labelOcclusionFor(document);
  const ui = document.querySelector('.planet-ui-layer');
  const viewport = document.querySelector('.planet-viewport');
  let frame = 0, disposed = false;
  const observed = new Set<Element>();
  const refresh = () => {
    frame = 0;
    if (disposed || !ui || !viewport) return;
    const panels = [...ui.querySelectorAll<HTMLElement>(selectors)];
    for (const element of observed) if (!panels.includes(element as HTMLElement)) { resize.unobserve(element); observed.delete(element); }
    for (const panel of panels) if (!observed.has(panel)) { observed.add(panel); resize.observe(panel); }
    const bounds = viewport.getBoundingClientRect(), cx = bounds.left + bounds.width / 2, cy = bounds.top + bounds.height / 2;
    state.publish(panels.flatMap(panel => {
      if (!panel.getClientRects().length || window.getComputedStyle(panel).visibility === 'hidden') return [];
      const rect = panel.getBoundingClientRect();
      const left = Math.max(bounds.left, rect.left), right = Math.min(bounds.right, rect.right);
      const top = Math.max(bounds.top, rect.top), bottom = Math.min(bounds.bottom, rect.bottom);
      return right > left && bottom > top ? [{ left: left - cx, right: right - cx, top: top - cy, bottom: bottom - cy }] : [];
    }));
  };
  const invalidate = () => { if (!disposed && !frame) frame = window.requestAnimationFrame(refresh); };
  const resize = new window.ResizeObserver(invalidate);
  if (viewport) resize.observe(viewport);
  const mutations = new window.MutationObserver(records => {
    if (records.some(record => record.attributeName !== 'style' || observed.has(record.target as Element))) invalidate();
  });
  if (ui) mutations.observe(ui, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['hidden', 'open', 'class', 'checked', 'aria-pressed', 'data-card-view', 'style'] });
  mutations.observe(document.body, { attributes: true, attributeFilter: ['data-sheet', 'data-sidebar-collapsed'] });
  mutations.observe(document.documentElement, { attributes: true, attributeFilter: ['data-shell-context'] });
  const events = new AbortController();
  for (const name of ['change', 'toggle', 'scroll', 'transitionend']) ui?.addEventListener(name, invalidate, { capture: true, signal: events.signal });
  window.addEventListener('resize', invalidate, { signal: events.signal });
  refresh();
  return { destroy() {
    disposed = true; if (frame) window.cancelAnimationFrame(frame);
    resize.disconnect(); mutations.disconnect(); events.abort(); state.publish([]);
  } };
}
