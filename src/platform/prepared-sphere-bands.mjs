import { registerBodyDependentLayers } from "./body-layer-registration.mjs";
import { createPreparedProjectiveTextureLeaf } from "./prepared-projective-texture-leaf.mjs";
import { canonicalPreparedAsset } from "./prepared-object-assets.mjs";

// The existing band recipe is identical for the two sourced spherical bodies.
// Class names and prepared geometry are inputs; session and material ownership
// remain in object-runtime and object-selection-runtime.
export function mountPreparedSphereBands(stage, context, { plan, lenses, prefix, schema }) {
  if (plan.schema !== schema || plan.counts.runtimeGeometryPreparation !== false ||
      plan.counts.runtimeRasterization !== false) throw new TypeError("Prepared sphere-band scene is incompatible.");
  const document = stage.ownerDocument;
  const mesh = (className, style) => {
    const node = document.createElement("div");
    node.className = `polycss-mesh ${className}`;
    if (style) node.style.cssText = style;
    return node;
  };
  const cameraElement = mesh(`polycss-camera ${prefix}-camera planet-render-root`, plan.camera.style);
  context.own(() => cameraElement.remove());
  context.own(() => { if (cameraElement.parentNode === stage) delete stage.dataset.lens; });
  const sceneElement = mesh("polycss-scene", plan.camera.sceneStyle);
  const system = mesh(`${prefix}-system`, plan.body.systemTransform);
  sceneElement.appendChild(system);
  cameraElement.appendChild(sceneElement);
  const surface = [], polar = [];
  for (const band of plan.body.bands) {
    const pole = band.latitudeIndex === 0 || band.latitudeIndex === plan.body.latitudeSegments - 1;
    const carrier = mesh(pole ? `${prefix}-body ${prefix}-body-polar` : `${prefix}-body`,
      `${plan.body.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
    (pole ? polar : surface).push(carrier);
    carrier.style.setProperty(`--${prefix}-surface-texture`, `url("${canonicalPreparedAsset(plan.body.assets.surface)}")`);
    carrier.style.setProperty(`--${prefix}-poles-texture`, `url("${canonicalPreparedAsset(plan.body.assets.poles)}")`);
    for (const leaf of band.leaves) carrier.appendChild(createPreparedProjectiveTextureLeaf(leaf));
    system.appendChild(carrier);
  }
  const materialRoot = mesh(`${prefix}-material-root planet-render-root`);
  context.own(() => materialRoot.remove());
  const material = document.createElement("s");
  material.className = `${prefix}-material`;
  material.style.backgroundImage = `url("${context.resources.url("curvature")}")`;
  materialRoot.appendChild(material);
  stage.replaceChildren(cameraElement, materialRoot);
  stage.dataset.lens = lenses.defaultLens;
  return Object.freeze({
    cameraElement, sceneElement,
    bodyLayers: Object.freeze([registerBodyDependentLayers({ objectId: prefix,
      sceneElement, bodySystem: system, lightingOverlays: [materialRoot] })]),
    commitSelection({ selection, resources }) {
      const surfaceUrl = resources.url(`surface:${selection.lensId}`);
      const polesUrl = resources.url(`poles:${selection.lensId}`);
      for (const carrier of surface) carrier.style.setProperty(`--${prefix}-surface-texture`, `url("${surfaceUrl}")`);
      for (const carrier of polar) carrier.style.setProperty(`--${prefix}-poles-texture`, `url("${polesUrl}")`);
      stage.dataset.lens = selection.lensId;
    },
    publishFrame({ view }) {
      const zoomScale = view.zoom / plan.camera.defaultZoom;
      materialRoot.style.scale = `calc(var(--${prefix}-shell-scale) / (var(--planet-viewport-zoom-divisor) / ${zoomScale}))`;
    },
    observe() {
      return { dom: { mode: "prepared-projective-sphere-with-retained-cubic-sky",
        maximumRetainedLeafCount: plan.counts.retainedLeafCount } };
    },
  });
}
