// Content only: reuse the shell's existing lens rows, legend and typography.
export function createGeographicLensBinding(root, capacity = 0) {
  const slots = [...(root?.querySelectorAll("[data-geographic-option]") ?? [])].map(option => ({
    option, button: option.querySelector("button"), image: option.querySelector("img"),
    label: option.querySelector(".planet-lens-label"), legend: option.querySelector("[data-lens-legend]"),
    status: option.querySelector("[data-geographic-status]"), rows: [...option.querySelectorAll("li")],
    qualification: option.querySelector("[data-geographic-qualification]"), source: option.querySelector("[data-geographic-source]"),
    attribution: option.querySelector("[data-geographic-attribution]"), license: option.querySelector("[data-geographic-license]"),
    content: null,
  }));
  if (slots.length !== capacity) throw new Error("Geographic lens controls do not match the mounted capacity.");
  let previousEntity;
  return {
    inputs: slots.map(slot => slot.button),
    publish(entity, state, ready) {
      const lenses = entity?.lenses ?? [];
      if (lenses.length > capacity) throw new Error("Entity lenses exceed the retained shell capacity.");
      for (const [index, slot] of slots.entries()) {
        const lens = lenses[index], active = Boolean(lens && state?.id === lens.id);
        if (entity !== previousEntity) {
          slot.button.value = lens?.id ?? `geographic-slot-${index}`;
          slot.legend.dataset.lensLegend = slot.button.value;
          slot.label.textContent = lens?.label ?? "";
          if (lens) slot.image.src = lens.thumbnailUrl; else slot.image.removeAttribute("src");
          slot.option.dataset.entityAvailable = String(Boolean(lens));
          slot.option.hidden = !lens;
          slot.legend.ariaLabel = lens ? `${lens.label} legend` : "Lens legend";
        }
        slot.button.disabled = !ready || !lens;
        slot.button.setAttribute("aria-pressed", String(active));
        slot.legend.hidden = !active;
        const content = active ? state.content : null;
        const status = !active ? "" : state.status === "error" ? "This lens could not load. Select it to retry." :
          state.status === "loading" ? "Loading lens…" : state.status === "no-coverage" ?
            content?.overview ? "No detailed source data in this view. The overview shows available coverage." : "No source data in this view. Zoom in or return to the place." :
          state.resolution === "overview" ? "Showing overview. Zoom in for available detail." : "";
        if (slot.status.textContent !== status) slot.status.textContent = status;
        slot.status.hidden = !status;
        if (content === slot.content) continue;
        slot.content = content;
        for (const [i, row] of slot.rows.entries()) {
          const item = content?.legend.items[i]; row.hidden = !item;
          if (!item) continue;
          row.querySelector(".planet-lens-legend-swatch").style.setProperty("--planet-lens-legend-color", item.color);
          row.querySelector(".planet-lens-legend-category-label").textContent = item.label;
          row.querySelector(".planet-lens-legend-category-description").textContent = item.description ?? "";
        }
        slot.qualification.hidden = slot.source.hidden = !content;
        if (!content) continue;
        slot.qualification.textContent = `${content.source.year} · ${content.source.units}. ${content.qualification}`;
        slot.attribution.href = content.source.url; slot.attribution.textContent = content.source.publisher;
        slot.license.href = content.source.licenseUrl; slot.license.textContent = content.source.license;
      }
      previousEntity = entity;
    },
  };
}
