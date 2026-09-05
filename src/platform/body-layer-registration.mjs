const registrations = new WeakSet();
const retainedElement = node => node?.nodeType === 1 && node.style &&
  typeof node.closest === "function" && typeof node.contains === "function";

export function registerBodyDependentLayers({
  objectId,
  sceneElement,
  bodySystem,
  lightingOverlays,
}) {
  if (!retainedElement(sceneElement) ||
      !retainedElement(bodySystem) ||
      !Array.isArray(lightingOverlays) || lightingOverlays.length === 0 ||
      lightingOverlays.some((overlay) => !retainedElement(overlay))) {
    throw new TypeError(
      `${objectId} body-layer registration requires one scene, body system, and retained lighting overlay.`,
    );
  }
  const nodes = Object.freeze([bodySystem, ...lightingOverlays]);
  const parents = Object.freeze(nodes.map((node) => node.parentNode));
  const stage = sceneElement.closest(".planet-stage");
  if (!stage) throw new TypeError(`${objectId} scene requires its retained object stage.`);
  assertRegistered();
  const registration = Object.freeze({
    sceneElement,
    bodySystem,
    lightingOverlays: Object.freeze([...lightingOverlays]),
    assertRegistered,
  });
  registrations.add(registration);
  return registration;

  function assertRegistered() {
    if (!bodySystem.isConnected || !sceneElement.contains(bodySystem) ||
        bodySystem.closest(".polycss-scene") !== sceneElement) {
      throw new Error(`${objectId} body system left its camera scene.`);
    }
    for (const overlay of lightingOverlays) {
      if (!overlay.isConnected || overlay.closest(".planet-stage") !== stage) {
        throw new Error(
          `${objectId} lighting overlay left its retained object presentation.`,
        );
      }
    }
    if (!nodes.every((node, index) => node.parentNode === parents[index])) {
      throw new Error(`${objectId} body-layer parent identity changed.`);
    }
    return true;
  }
}

// The common publication boundary consumes real registrations. A record with a
// no-op assertion cannot stand in for ownership of retained body/layer nodes.
export function assertBodyLayerRegistrations(layers, sceneElement) {
  if (!Array.isArray(layers) || layers.length === 0 || new Set(layers).size !== layers.length ||
      layers.some(layer => !registrations.has(layer) || layer.sceneElement !== sceneElement)) {
    throw new TypeError("Presentation requires unique body-layer registrations for its camera scene.");
  }
  for (const layer of layers) layer.assertRegistered();
  return true;
}
