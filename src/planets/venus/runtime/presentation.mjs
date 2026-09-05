import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { preparedScenePitch } from "../../../platform/cubic-sky-runtime.mjs";
import { validatePreparedCubicSky } from "../../../platform/cubic-sky-contract.mjs";
import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { PREPARED_VENUS_SCENE } from "./preparedScene.mjs";
import { PREPARED_VENUS_SKY_SUN } from "./preparedSkySun.mjs";

export function createPresentation(stage, context) {
  const plan = PREPARED_VENUS_SCENE;
  const document = stage.ownerDocument;
  if (plan.schema !== "cssvenus-prepared-runtime-scene@1" ||
      plan.runtimeGeometry !== false || plan.runtimeRasterization !== false) {
    throw new TypeError("Venus retained scene plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  const cameraElement = document.createElement("div");
  const sceneElement = document.createElement("div");
  context.own(() => cameraElement.remove());
  cameraElement.className = "polycss-camera planet-render-root";
  cameraElement.style.cssText = plan.camera.style;
  sceneElement.className = "polycss-scene";
  sceneElement.ariaHidden = "true";
  sceneElement.dataset.polycssLighting = "baked";
  sceneElement.style.cssText = plan.camera.sceneStyle;
  cameraElement.appendChild(sceneElement);
  stage.appendChild(cameraElement);
  context.own(() => {
    if (cameraElement.parentNode === stage) delete stage.dataset.lens;
  });
  const system = createMesh(
    "venus-system",
    `transform:rotateY(${-plan.body.axialTiltDegrees}deg)`,
  );
  const body = createMesh("venus-body", "");
  const fragment = document.createDocumentFragment();
  for (const leaf of plan.body.leaves) {
    fragment.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(fragment);
  system.appendChild(body);
  sceneElement.appendChild(system);

  const materialComposite = document.createElement("div");
  context.own(() => materialComposite.remove());
  materialComposite.className = "venus-material-composite planet-render-root";
  materialComposite.ariaHidden = "true";
  materialComposite.style.setProperty("--venus-camera-zoom", String(plan.camera.defaultZoom));
  const material = document.createElement("s");
  material.className = "venus-fixed-material";
  material.style.backgroundSize = plan.material.backgroundSize;
  material.style.backgroundPosition =
    plan.material.backgroundPositions[plan.material.defaultFrame];
  materialComposite.appendChild(material);
  stage.appendChild(materialComposite);
  const registration = registerBodyDependentLayers({ objectId: "venus",
    sceneElement: sceneElement, bodySystem: system, lightingOverlays: [material] });
  let materialFrame = plan.material.defaultFrame, materialLightRollDegrees = 0;
  let sunViewDirection = viewSunDirectionToPreparedLightDirection(PREPARED_VENUS_SKY_SUN.referenceViewDirection);
  let shadowsEnabled = false;
  for (const name of ["venus-hide-atmosphere", "venus-hide-stars"]) context.own(() => stage.classList.remove(name));
  return Object.freeze({
    cameraElement: cameraElement, sceneElement: sceneElement,
    bodyLayers: Object.freeze([registration]),
    commitSelection({ selection }) {
      stage.dataset.lens = selection.lensId;
      delete stage.dataset.view;
      stage.classList.toggle("venus-hide-atmosphere", !selection.atmosphere);
      stage.classList.toggle("venus-hide-stars", !selection.stars);
    },
    publishFrame({ selection, view: state }) {
      cameraElement.dataset.polycssCameraRotX = String(Math.round(preparedScenePitch(state.controlPitch, plan.camera) * 100) / 100);
      cameraElement.dataset.polycssCameraRotY = String(state.controlYaw);
      cameraElement.dataset.polycssCameraZoom = String(state.zoom);
      cameraElement.dataset.venusCameraMatrix = state.sceneMatrix;
      materialComposite.style.setProperty("--venus-camera-zoom", String(state.zoom));
      sunViewDirection = state.sunViewDirection;
      shadowsEnabled = selection.shadows;
      const frame = shadowsEnabled ? preparedMaterialFrame(presentationLightViewZ(sunViewDirection[2], plan.material), plan.material)
        : plan.material.frameCount - 1;
      if (frame !== materialFrame) {
        const position = plan.material.backgroundPositions[frame];
        if (typeof position !== "string") throw new RangeError(`Venus prepared material frame is invalid: ${frame}.`);
        material.style.backgroundPosition = position;
        materialFrame = frame;
      }
      if (!shadowsEnabled) {
        material.style.setProperty("--venus-light-roll", "0deg");
        materialLightRollDegrees = 0;
      } else if (Math.hypot(sunViewDirection[0], sunViewDirection[1]) >= 1e-9) {
        const roll = normalizeDegrees(Math.atan2(sunViewDirection[1], sunViewDirection[0]) * 180 / Math.PI - plan.material.baseLightAzimuthDegrees);
        if (Math.abs(roll - materialLightRollDegrees) >= 1e-9) {
          material.style.setProperty("--venus-light-roll", `${roll}deg`);
          materialLightRollDegrees = roll;
        }
      }
    },
    observe() {
      registration.assertRegistered();
      return { material: { frame: materialFrame, lightRollDegrees: materialLightRollDegrees, sunViewDirection, shadowsEnabled },
        dom: { mode: "prepared-retained-texture-leaves-with-fixed-material-and-sky-cube",
          retainedCameraRootCount: 1, retainedMaterialCompositeRootCount: 1, retainedCameraMaterialCount: 0,
          retainedSkyboxRootCount: 1, retainedSunBillboardCount: 1, retainedSunLayerCount: 1,
          retainedSunCubemapBakeCount: 0, retainedSceneRootCount: 1 } };
    },
  });
}

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  mesh.style.cssText = style;
  return mesh;
}

function preparedMaterialFrame(lightViewZ, material) {
  const amount = clamp(
    (lightViewZ - material.minimumLightViewZ) /
      (material.maximumLightViewZ - material.minimumLightViewZ),
    0,
    1,
  );
  return Math.round(amount * (material.directionalFrameCount - 1));
}

function presentationLightViewZ(lightViewZ, material) {
  const remap = material.lightingModel.presentationPhaseRemap;
  const [lowerStart, lowerEnd] = remap.lowerTransition;
  const [plateauStart, plateauEnd] = remap.plateau;
  const [upperStart, upperEnd] = remap.upperTransition;
  if (lightViewZ <= lowerStart || lightViewZ >= upperEnd) return lightViewZ;
  if (lightViewZ < lowerEnd) {
    const amount = (lightViewZ - lowerStart) / (lowerEnd - lowerStart);
    return lightViewZ * (1 - amount) + remap.plateauViewZ * amount;
  }
  if (lightViewZ <= plateauEnd && lightViewZ >= plateauStart) {
    return remap.plateauViewZ;
  }
  const amount = (lightViewZ - upperStart) / (upperEnd - upperStart);
  return remap.plateauViewZ * (1 - amount) + lightViewZ * amount;
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}


function clamp(value, minimum, maximum) { return Math.max(minimum, Math.min(maximum, value)); }
