import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from "../../../platform/prepared-planar-rotation.mjs";
import { PREPARED_NEPTUNE_SCENE } from "./preparedScene.mjs";
import { materialFor } from "./material.mjs";

export function createPresentation(host, context) {
  const document = host.ownerDocument, plan = PREPARED_NEPTUNE_SCENE;
  if (plan.schema !== "cssneptune-prepared-runtime-scene@1") throw new TypeError("Neptune retained scene plan is incompatible.");
  const camera = document.createElement("div");
  context.own(() => camera.remove());
  context.own(() => {
    if (camera.parentNode !== host) return;
    host.style.removeProperty("--neptune-surface-image");
    host.style.removeProperty("--neptune-poles-image");
    delete host.dataset.lens;
  });
  camera.className = "polycss-camera planet-render-root";
  camera.style.cssText = plan.camera.style;
  const scene = createMesh("polycss-scene", plan.camera.initialTransform);
  scene.ariaHidden = "true";
  const system = createMesh("neptune-system", plan.systemTransform);
  const ring = createMesh("neptune-ring-plane", plan.meshTransform);
  const ringLeaf = createTextureLeaf(plan.ring.leaf);
  ring.appendChild(ringLeaf);
  system.appendChild(ring);
  const bodyCarrierMap = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(({ className }) =>
      className?.includes("neptune-polar"));
    const key = polar ? "polar" : "body";
    let body = bodyCarrierMap.get(key);
    if (!body) {
      body = createMesh(
        polar ? "neptune-body neptune-body-polar" : "neptune-body",
        `${plan.meshTransform};animation-duration:${plan.motion.bodyVisualRotationSeconds}s`,
      );
      bodyCarrierMap.set(key, body);
      system.appendChild(body);
    }
    const leaves = document.createDocumentFragment();
    for (const leaf of band.leaves) leaves.appendChild(createTextureLeaf(leaf));
    body.appendChild(leaves);
  }
  scene.appendChild(system);
  camera.appendChild(scene);

  const fixedMaterialCounter = createMesh(
    "neptune-fixed-material-counter",
    "",
  );
  const fixedMaterialMesh = createMesh(
    "neptune-fixed-material",
    plan.fixedMaterialPlane.transform,
  );
  const fixedMaterialLeaf = createTextureLeaf(plan.fixedMaterialPlane.leaf);
  fixedMaterialLeaf.classList.add("neptune-exterior-material");
  fixedMaterialMesh.appendChild(fixedMaterialLeaf);
  fixedMaterialCounter.appendChild(fixedMaterialMesh);
  system.appendChild(fixedMaterialCounter);

  host.replaceChildren(camera);
  const registration = registerBodyDependentLayers({ objectId: "neptune", sceneElement: scene,
    bodySystem: system, lightingOverlays: [fixedMaterialCounter] });
  const publishRoll = createPreparedPlanarRotationPublisher({ element: fixedMaterialLeaf, width: 1024 });
  let lastPresentation = null, materialFrame = null, appliedRow = null, transformWrites = 0, materialAddressWrites = 0;
  for (const name of ["neptune-hide-rings", "neptune-hide-shadows"]) context.own(() => host.classList.remove(name));
  ringLeaf.style.backgroundImage = `url("${context.resources.url("rings")}")`;
  return Object.freeze({ cameraElement: camera, sceneElement: scene, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection, resources }) {
      host.style.setProperty("--neptune-surface-image", `url("${resources.url(`surface:${selection.lensId}`)}")`);
      host.style.setProperty("--neptune-poles-image", `url("${resources.url(`poles:${selection.lensId}`)}")`);
      host.dataset.lens = selection.lensId;
      host.classList.toggle("neptune-hide-rings", !selection.rings);
      host.classList.toggle("neptune-hide-shadows", !selection.shadows);
    },
    publishFrame({ selection, view, resources }) {
      const localCounter = view.counterRotationFor(system.style.transform);
      if (fixedMaterialCounter.style.transform !== localCounter) { fixedMaterialCounter.style.transform = localCounter; transformWrites++; }
      const facts = materialFor(selection, view);
      materialFrame = facts.frame;
      const prepared = facts.mode === "directional" ? facts.lens.orbitMaterial.presentations[facts.frame] :
        { backgroundPosition: "0px 0px", backgroundSize: "1024px 1024px" };
      const key = facts.mode === "directional" ? facts.rowKey : `${facts.mode}:${selection.lensId}`;
      const url = resources.url(key);
      if (url) {
        const identity = `${url}|${prepared.backgroundPosition}|${prepared.backgroundSize}`;
        if (identity !== lastPresentation) {
          for (const [property, value] of [["backgroundImage", `url("${url}")`],
            ["backgroundPosition", prepared.backgroundPosition], ["backgroundSize", prepared.backgroundSize]]) {
            if (fixedMaterialLeaf.style[property] !== value) { fixedMaterialLeaf.style[property] = value; materialAddressWrites++; }
          }
          lastPresentation = identity;
        }
        appliedRow = facts.mode === "directional" ? prepared.rowIndex : null;
      }
      const azimuth = direction => Math.atan2(direction[1], direction[0]) * 180 / Math.PI;
      publishRoll(selection.shadows ? normalizeDegrees(azimuth(view.sunViewDirection) - azimuth(view.reference.sunViewDirection)) : 0);
    },
    observe() { registration.assertRegistered(); return {
      material: { materialFrame, appliedRow }, camera: { materialFrame, transformWrites, materialAddressWrites },
      dom: { mode: "semantic-transform-groups-with-bare-leaves", retainedCameraRootCount: 1,
        retainedMaterialCompositeRootCount: 0, retainedSceneRootCount: 1, retainedCubicSkyFaceCount: 6 },
    }; },
  });
}

function createMesh(className, style) { const mesh = document.createElement("div"); mesh.className = className.includes("polycss-") ? className : `polycss-mesh ${className}`; if (style) mesh.style.cssText = style; return mesh; }
function createTextureLeaf(leaf) { return createPreparedProjectiveTextureLeaf(leaf); }
function normalizeDegrees(value) { return ((value + 180) % 360 + 360) % 360 - 180; }
