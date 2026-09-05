import { createPolyCamera, createPolyScene } from "@layoutit/polycss";
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
  const camera = createPolyCamera(plan.camera.state);
  const scene = createPolyScene(stage, { camera });
  context.own(() => scene.destroy());
  context.own(() => {
    if (scene.cameraEl.parentNode === stage) delete stage.dataset.lens;
  });
  scene.cameraEl.classList.add("planet-render-root");
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
  scene.sceneElement.appendChild(system);

  const materialComposite = document.createElement("div");
  context.own(() => materialComposite.remove());
  materialComposite.className = "venus-material-composite planet-render-root";
  materialComposite.ariaHidden = "true";
  materialComposite.style.setProperty("--venus-camera-zoom", String(camera.state.zoom));
  const material = document.createElement("s");
  material.className = "venus-fixed-material";
  material.style.backgroundSize = plan.material.backgroundSize;
  material.style.backgroundPosition =
    plan.material.backgroundPositions[plan.material.defaultFrame];
  materialComposite.appendChild(material);
  stage.appendChild(materialComposite);
  const registration = registerBodyDependentLayers({ objectId: "venus",
    sceneElement: scene.sceneElement, bodySystem: system, lightingOverlays: [material] });
  let materialFrame = plan.material.defaultFrame, materialLightRollDegrees = 0;
  let sunViewDirection = viewSunDirectionToPreparedLightDirection(PREPARED_VENUS_SKY_SUN.referenceViewDirection);
  let shadowsEnabled = false;
  for (const name of ["venus-hide-atmosphere", "venus-hide-stars"]) context.own(() => stage.classList.remove(name));
  return Object.freeze({
    cameraElement: scene.cameraEl, sceneElement: scene.sceneElement,
    bodyLayers: Object.freeze([registration]),
    commitSelection({ selection }) {
      stage.dataset.lens = selection.lensId;
      delete stage.dataset.view;
      stage.classList.toggle("venus-hide-atmosphere", !selection.atmosphere);
      stage.classList.toggle("venus-hide-stars", !selection.stars);
    },
    publishFrame({ selection, view: state }) {
      camera.update({ rotX: preparedScenePitch(state.controlPitch, plan.camera), rotY: state.controlYaw, zoom: state.zoom });
      scene.cameraEl.dataset.polycssCameraRotX = String(camera.state.rotX);
      scene.cameraEl.dataset.polycssCameraRotY = String(camera.state.rotY);
      scene.cameraEl.dataset.polycssCameraZoom = String(state.zoom);
      scene.cameraEl.dataset.venusCameraMatrix = state.sceneMatrix;
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
