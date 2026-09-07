import type { GeographicEntity, GeographicLensContent, GeographicLensState } from '../paging/geographic-types.js';
function required<T extends Element>(root: ParentNode, selector: string): T {
  const value = root.querySelector<T>(selector);
  if (!value) throw new Error(`Geographic lens control is missing ${selector}.`);
  return value;
}
// Content only: reuse the shell's existing lens rows, legend and typography.
export function createGeographicLensBinding(root: Element | null, capacity = 0) {
  const slots = [...(root?.querySelectorAll<HTMLElement>("[data-geographic-option]") ?? [])].map(option => {
    const button = required<HTMLButtonElement>(option, "button");
    const details = option.ownerDocument.getElementById(button.getAttribute("aria-controls") ?? "");
    if (!details?.hasAttribute("data-geographic-details")) throw new Error("Geographic lens details are missing.");
    return {
      option, button, details, image: required<HTMLImageElement>(option, "img"),
      label: required<HTMLElement>(option, ".planet-lens-label"), legend: required<HTMLElement>(details, "[data-lens-legend]"),
      status: required<HTMLElement>(details, "[data-geographic-status]"), rows: [...details.querySelectorAll("li")],
      heading: required<HTMLElement>(details, "[data-geographic-legend-heading]"),
      title: required<HTMLElement>(details, "[data-geographic-legend-title]"), meta: required<HTMLElement>(details, "[data-geographic-legend-meta]"),
      scale: required<HTMLElement>(details, "[data-geographic-legend-scale]"),
      bar: required<HTMLElement>(details, "[data-geographic-legend-bar]"),
      segments: [...details.querySelectorAll<HTMLElement>(".planet-lens-legend-segment")],
      low: required<HTMLElement>(details, "[data-geographic-legend-low]"), high: required<HTMLElement>(details, "[data-geographic-legend-high]"),
      categories: required<HTMLElement>(details, "[data-geographic-legend-categories]"),
      qualification: required<HTMLElement>(details, "[data-geographic-qualification]"), source: required<HTMLElement>(details, "[data-geographic-source]"),
      attribution: required<HTMLAnchorElement>(details, "[data-geographic-attribution]"), license: required<HTMLAnchorElement>(details, "[data-geographic-license]"),
      content: null as GeographicLensContent | null,
    };
  });
  if (slots.length !== capacity) throw new Error("Geographic lens controls do not match the mounted capacity.");
  let previousEntity: GeographicEntity | null | undefined;
  return {
    inputs: slots.map(slot => slot.button),
    publish(entity: GeographicEntity | null, state: GeographicLensState | null, ready: boolean) {
      const lenses = entity?.lenses ?? [];
      if (lenses.length > capacity) throw new Error("Entity lenses exceed the retained shell capacity.");
      for (const [index, slot] of slots.entries()) {
        const lens = lenses[index], active = Boolean(lens && state?.id === lens.id);
        if (entity !== previousEntity) {
          slot.button.value = lens?.id ?? `geographic-slot-${index}`;
          slot.details.dataset.lensDetails = slot.button.value;
          slot.legend.dataset.lensLegend = slot.button.value;
          slot.label.textContent = lens?.label ?? "";
          if (lens) slot.image.src = lens.thumbnailUrl; else slot.image.removeAttribute("src");
          slot.option.dataset.entityAvailable = String(Boolean(lens));
          slot.option.hidden = !lens;
          slot.legend.ariaLabel = lens ? `${lens.label} legend` : "Lens legend";
        }
        slot.button.disabled = !ready || !lens;
        slot.button.setAttribute("aria-pressed", String(active));
        slot.details.hidden = !active;
        const content = active ? state?.content ?? null : null;
        const status = !active ? "" : state?.status === "error" ? "This lens could not load. Select it to retry." :
          state?.status === "loading" ? "Loading lens…" : state?.status === "no-coverage" ?
            content?.overview ? "No detailed source data in this view. The overview shows available coverage." : "No source data in this view. Zoom in or return to the place." :
          state?.resolution === "overview" ? "Showing overview. Zoom in for available detail." : "";
        if (slot.status.textContent !== status) slot.status.textContent = status;
        slot.status.hidden = !status;
        if (content === slot.content) continue;
        slot.content = content;
        const scale = content?.legend.kind === "scale" ? content.legend : null;
        slot.heading.hidden = !content;
        slot.title.textContent = content?.legend.title ?? "";
        slot.meta.textContent = content ? String(content.source.year) : "";
        slot.scale.hidden = !scale;
        slot.categories.hidden = !content || Boolean(scale);
        if (scale) {
          slot.bar.ariaLabel = `${scale.title ?? lens?.label}: ${scale.items.map(item => item.label).join(", ")}`;
          slot.low.textContent = scale.labels[0];
          slot.high.textContent = `${scale.labels[1]} ${scale.meta ?? content?.source.units ?? ""}`;
        }
        for (const [i, segment] of slot.segments.entries()) {
          const item = scale?.items[i]; segment.hidden = !item;
          if (!item) continue;
          segment.style.setProperty("--planet-lens-legend-color", item.color);
          segment.title = item.label;
        }
        for (const [i, row] of slot.rows.entries()) {
          const item = !scale ? content?.legend.items[i] : null; row.hidden = !item;
          if (!item) continue;
          required<HTMLElement>(row, ".planet-lens-legend-swatch").style.setProperty("--planet-lens-legend-color", item.color);
          required<HTMLElement>(row, ".planet-lens-legend-category-label").textContent = item.label;
          required<HTMLElement>(row, ".planet-lens-legend-category-description").textContent = item.description ?? "";
        }
        slot.qualification.hidden = slot.source.hidden = !content;
        if (!content) continue;
        slot.qualification.textContent = content.qualification;
        slot.attribution.href = content.source.url; slot.attribution.textContent = "Source";
        slot.attribution.title = content.source.publisher;
        slot.attribution.ariaLabel = `Source: ${content.source.publisher}`;
        slot.license.href = content.source.licenseUrl; slot.license.textContent = content.source.license;
      }
      previousEntity = entity;
    },
  };
}
