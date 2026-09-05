import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from "../../../platform/prepared-planar-rotation.mjs";
import { PREPARED_URANUS_RUNTIME_SCENE } from "./preparedSceneRuntime.mjs";
import { PREPARED_URANUS_LENSES } from "./preparedLenses.mjs";
import { materialFor, surfaceAssets } from "./material.mjs";

export function createPresentation(stage, context) {
  const assets = surfaceAssets(PREPARED_URANUS_LENSES.defaultLens);
  const plan = PREPARED_URANUS_RUNTIME_SCENE;
  if (plan.schema !== "cssuranus-prepared-runtime-scene@1") {
    throw new TypeError("Uranus retained scene plan is incompatible.");
  }
  const camera = element("div", "polycss-camera planet-render-root");
  context.own(() => camera.remove());
  context.own(() => {
    if (camera.parentNode !== stage) return;
    delete stage.dataset.lens;
  });
  camera.style.cssText = plan.camera.style;
  const scene = element("div", "polycss-scene");
  scene.style.cssText = plan.camera.sceneStyle;
  const system = mesh("uranus-system", plan.systemTransform);
  const ring = mesh(
    "uranus-ring-orbit uranus-ring-plane",
    `${plan.meshTransform};animation-duration:${
      plan.preparedRingSource.planeVisualOrbitSeconds}s`,
  );
  ring.appendChild(textureLeaf(
    "uranus-rings",
    plan.ringPlane,
    assets.ring,
  ));
  system.appendChild(ring);
  const ringShadow = mesh(
    "uranus-ring-shadow",
    plan.meshTransform,
  );
  ringShadow.appendChild(textureLeaf(
    "uranus-ring-shadow-leaf",
    plan.ringShadowPlane,
    assets.ringShadow,
  ));
  system.appendChild(ringShadow);

  const bodyBandCarriers = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(({ className }) =>
      className?.includes("uranus-polar"));
    const carrierKey = `${polar ? "polar" : "body"}:${
      band.visualRotationSeconds}`;
    let carrier = bodyBandCarriers.get(carrierKey);
    if (!carrier) {
      const body = mesh(
        polar ? "uranus-body uranus-body-polar" : "uranus-body",
        `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`,
      );
      body.style.setProperty("--uranus-surface-image", `url(${assets.surface})`);
      body.style.setProperty("--uranus-poles-image", `url(${assets.poles})`);
      carrier = Object.freeze({
        element: body,
        durationSeconds: band.visualRotationSeconds,
      });
      bodyBandCarriers.set(carrierKey, carrier);
      system.appendChild(body);
    }
    appendPreparedLeaves(carrier.element, band.leaves);
  }
  const bodyBands = Object.freeze([...bodyBandCarriers.values()]);
  scene.appendChild(system);
  camera.appendChild(scene);

  const fixedMaterialMesh = mesh(
    "uranus-fixed-material",
    plan.fixedMaterialPlane.transform,
  );
  const fixedMaterialCounter = mesh("uranus-fixed-material-counter", "");
  const fixedMaterialLeaf = textureLeaf(
    "uranus-fixed-material-leaf",
    plan.fixedMaterialPlane.leaf,
    assets.defaultMaterial,
  );
  fixedMaterialMesh.appendChild(fixedMaterialLeaf);
  fixedMaterialCounter.appendChild(fixedMaterialMesh);
  scene.appendChild(fixedMaterialCounter);

  stage.replaceChildren(camera);
  stage.dataset.lens = "normal";
  const registration = registerBodyDependentLayers({ objectId: "uranus", sceneElement: scene,
    bodySystem: system, lightingOverlays: [fixedMaterialCounter] });
  const lighting = plan.preparedLighting;
  const publishMaterialRoll = createPreparedPlanarRotationPublisher({ element: fixedMaterialLeaf, width: lighting.frameSize });
  for (const name of ["uranus-hide-rings", "uranus-hide-shadows"]) context.own(() => stage.classList.remove(name));
  let transformWrites = 0, materialAddressWrites = 0, activeMaterialRow = -1, lastPresentation = "";
  return Object.freeze({
    cameraElement: camera, sceneElement: scene, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection, resources }) {
      for (const { element: root } of bodyBands) {
        root.style.setProperty("--uranus-surface-image", `url(${resources.url(`surface:${selection.lensId}`)})`);
        root.style.setProperty("--uranus-poles-image", `url(${resources.url(`poles:${selection.lensId}`)})`);
      }
      stage.dataset.lens = selection.lensId;
      stage.classList.toggle("uranus-hide-rings", !selection.rings);
      stage.classList.toggle("uranus-hide-shadows", !selection.shadows);
    },
    publishFrame({ selection, view, plan: committedPlan, resources }) {
      if (fixedMaterialCounter.style.transform !== view.counterRotation) {
        fixedMaterialCounter.style.transform = view.counterRotation; transformWrites++;
      }
      const state = materialFor(selection, view, committedPlan);
      const prepared = lighting.presentations[state.materialFrame];
      const key = state.presentationMode === "directional" ? `row:${selection.lensId}:${state.materialRow}`
        : `${state.presentationMode}:${selection.lensId}`;
      const url = resources.url(key);
      const signature = `${key}|${state.presentationMode}|${state.effectiveFrame}`;
      if (url && signature !== lastPresentation) {
        const position = state.presentationMode === "directional" ? prepared.backgroundPosition : "0px 0px";
        const size = state.presentationMode === "directional" ? prepared.backgroundSize : `${lighting.frameSize}px ${lighting.frameSize}px`;
        for (const [property, value] of [["backgroundImage", `url(${url})`], ["backgroundPosition", position], ["backgroundSize", size]]) {
          if (fixedMaterialLeaf.style[property] !== value) { fixedMaterialLeaf.style[property] = value; materialAddressWrites++; }
        }
        lastPresentation = signature;
      }
      activeMaterialRow = state.materialRow;
      const azimuth = direction => Math.atan2(direction[1], direction[0]) * 180 / Math.PI;
      publishMaterialRoll(selection.shadows ? normalizeDegrees(azimuth(view.sunViewDirection) - azimuth(view.reference.sunViewDirection)) : 0);
    },
    observe() {
      registration.assertRegistered();
      return { material: { activeMaterialRow }, camera: { transformWrites, materialAddressWrites, activeMaterialRow },
        dom: { mode: "semantic-transform-groups-with-bare-leaves", retainedCameraRootCount: 1,
          retainedMaterialCompositeRootCount: 0, retainedSceneRootCount: 1, retainedCubicSkyFaceCount: 6 } };
    },
  });
}

function mesh(className, style) {
  const node = element("div", `polycss-mesh ${className}`);
  if (style) node.style.cssText = style;
  return node;
}

function textureLeaf(className, plan, url) {
  const leaf = element("s", className);
  leaf.style.cssText = plan.style;
  leaf.style.backgroundImage = `url(${url})`;
  return leaf;
}

function appendPreparedLeaves(root, plans) {
  const leaves = document.createDocumentFragment();
  for (const plan of plans) {
    leaves.appendChild(createPreparedProjectiveTextureLeaf(plan));
  }
  root.appendChild(leaves);
}

function element(tagName, className) {
  const node = document.createElement(tagName);
  node.className = className;
  node.ariaHidden = "true";
  return node;
}

function normalizeDegrees(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}
