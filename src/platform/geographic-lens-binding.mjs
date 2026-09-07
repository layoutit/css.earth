// Content only: reuse the shell's existing lens rows, legend and typography.
export function createGeographicLensBinding(root, capacity = 0) {
  const slots = [...(root?.querySelectorAll("[data-geographic-option]") ?? [])].map(option => {
    const button = option.querySelector("button");
    const details = root.ownerDocument.getElementById(button.getAttribute("aria-controls"));
    if (!details?.hasAttribute("data-geographic-details")) throw new Error("Geographic lens details are missing.");
    return {
      option, button, details, image: option.querySelector("img"),
      label: option.querySelector(".planet-lens-label"), legend: details.querySelector("[data-lens-legend]"),
      status: details.querySelector("[data-geographic-status]"), rows: [...details.querySelectorAll("li")],
      qualification: details.querySelector("[data-geographic-qualification]"), source: details.querySelector("[data-geographic-source]"),
      attribution: details.querySelector("[data-geographic-attribution]"), license: details.querySelector("[data-geographic-license]"),
      content: null,
    };
  });
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
