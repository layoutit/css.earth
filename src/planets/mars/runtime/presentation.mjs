import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { validatePreparedCubicSky } from "../../../platform/cubic-sky-contract.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import { preparedRowPresentation } from "../../../platform/prepared-row-presentation.mjs";
import { PREPARED_MARS_SCENE } from "./preparedScene.mjs";
import { PREPARED_MARS_CAMERA } from "./preparedCamera.mjs";
import { PREPARED_MARS_LIGHTING } from "./preparedLighting.mjs";
import { PREPARED_MARS_LENSES } from "./preparedLenses.mjs";
import { materialBank, materialFrameFor } from "./material.mjs";

export function createPresentation(stage, context) {
  const plan = PREPARED_MARS_SCENE;
  const document = stage.ownerDocument;
  stage.classList.add("mars-stage");
  context.own(() => stage.classList.remove("mars-stage"));
  if (plan.schema !== "cssmars-prepared-retained-body@1") {
    throw new TypeError("Mars retained body plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  if (plan.starfield.cameraContract !==
      "google-earth-pro-inverse-unbounded-matrix3d") {
    throw new TypeError("Mars cubic-sky camera binding is incompatible.");
  }
  const camera = createMesh(
    "polycss-camera mars-camera planet-render-root",
    "perspective:1000000px",
  );
  context.own(() => camera.remove());
  context.own(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
  const scene = createMesh("polycss-scene", "");
  const system = createMesh("mars-system", plan.systemTransform);
  const body = createMesh("mars-body", plan.bodyTransform);
  const leaves = document.createDocumentFragment();
  for (const leaf of plan.leaves) {
    leaves.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(leaves);
  system.appendChild(body);
  scene.appendChild(system);
  const materialCounter = createMesh("mars-material-counter", "");
  const materialSystem = createMesh(
    "mars-system mars-material-system",
    plan.systemTransform,
  );
  const material = document.createElement("div");
  material.className = "polycss-mesh mars-material";
  material.style.cssText = plan.bodyTransform;
  const materialPlane = createMesh(
    "mars-material-plane",
    `transform:${PREPARED_MARS_CAMERA.materialDepthContract.planeTransform}`,
  );
  const materialLeaf = document.createElement("s");
  materialPlane.appendChild(materialLeaf);
  material.appendChild(materialPlane);
  materialSystem.appendChild(material);
  materialCounter.appendChild(materialSystem);
  scene.appendChild(materialCounter);
  camera.appendChild(scene);
  stage.replaceChildren(camera);
  const registration = registerBodyDependentLayers({ objectId: "mars", sceneElement: scene,
    bodySystem: system, lightingOverlays: [materialCounter] });
  let materialFrame = PREPARED_MARS_LIGHTING.defaultFrame, materialLightRollDegrees = 0;
  let sunViewDirection = null, shadowsEnabled = false, appliedFrame = null, appliedRow = null, lastMaterialPresentation = "";
  return Object.freeze({
    cameraElement: camera, sceneElement: scene, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection }) {
      if (selection.lensId === PREPARED_MARS_LENSES.defaultLens) delete stage.dataset.lens;
      else stage.dataset.lens = selection.lensId;
    },
    publishFrame({ selection, view, resources }) {
      sunViewDirection = view.skySunViewDirection;
      shadowsEnabled = selection.shadows;
      materialCounter.style.transform = view.counterRotation;
      materialFrame = materialFrameFor(selection, view);
      const presentation = preparedRowPresentation(materialBank, materialFrame, resources, "lighting:");
      if (presentation) {
        const key = `${presentation.url}|${presentation.backgroundPosition}|${presentation.backgroundSize}`;
        if (key !== lastMaterialPresentation) {
          materialLeaf.style.backgroundImage = `url("${presentation.url}")`;
          materialLeaf.style.backgroundPosition = presentation.backgroundPosition;
          materialLeaf.style.backgroundSize = presentation.backgroundSize;
          lastMaterialPresentation = key;
        }
        appliedFrame = presentation.frameIndex;
        appliedRow = presentation.rowIndex;
      }
      const direction = viewSunDirectionToPreparedLightDirection(sunViewDirection);
      materialLightRollDegrees = !shadowsEnabled || Math.hypot(direction[0], direction[1]) < 1e-9 ? 0
        : normalizeDegrees(Math.atan2(direction[1], direction[0]) * 180 / Math.PI - PREPARED_MARS_LIGHTING.baseLightAzimuthDegrees);
      materialLeaf.style.rotate = `${materialLightRollDegrees}deg`;
    },
    observe() {
      registration.assertRegistered();
      const state = { materialFrame, materialLightRollDegrees, sunViewDirection, shadowsEnabled,
        materialMode: shadowsEnabled ? "directional-terminator-and-atmosphere" : "full-phase-atmosphere" };
      return { material: { ...state, appliedFrame, appliedRow }, sky: state,
        dom: { retainedSunBillboardCount: 1, retainedSunCubemapBakeCount: 0 },
        renderStats: { idleJavaScriptLoops: 0 } };
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
