import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { createPreparedPlanarRotationPublisher } from "../../../platform/prepared-planar-rotation.mjs";
import { canonicalPreparedAsset as canonicalPreparedUrl } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_EARTH_SCENE } from "./preparedScene.mjs";
import { PREPARED_EARTH_LENSES } from "./preparedLenses.mjs";
import { publishEarthSurfacePages, requireEarthSurfacePages } from "./surface-pages.mjs";
import { pageKeys, materialState } from "./material.mjs";
import { PREPARED_EARTH_CITY_PAGES } from "./preparedCityPages.mjs";
import { PREPARED_EARTH_NOISE } from "./preparedNoise.mjs";
export function createPresentation(stage, context) {
  const plan = PREPARED_EARTH_SCENE;
  if (plan.schema !== "cssearth-prepared-retained-scene@6" ||
      plan.interior?.schema !== "cssearth-prepared-cutaway@2") {
    throw new TypeError("Earth retained scene plan is incompatible.");
  }
  const camera = document.createElement("div");
  context.own(() => camera.remove());
  context.own(() => {
    if (camera.parentNode !== stage) return;
    delete stage.dataset.lens;
      stage.classList.remove("earth-hide-atmosphere");
  });
  camera.className = "polycss-camera planet-render-root";
  camera.style.cssText = plan.camera.style;
  const scene = document.createElement("div");
  scene.className = "polycss-scene";
  scene.style.cssText = plan.camera.sceneStyle;
  camera.appendChild(scene);
  const system = createMesh("earth-system", plan.earth.systemTransform);
  scene.appendChild(system);

  const bodyCarriers = mountPreparedSphereBands({
    system,
    bands: plan.body.bands,
    meshTransform: plan.earth.meshTransform,
    className: "earth-body",
    polarClassName: "earth-body-polar",
    textureUrls: Object.freeze({
      surface: requireEarthSurfacePages(plan.body.assets.surface.urls),
      poles: canonicalPreparedUrl(plan.body.assets.poles),
    }),
    surfacePageCount: plan.body.assets.surface.urls.length,
  });

  const presentation = plan.interior.presentationLock;
  if (presentation?.schema !==
        "cssearth-prepared-interior-presentation-lock@1" ||
      typeof presentation.transform !== "string") {
    throw new Error("Earth prepared interior presentation is incompatible.");
  }
  const interiorMount = createPreparedInterior(plan);
  const cutaway = interiorMount.root;
  let cutawayCounter = createMesh("earth-cutaway-counter", "");
  const presentationRoot = createMesh(
    "earth-cutaway-presentation",
    presentation.transform,
  );
  const cutawaySystem = createMesh(
    "earth-system earth-cutaway-system",
    plan.earth.systemTransform,
  );
  cutawaySystem.appendChild(cutaway);
  presentationRoot.appendChild(cutawaySystem);
  cutawayCounter.appendChild(presentationRoot);
  scene.appendChild(cutawayCounter);

  const materialSystem = createMesh("earth-system", plan.earth.systemTransform);
  const materialMesh = createMesh("earth-material", plan.material.transform);
  const lightingLeaf = createTextureLeaf(plan.material.lighting.leaf);
  const atmosphereLeaf = createTextureLeaf(plan.material.atmosphere.leaf);
  applyPreparedDefaultMaterial(plan.material.lighting, lightingLeaf);
  applyPreparedDefaultMaterial(plan.material.atmosphere, atmosphereLeaf);
  materialMesh.append(lightingLeaf, atmosphereLeaf);
  materialSystem.appendChild(materialMesh);
  const materialCounter = createMesh("earth-material-counter", "");
  materialCounter.appendChild(materialSystem);
  scene.appendChild(materialCounter);

  stage.replaceChildren(camera);
  const registration = registerBodyDependentLayers({ objectId: "earth", sceneElement: scene,
    bodySystem: system, lightingOverlays: [materialCounter] });
  const publishers = Object.fromEntries([["lighting", lightingLeaf], ["atmosphere", atmosphereLeaf]].map(([id, leaf]) =>
    [id, createPreparedPlanarRotationPublisher({ element: leaf, width: plan.material[id].presentationTileSize })]));
  let materialAddressWrites = 0, materialFrame = null;
  const applied = { lighting: null, atmosphere: null };
  return Object.freeze({ cameraElement: camera, sceneElement: scene, bodyLayers: Object.freeze([registration]),
    motionFrame: Object.freeze([system, bodyCarriers.surface[0]]),
    pageLayers: Object.freeze([
      { id: "city", plan: PREPARED_EARTH_CITY_PAGES, lensIds: ["normal", "buenos-aires-noise"] },
      { id: "noise", plan: PREPARED_EARTH_NOISE, lensIds: ["buenos-aires-noise"] },
    ].map(layer => Object.freeze({ ...layer, carrier: bodyCarriers.surface[0], system,
      className: "earth-city-page", textureClassName: "earth-api-texture" }))),
    commitSelection({ selection, resources }) {
      const lens = PREPARED_EARTH_LENSES.controls.find(lens => lens.id === selection.lensId);
      const urls = pageKeys(lens.id).map(key => resources.url(key));
      if (lens.view === "interior") {
        publishEarthSurfacePages(interiorMount.carriers.surface, urls, plan.interior.outerAssets.surface.twoUrls.length);
        publishEarthSurfacePages(bodyCarriers.surface, [], plan.body.assets.surface.urls.length);
        stage.dataset.view = "interior"; delete stage.dataset.lens;
      } else {
        publishEarthSurfacePages(bodyCarriers.surface, urls, plan.body.assets.surface.urls.length);
        for (const carrier of bodyCarriers.polar) carrier.style.setProperty("--earth-poles-texture", `url("${resources.url(`poles:${lens.id}`)}")`);
        publishEarthSurfacePages(interiorMount.carriers.surface, [], plan.interior.outerAssets.surface.twoUrls.length);
        delete stage.dataset.view; stage.dataset.lens = lens.id;
      }
      stage.classList.toggle("earth-hide-atmosphere", !selection.atmosphere);
    },
    publishFrame({ selection, view, resources }) {
      materialCounter.style.transform = view.counterRotation;
      cutawayCounter.style.transform = view.counterRotation;
      const state = materialState(selection, view); materialFrame = state.frame;
      for (const [id, leaf] of [["lighting", lightingLeaf], ["atmosphere", atmosphereLeaf]]) {
        const item = state[id], material = plan.material[id];
        const frame = item.mode === "shadowless" ? material.shadowlessPresentation
          : item.mode === "default" ? material.defaultPresentation : material.frames[state.frame];
        const url = item.enabled || item.mode !== "directional" ? resources.url(item.key) : null;
        if (url && (item.enabled || item.mode !== "directional")) {
          for (const [property, value] of [["backgroundImage", `url("${url}")`], ["backgroundPosition", frame.backgroundPosition], ["backgroundSize", frame.backgroundSize]]) {
            if (leaf.style[property] !== value) { leaf.style[property] = value; materialAddressWrites++; }
          }
          leaf.dataset.materialFrame = item.mode === "directional" ? String(state.frame) : item.mode;
          applied[id] = leaf.dataset.materialFrame;
        }
        const azimuth = direction => Math.atan2(direction[1], direction[0]) * 180 / Math.PI;
        publishers[id](id === "lighting" && !selection.shadows ? 0 : normalizeDegrees(azimuth(view.sunViewDirection) - azimuth(view.reference.sunViewDirection)));
      }
    },
    observe() {
      registration.assertRegistered();
      return { material: { materialFrame, ...applied, materialAddressWrites }, camera: { materialAddressWrites },
        dom: { interiorMounted: true, interiorLeafCount: cutaway.querySelectorAll("b, s, u").length } };
    },
  });
}
function createPreparedInterior(plan) {
  const cutaway = createMesh("earth-cutaway", "");
  const carriers = mountPreparedSphereBands({
    system: cutaway,
    bands: plan.interior.outerBodyBands,
    meshTransform: plan.earth.meshTransform,
    className: "earth-cutaway-body",
    polarClassName: "earth-cutaway-body-polar",
    polarLeafClassMarker: "earth-interior-outer-polar",
    textureUrls: Object.freeze({
      // Retain the cutaway nodes without referencing its large hidden atlas.
      surface: [],
      poles: canonicalPreparedUrl(plan.interior.outerAssets.poles),
    }),
    surfacePageCount: plan.interior.outerAssets.surface.twoUrls.length,
  });
  for (const shell of plan.interior.shells) {
    const shellMesh = createMesh(
      `earth-interior-shell ${shell.className}`,
      plan.earth.meshTransform,
    );
    const fragment = document.createDocumentFragment();
    for (const leaf of shell.leaves) {
      const element = createTextureLeaf(leaf);
      element.style.backgroundImage =
        `url("${canonicalPreparedUrl(leaf.asset)}")`;
      fragment.appendChild(element);
    }
    shellMesh.appendChild(fragment);
    cutaway.appendChild(shellMesh);
  }
  const sections = createMesh(
    "earth-interior-sections",
    plan.earth.meshTransform,
  );
  const sectionFragment = document.createDocumentFragment();
  for (const leaf of plan.interior.sectionLeaves) {
    const element = createTextureLeaf(leaf);
    element.style.backgroundImage =
      `url("${canonicalPreparedUrl(leaf.asset)}")`;
    if (leaf.backfaceVisible) element.style.backfaceVisibility = "visible";
    sectionFragment.appendChild(element);
  }
  sections.appendChild(sectionFragment);
  cutaway.appendChild(sections);
  return Object.freeze({ root: cutaway, carriers });
}

