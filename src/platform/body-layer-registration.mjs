export function registerBodyDependentLayers({
  objectId,
  sceneElement,
  bodySystem,
  lightingOverlays,
}) {
  if (!(sceneElement instanceof HTMLElement) ||
      !(bodySystem instanceof HTMLElement) ||
      !Array.isArray(lightingOverlays) || lightingOverlays.length === 0 ||
      lightingOverlays.some((overlay) => !(overlay instanceof HTMLElement))) {
    throw new TypeError(
      `${objectId} body-layer registration requires one scene, body system, and retained lighting overlay.`,
    );
  }
  const nodes = Object.freeze([bodySystem, ...lightingOverlays]);
  const parents = Object.freeze(nodes.map((node) => node.parentNode));
  const stage = sceneElement.closest(".planet-stage");
  assertRegistered();
  return Object.freeze({
    sceneElement,
    bodySystem,
    lightingOverlays: Object.freeze([...lightingOverlays]),
    assertRegistered,
  });

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
