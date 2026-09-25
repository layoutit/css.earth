import type { PreparedSurfaceFeature } from './surface-feature-types.js';

const kilometres = new Intl.NumberFormat('en', { maximumFractionDigits: 0 });
const SITE_CODES = new Set(['LS', 'IM', 'SS', 'RT']);

/** The native selected caption and the interactive label layer own this same card. */
export function surfaceFeatureCaption(root: HTMLElement) {
  const document = root.ownerDocument;
  let tooltip = root.querySelector<HTMLElement>('[data-feature-tooltip]');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.dataset.featureTooltip = '';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.hidden = true;
    tooltip.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    for (const [tag, name] of [['b', 'name'], ['span', 'detail'], ['p', 'origin'], ['p', 'note'], ['small', 'credit']]) {
      const field = document.createElement(tag);
      field.setAttribute(`data-feature-tooltip-${name}`, '');
      tooltip.append(field);
    }
    root.append(tooltip);
  }
  const card = tooltip;
  const fields = Object.fromEntries(['name', 'detail', 'origin', 'note', 'credit'].map(name => {
    const field = card.querySelector<HTMLElement>(`[data-feature-tooltip-${name}]`);
    if (!field) throw new TypeError(`Prepared feature caption is missing ${name}.`);
    return [name, field];
  }));
  return { element: card, show(feature: PreparedSurfaceFeature) {
    fields.name.textContent = feature.name;
    fields.detail.textContent = feature.diameterKm > 0 ? `${feature.type} · ${kilometres.format(feature.diameterKm)} km`
      : SITE_CODES.has(feature.code) ? feature.type : `${feature.type} · size unpublished`;
    fields.origin.textContent = feature.origin;
    fields.note.textContent = feature.note?.text ?? '';
    fields.credit.textContent = feature.note?.credit ? `${feature.credit} · ${feature.note.credit}` : feature.credit;
    card.dataset.featureTooltipFor = feature.id;
    card.hidden = false;
  } };
}
