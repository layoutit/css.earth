// A single retained card projects prepared entity content. Kind is metadata;
// the renderer never branches on planet, city, country, crater, or region.
export function createEntityCard({ documentTarget, onNavigate }) {
  const root = documentTarget.querySelector("[data-entity-card]");
  const initial = JSON.parse(root.querySelector("[data-initial-entity]").textContent);
  const heading = root.querySelector(".planet-title");
  const vector = heading.querySelector("svg"), text = heading.querySelector(".planet-title-text");
  const introduction = root.querySelector(".planet-introduction");
  const facts = [...root.querySelectorAll(".planet-primary-facts > li, .planet-additional-facts > li")];
  const resources = [...root.querySelectorAll(".planet-resource-row")];
  const path = root.querySelector(".entity-path");
  const parents = [...path.querySelectorAll("[data-entity-parent]")];
  const events = new AbortController();
  let currentResources = [];
  const write = (node, value) => {
    if (node.firstChild?.nodeType === 3 && node.childNodes.length === 1) node.firstChild.nodeValue = value;
    else node.textContent = value;
  };
  function showResources(values) {
    if (values.length > resources.length) throw new Error("Entity resources exceed prepared capacity.");
    const sourcePanel = root.querySelector(".planet-resources-panel");
    if (sourcePanel) sourcePanel.hidden = values.length === 0;
    for (const [index, row] of resources.entries()) {
      const resource = values[index]; row.hidden = !resource;
      if (!resource) continue;
      row.href = resource.href; row.title = resource.description;
      write(row.querySelector(".planet-resource-description"), resource.description);
      write(row.querySelector(".planet-resource-label"), resource.label);
    }
  }
  for (const button of parents) button.addEventListener("click", () => onNavigate(button.dataset.entityParent), { signal: events.signal });
  function show(entity, lookup = () => null) {
    const entityFacts = entity.facts ?? [], entityResources = entity.resources ?? [];
    if (entityFacts.length > facts.length || entityResources.length > resources.length) throw new Error("Entity card exceeds its prepared content capacity.");
    const ancestors = [], visited = new Set([entity.id]);
    let parentId = entity.parentId;
    while (parentId) {
      if (visited.has(parentId) || ancestors.length === parents.length) throw new Error("Entity hierarchy is cyclic or exceeds its prepared capacity.");
      visited.add(parentId);
      const parent = parentId === initial.id ? initial : lookup(parentId);
      if (!parent) throw new Error(`Missing prepared parent: ${parentId}.`);
      ancestors.unshift(parent); parentId = parent.parentId;
    }
    root.dataset.entityId = entity.id; root.dataset.entityKind = entity.kind;
    heading.ariaLabel = entity.name;
    vector.toggleAttribute("hidden", !entity.title);
    text.hidden = Boolean(entity.title);
    if (entity.title) {
      delete heading.dataset.dynamicTitle;
      vector.setAttribute("viewBox", entity.title.renderViewBox);
      vector.setAttribute("width", entity.title.renderWidth);
      vector.setAttribute("height", entity.title.renderHeight);
      vector.querySelector("path").setAttribute("d", entity.title.path);
    } else { heading.dataset.dynamicTitle = "true"; write(text, entity.name); }
    write(introduction, entity.introduction ?? "");
    introduction.hidden = !introduction.textContent;
    root.dataset.introductionState = entity.introduction ? "ready" : "empty";
    delete root.dataset.introductionSource;
    root.querySelector(".planet-factsheet-section").hidden = entityFacts.length === 0;
    for (const [index, row] of facts.entries()) {
      const fact = entityFacts[index]; row.hidden = !fact;
      row.dataset.factId = fact?.id ?? "";
      write(row.querySelector(".planet-fact-label"), fact?.label ?? "");
      write(row.querySelector(".planet-fact-value"), fact?.value ?? "");
    }
    const overflow = root.querySelector(".planet-facts-overflow");
    if (overflow) overflow.hidden = entityFacts.length <= 4;
    for (const section of root.querySelectorAll("[data-card-section]")) section.hidden = !(entity.sections ?? []).includes(section.dataset.cardSection);
    currentResources = entityResources;
    showResources(currentResources);
    path.hidden = ancestors.length === 0;
    for (const [index, button] of parents.entries()) {
      const parent = ancestors[index]; button.parentElement.hidden = !parent;
      button.parentElement.toggleAttribute("data-last-parent", index === ancestors.length - 1);
      button.dataset.entityParent = parent?.id ?? ""; write(button, parent?.name ?? "");
    }
    for (const option of root.querySelectorAll("[data-lens-option]")) {
      const available = (entity.lensIds ?? []).includes(option.querySelector('button[name="lens"]').value);
      option.dataset.entityAvailable = String(available); option.hidden = !available;
    }
    const search = root.querySelector(".planet-lens-search");
    if (search) { search.value = ""; search.dispatchEvent(new documentTarget.defaultView.Event("input")); }
  }
  show(initial);
  return Object.freeze({ initial, show,
    introductionLoading() { root.dataset.introductionState = "loading"; },
    showIntroduction(content) {
      root.dataset.introductionState = content ? "ready" : "unavailable";
      if (!content) return;
      showResources([...currentResources, ...content.resources]);
      write(introduction, content.text); introduction.hidden = false;
      root.dataset.introductionSource = JSON.stringify(content.source);
    },
    destroy: () => events.abort() });
}
