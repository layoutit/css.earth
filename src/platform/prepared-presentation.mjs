import { registerBodyDependentLayers } from "./body-layer-registration.mjs";

const matches = (variant, selection) => Object.entries(variant.when).every(([name, value]) => selection[name] === value);
export function selectedPreparedVariant(definition, selection) {
  const variant = definition.variants.find(variant => matches(variant, selection));
  if (!variant) throw new TypeError("The selected presentation was not prepared.");
  return variant;
}
export function resolvePreparedPresentation(definition, { selection }) {
  const variant = selectedPreparedVariant(definition, selection);
  if (definition.materials.length) throw new TypeError("Material track publication is not implemented yet.");
  return { required: variant.required, prewarm: [], pressedLenses: [selection.lensId] };
}
const datasetKey = name => name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
function readAttribute(element, name) {
  return name.startsWith("data-") ? element.dataset[datasetKey(name)] ?? null : element.getAttribute(name);
}
function writeAttribute(element, name, value) {
  if (name.startsWith("data-")) {
    if (value === null) delete element.dataset[datasetKey(name)];
    else element.dataset[datasetKey(name)] = value;
  } else if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}
const styleValue = (element, name) => name.startsWith("--") ? element.style.getPropertyValue(name) : element.style[name];
function writeStyle(element, name, value) {
  if (name.startsWith("--")) element.style.setProperty(name, value);
  else element.style[name] = value;
}

// No geometry, atlas addressing, band grouping, source conversion, or package
// callbacks enter this builder. The ordered records are final prepared DOM.
export function mountPreparedPresentation(stage, context, definition) {
  const document = stage.ownerDocument, nodes = [], roots = [];
  for (const record of definition.tree.nodes) {
    const node = document.createElement(record.tag);
    nodes.push(node);
    if (record.parent === -1) { roots.push(node); context.own(() => node.remove()); }
    if (record.className !== null) node.className = record.className;
    node.style.cssText = record.style;
    // Keep property assignment distinct from cssText. Chrome's numeric CSS
    // parser can otherwise change the original prepared matrix precision.
    for (const property of record.properties) {
      if (property.custom) node.style.setProperty(property.name, property.value);
      else node.style[property.name] = property.value;
    }
    for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
    if (record.parent !== -1) nodes[record.parent].appendChild(node);
  }
  const cameraElement = nodes[definition.tree.camera], sceneElement = nodes[definition.tree.scene];
  const owned = () => roots.some(root => root.parentNode === stage);
  const stageBindings = new Map();
  for (const variant of definition.variants) for (const binding of variant.writes) {
    if (binding.target === -1) stageBindings.set(`${binding.kind}:${binding.name}`, binding);
  }
  for (const binding of stageBindings.values()) {
    const previous = binding.kind === "attribute" ? readAttribute(stage, binding.name)
      : binding.kind === "class" ? stage.classList.contains(binding.name) : styleValue(stage, binding.name);
    context.own(() => {
      if (!owned()) return;
      if (binding.kind === "attribute") writeAttribute(stage, binding.name, previous);
      else if (binding.kind === "class") stage.classList.toggle(binding.name, previous);
      else writeStyle(stage, binding.name, previous);
    });
  }
  for (const name of definition.tree.stageClasses) {
    const previous = stage.classList.contains(name);
    context.own(() => { if (owned()) stage.classList.toggle(name, previous); });
  }
  stage.replaceChildren(...roots);
  for (const name of definition.tree.stageClasses) stage.classList.add(name);
  const bodyLayers = Object.freeze(definition.tree.registrations.map(record => registerBodyDependentLayers({
    objectId: definition.id, sceneElement, bodySystem: nodes[record.bodySystem], lightingOverlays: record.lightingOverlays.map(index => nodes[index]),
  })));
  const animations = definition.animations.map(plan => {
    const animation = nodes[plan.target].animate(plan.keyframes, { duration: plan.duration, easing: "linear", fill: "both" });
    animation.id = plan.id; context.registerAnimation(animation, { mode: plan.mode });
    return { animation, plan };
  });
  let selectionPublications = 0, framePublications = 0, styleWrites = 0, transformWrites = 0;
  const target = index => index === -1 ? stage : nodes[index];
  return Object.freeze({ cameraElement, sceneElement, bodyLayers,
    commitSelection({ selection, resources }) {
      const variant = selectedPreparedVariant(definition, selection);
      // Resolve the complete texture group before publishing any part of it.
      const writes = variant.writes.map(binding => {
        if (binding.kind !== "texture") return { binding, value: binding.value };
        const url = binding.resource === null ? null : resources.url(binding.resource);
        if (binding.resource !== null && !url) throw new Error(`Prepared selection texture is not ready: ${binding.resource}`);
        return { binding, value: url === null ? "none" : binding.quoted ? `url(${JSON.stringify(url)})` : `url(${url})` };
      });
      for (const { binding, value } of writes) {
        const element = target(binding.target);
        if (binding.kind === "attribute") writeAttribute(element, binding.name, value);
        else if (binding.kind === "class") element.classList.toggle(binding.name, value);
        else { writeStyle(element, binding.name, value); styleWrites++; }
      }
      selectionPublications++;
    },
    publishFrame({ view }) {
      for (const binding of definition.viewBindings) {
        const element = target(binding.target);
        if (binding.kind === "zoom-property") { writeStyle(element, binding.property, String(view.zoom)); styleWrites++; }
        else if (binding.kind === "shell-scale") {
          element.style.scale = `calc(var(${binding.variable}) / (var(--planet-viewport-zoom-divisor) / ${view.zoom / binding.defaultZoom}))`;
          transformWrites++;
        } else {
          const counter = binding.systemTransform === null ? view.counterRotation : view.counterRotationFor(binding.systemTransform);
          if (element.style.transform !== counter) { element.style.transform = counter; transformWrites++; }
        }
      }
      for (const { animation, plan } of animations) context.seekAnimation(animation,
        Math.max(0, Math.min(plan.duration, (view.controlPitch - plan.sourceMinimum) * plan.millisecondsPerDegree)));
      framePublications++;
    },
    observe() {
      for (const registration of bodyLayers) registration.assertRegistered();
      const result = { ...definition.observations.constants };
      for (const count of definition.observations.counts) {
        const element = nodes[count.target], descendants = element.querySelectorAll(count.kind === "leaves" ? "b, s, u" : "*");
        result[count.category] = { ...result[count.category], [count.name]: descendants.length + Number(count.includeRoot) };
      }
      result.presentation = { nodes: nodes.length, roots: roots.length, selectionPublications, framePublications, styleWrites, transformWrites };
      return result;
    },
  });
}
