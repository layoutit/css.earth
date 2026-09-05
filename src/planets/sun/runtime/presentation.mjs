import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { canonicalPreparedAsset } from "../../../platform/prepared-object-assets.mjs";
import { validatePreparedCubicSky } from "../../../platform/cubic-sky-contract.mjs";
import { PREPARED_SUN_SCENE } from "./preparedScene.mjs";

export function createPresentation(stage, context) {
  const plan = PREPARED_SUN_SCENE;
  const document = stage.ownerDocument;
  if (plan.schema !== "csssun-prepared-runtime-scene@2" ||
      plan.runtimeGeometry !== false || plan.runtimeRasterization !== false) {
    throw new TypeError("Sun retained scene plan is incompatible.");
  }
  validatePreparedCubicSky(plan.starfield, { requireSun: false });
  if (plan.starfield.sun !== undefined ||
      plan.camera.cameraModel !== "accumulated-matrix3d" ||
      plan.camera.pitchBounded !== false || plan.camera.yawBounded !== false) {
    throw new TypeError("Sun self-luminous cubic-sky contract is incompatible.");
  }
  const camera = createMesh(
    "polycss-camera sun-camera planet-render-root",
    "perspective:1000000px",
  );
  context.own(() => camera.remove());
  context.own(() => {
    if (camera.parentNode === stage) delete stage.dataset.lens;
  });
  const scene = createMesh("polycss-scene", "");
  const system = createMesh(
    "sun-system",
    `transform:rotateY(${-plan.body.axialTiltDegrees}deg)`,
  );
  const body = createMesh("sun-body", "");
  const fragment = document.createDocumentFragment();
  for (const leaf of plan.body.leaves) {
    fragment.appendChild(createPreparedProjectiveTextureLeaf(leaf));
  }
  body.appendChild(fragment);
  system.appendChild(body);
  scene.appendChild(system);
  camera.appendChild(scene);
  stage.replaceChildren(camera);

  const corona = document.createElement("div");
  context.own(() => corona.remove());
  corona.className = "sun-corona-layer planet-render-root";
  corona.ariaHidden = "true";
  corona.style.setProperty(
    "--sun-corona-image",
    cssUrl(canonicalPreparedAsset(
      plan.offLimbContext.defaultUrl,
      plan.offLimbContext.defaultUrl2x,
    )),
  );
  corona.style.setProperty(
    "--sun-camera-zoom",
    String(plan.camera.defaultZoom),
  );
  stage.appendChild(corona);

  const limb = document.createElement("div");
  context.own(() => limb.remove());
  limb.className = "sun-limb-layer planet-render-root";
  limb.ariaHidden = "true";
  limb.style.setProperty(
    "--sun-limb-image",
    cssUrl(canonicalPreparedAsset(
      plan.limbMaterial.defaultUrl,
      plan.limbMaterial.defaultUrl2x,
    )),
  );
  limb.style.setProperty(
    "--sun-camera-zoom",
    String(plan.camera.defaultZoom),
  );
  stage.appendChild(limb);
  return Object.freeze({
    cameraElement: camera, sceneElement: scene,
    bodyLayers: Object.freeze([registerBodyDependentLayers({ objectId: "sun",
      sceneElement: scene, bodySystem: body, lightingOverlays: [corona, limb] })]),
    commitSelection({ selection, resources }) {
      body.style.setProperty("--sun-surface-image", cssUrl(resources.url(`surface:${selection.lensId}`)));
      body.style.setProperty("--sun-poles-image", cssUrl(resources.url(`poles:${selection.lensId}`)));
      corona.style.setProperty("--sun-corona-image", cssUrl(resources.url(`corona:${selection.lensId}`)));
      limb.style.setProperty("--sun-limb-image", cssUrl(resources.url(`limb:${selection.lensId}`)));
      stage.dataset.lens = selection.lensId;
    },
    publishFrame({ view }) {
      corona.style.setProperty("--sun-camera-zoom", String(view.zoom));
      limb.style.setProperty("--sun-camera-zoom", String(view.zoom));
    },
    observe() {
      return { dom: { mode: "source-backed-global-material-on-visible-retained-projective-solar-leaves",
        retainedCameraRootCount: 1, retainedOffLimbContextRootCount: 1,
        retainedLimbMaterialRootCount: 1, retainedSkyboxRootCount: 1, retainedSunCubemapBakeCount: 0 } };
    },
  });
}

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  mesh.style.cssText = style;
  return mesh;
}
const cssUrl = url => `url(${JSON.stringify(url)})`;
