import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from "../../../platform/prepared-planar-rotation.mjs";
import { preparedRowPresentation } from "../../../platform/prepared-row-presentation.mjs";
import { PREPARED_JUPITER_SCENE } from "./preparedScene.mjs";
import { PREPARED_JUPITER_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_JUPITER_RINGS } from "./preparedRings.mjs";
import { PREPARED_JUPITER_LIGHTING } from "./preparedLighting.mjs";
import { PREPARED_JUPITER_LENSES } from "./preparedLenses.mjs";
import { materialFrameFor } from "./material.mjs";

export function createPresentation(stage, context) {
  const plan = PREPARED_JUPITER_SCENE;
  const document = stage.ownerDocument;
  stage.classList.add("jupiter-stage");
  context.own(() => stage.classList.remove("jupiter-stage"));
  if (plan.schema !== "cssjupiter-prepared-retained-body@1") {
    throw new TypeError("Jupiter retained body plan is incompatible.");
  }
  const camera = createMesh("polycss-camera planet-render-root", plan.camera.style);
  context.own(() => camera.remove());
  context.own(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
  const scene = createMesh("polycss-scene", plan.camera.sceneStyle);
  const system = createMesh("jupiter-system", plan.systemTransform);
  const body = createMesh("jupiter-body", plan.bodyTransform);
  const leaves = document.createDocumentFragment();
  for (const leaf of plan.leaves) {
    leaves.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(leaves);
  if (PREPARED_JUPITER_RINGS.schema !== "cssjupiter-prepared-rings@2") {
    throw new TypeError("Jupiter ring plan is incompatible.");
  }
  const rings = createMesh("jupiter-rings", "");
  const ringLeaves = document.createDocumentFragment();
  for (const leaf of PREPARED_JUPITER_RINGS.leaves) {
    const element = document.createElement("s");
    element.className = leaf.className;
    element.style.cssText = leaf.style;
    ringLeaves.appendChild(element);
  }
  rings.appendChild(ringLeaves);
  system.append(rings, body);
  const materialSystem = createMesh(
    "jupiter-material-system",
    PREPARED_JUPITER_CAMERA.materialDepthPresentation
      .materialSystemTransform,
  );
  const materialCounter = createMesh(
    "jupiter-fixed-material-counter",
    "",
  );
  const material = createMesh(
    "jupiter-material",
    PREPARED_JUPITER_CAMERA.materialDepthPresentation.materialMeshTransform,
  );
  const materialLeaf = document.createElement("s");
  materialLeaf.style.transform =
    PREPARED_JUPITER_CAMERA.materialDepthPresentation.leafTransform;
  material.appendChild(materialLeaf);
  materialCounter.appendChild(material);
  materialSystem.appendChild(materialCounter);
  scene.appendChild(materialSystem);
  scene.appendChild(system);
  camera.appendChild(scene);
  stage.replaceChildren(camera);
  const registration = registerBodyDependentLayers({ objectId: "jupiter", sceneElement: scene,
    bodySystem: system, lightingOverlays: [materialSystem] });
  const publishMaterialRoll = createPreparedPlanarRotationPublisher({ element: materialLeaf,
    width: PREPARED_JUPITER_LIGHTING.presentationFrameSize });
  for (const name of ["jupiter-hide-rings", "jupiter-hide-shadows"]) context.own(() => stage.classList.remove(name));
  let materialFrame = 0, lastMaterialPresentation = "", appliedFrame = null;
  return Object.freeze({
    cameraElement: camera, sceneElement: scene, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection }) {
      if (selection.lensId === PREPARED_JUPITER_LENSES.defaultLens) delete stage.dataset.lens;
      else stage.dataset.lens = selection.lensId;
      stage.classList.toggle("jupiter-hide-rings", !selection.rings);
      stage.classList.toggle("jupiter-hide-shadows", !selection.shadows);
    },
    publishFrame({ selection, view, resources }) {
      const counter = view.counterRotationFor(materialSystem.style.transform);
      if (materialCounter.style.transform !== counter) materialCounter.style.transform = counter;
      materialFrame = materialFrameFor(view);
      const prepared = selection.shadows ? preparedRowPresentation(PREPARED_JUPITER_LIGHTING, materialFrame, resources, "lighting:", "nearest-frame")
        : { ...PREPARED_JUPITER_LIGHTING.shadowless, url: resources.url("shadowless") };
      if (prepared) {
        const key = `${prepared.url}|${prepared.backgroundPosition}|${prepared.backgroundSize}`;
        if (key !== lastMaterialPresentation) {
          materialLeaf.style.backgroundImage = `url("${prepared.url}")`;
          materialLeaf.style.backgroundPosition = prepared.backgroundPosition;
          materialLeaf.style.backgroundSize = prepared.backgroundSize;
          lastMaterialPresentation = key;
        }
        appliedFrame = prepared.frameIndex ?? null;
      }
      const azimuth = direction => Math.atan2(direction[1], direction[0]) * 180 / Math.PI;
      publishMaterialRoll(selection.shadows
        ? normalizeDegrees(azimuth(view.sunViewDirection) - azimuth(view.reference.sunViewDirection)) : 0);
    },
    observe() {
      registration.assertRegistered();
      return { material: { materialFrame, appliedFrame }, camera: { materialFrame }, renderStats: { idleJavaScriptLoops: 0 } };
    },
  });
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}

function createMesh(className, style) {
  const element = document.createElement("div");
  element.className = className.startsWith("polycss-")
    ? className
    : `polycss-mesh ${className}`;
  if (style) element.style.cssText = style;
  return element;
}