function mountPreparedSphereBands({
  system,
  bands,
  meshTransform,
  className,
  polarClassName,
  polarLeafClassMarker = "earth-polar",
  textureUrls,
  surfacePageCount,
}) {
  const carriers = new Map();
  const surface = [];
  const polarCarriers = [];
  for (const band of bands) {
    if (band.leaves.length === 0) continue;
    const polar = band.leaves.some(({ className: leafClassName }) =>
      leafClassName?.includes(polarLeafClassMarker));
    const key = `${polar ? "polar" : "body"}:${band.visualRotationSeconds}`;
    let carrier = carriers.get(key);
    if (!carrier) {
      carrier = createMesh(
        polar ? `${className} ${polarClassName}` : className,
        `${meshTransform};animation-duration:${band.visualRotationSeconds}s`,
      );
      carriers.set(key, carrier);
      if (polar) polarCarriers.push(carrier);
      else surface.push(carrier);
      system.appendChild(carrier);
      if (polar) {
        carrier.style.setProperty("--earth-poles-texture", `url("${textureUrls.poles}")`);
      } else {
        publishEarthSurfacePages([carrier], textureUrls.surface, surfacePageCount);
      }
    }
    const fragment = document.createDocumentFragment();
    for (const leaf of band.leaves) fragment.appendChild(createTextureLeaf(leaf));
    carrier.appendChild(fragment);
  }
  return Object.freeze({
    surface: Object.freeze(surface),
    polar: Object.freeze(polarCarriers),
    all: Object.freeze([...surface, ...polarCarriers]),
  });
}

function createTextureLeaf(prepared) {
  return createPreparedProjectiveTextureLeaf(prepared);
}

function applyPreparedDefaultMaterial(plan, leaf) {
  const frame = plan.defaultPresentation;
  let writes = 0;
  writes += setStyle(leaf, "transform", frame.transform);
  const assetUrl = canonicalPreparedUrl(frame.assets);
  writes += setStyle(leaf, "backgroundImage", `url("${assetUrl}")`);
  writes += setStyle(leaf, "backgroundPosition", frame.backgroundPosition);
  writes += setStyle(leaf, "backgroundSize", frame.backgroundSize);
  leaf.dataset.materialFrame = "default";
  return writes;
}

function createMesh(className, style) {
  const element = document.createElement("div");
  element.className = className.includes("polycss-mesh")
    ? className
    : `polycss-mesh ${className}`;
  if (style) element.style.cssText = style;
  return element;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeDegrees(degrees) {
  return (degrees % 360 + 540) % 360 - 180;
}

function setStyle(element, property, value) {
  if (element.style[property] === value) return 0;
  element.style[property] = value; return 1;
}
