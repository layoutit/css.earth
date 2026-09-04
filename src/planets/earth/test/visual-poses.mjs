// Close-up regression evidence at the existing camera limit, not runtime policy.
export const visualPoses = Object.freeze([
  Object.freeze({
    id: "maximum-normal",
    apply: (page) => applyPose(page, "normal", 20, 0),
  }),
  Object.freeze({
    id: "maximum-cutaway",
    apply: (page) => applyPose(page, "cross-section", 60, -105),
  }),
]);

function applyPose(page, lens, pitch, yaw) {
  return page.evaluate(async ({ lens, pitch, yaw }) => {
    const earth = window.__earth;
    await earth.lenses.select(lens);
    const zoom = earth.camera.stats().maximumZoom;
    if (!Number.isFinite(zoom)) throw new Error("Earth maximum zoom is unavailable.");
    earth.camera.setState({ controlPitch: pitch, controlYaw: yaw, zoom });
    const state = earth.camera.state();
    const selection = earth.lenses.state();
    if (selection.id !== lens || !selection.ready || state.controlPitch !== pitch ||
        Math.abs(state.controlYaw - yaw) > 1e-8 || state.zoom !== zoom) {
      throw new Error("Earth visual pose did not reach its requested state.");
    }
    return { lens, pitch: state.controlPitch, yaw: state.controlYaw, zoom: state.zoom };
  }, { lens, pitch, yaw });
}
