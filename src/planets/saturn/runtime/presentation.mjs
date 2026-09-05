import { PREPARED_SATURN_RUNTIME_SCENE as PREPARED_SATURN_SCENE } from "./preparedSceneRuntime.mjs";
import { PREPARED_SATURN_LEAF_LAYOUTS } from "./leaf-layouts.mjs";
import { PREPARED_SATURN_LENSES } from "./preparedLenses.mjs";
import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { createEllipsoidMaterialPublisher } from "./ellipsoid-material.mjs";
import { materialState, exteriorAtlas, interiorAtlas } from "./material.mjs";
export function createPresentation(stage, context) {
  const plan = PREPARED_SATURN_SCENE;
  if (plan.schema !== "csssaturn-prepared-runtime-scene@1" ||
      plan.interior?.schema !== "csssaturn-prepared-cutaway@1") {
    throw new TypeError("Saturn retained scene plan is incompatible.");
  }
  const camera = document.createElement("div");
  context.own(() => camera.remove());
  context.own(() => { if (camera.parentNode === stage) { delete stage.dataset.lens; delete stage.dataset.view; } });
  camera.className = "polycss-camera planet-render-root";
  camera.style.cssText = plan.camera.style;
  const scene = document.createElement("div");
  scene.className = "polycss-scene";
  scene.ariaHidden = "true";
  scene.style.cssText = plan.camera.sceneStyle;
  camera.appendChild(scene);

  const system = createMesh(
    "saturn-system",
    plan.systemTransform,
  );
  scene.appendChild(system);

  const ringMesh = createMesh(
    "saturn-ring-orbit saturn-ring-plane",
    plan.meshTransform,
  );
  const ringLeaf = createTextureLeaf(plan.ringPlane);
  ringMesh.appendChild(ringLeaf);
  system.appendChild(ringMesh);

  const ringMotionMeshes = new Map();
  for (const plate of plan.ringMotionPlates) {
    const classes = ["saturn-ring-orbit"];
    if (plate.compositeMode === "flat") classes.push("saturn-ring-flat");
    const mesh = createMesh(
      classes.join(" "),
      `${plan.meshTransform};animation-duration:${plate.durationSeconds}s`,
    );
    const leaf = createTextureLeaf(plate.leaf);
    mesh.appendChild(leaf);
    system.appendChild(mesh);
    ringMotionMeshes.set(plate.population, mesh);
  }

  const ringShadowMesh = createMesh(
    "saturn-ring-shadow",
    plan.meshTransform,
  );
  const ringShadowLeaf = createTextureLeaf(plan.ringShadowPlane);
  ringShadowMesh.appendChild(ringShadowLeaf);
  system.appendChild(ringShadowMesh);

  for (const group of plan.ringPointGroups) {
    const classes = [`saturn-ring-${group.pointMode}`];
    if (group.animated) classes.unshift("saturn-ring-orbit");
    if (group.compositeMode === "flat") classes.push("saturn-ring-flat");
    const mesh = createMesh(
      classes.join(" "),
      group.animated
        ? `${plan.meshTransform};animation-duration:${group.durationSeconds}s`
        : plan.meshTransform,
    );
    const leaves = document.createDocumentFragment();
    for (const leaf of group.leaves) {
      const point = document.createElement("b");
      point.style.cssText = leaf.style;
      leaves.appendChild(point);
    }
    mesh.appendChild(leaves);
    system.appendChild(mesh);
  }

  const bodyBandCarriers = new Map();
  for (const band of plan.bodyBands) {
    const polar = band.leaves.some(({ className }) =>
      className?.includes("saturn-polar"));
    const carrierKey = `${polar ? "polar" : "body"}:` +
      band.visualRotationSeconds;
    let carrier = bodyBandCarriers.get(carrierKey);
    if (!carrier) {
      const element = createMesh(
        polar
          ? "saturn-body saturn-body-polar"
          : "saturn-body",
        `${plan.meshTransform};animation-duration:${band.visualRotationSeconds}s`,
      );
      carrier = Object.freeze({
        element,
        durationSeconds: band.visualRotationSeconds,
      });
      bodyBandCarriers.set(carrierKey, carrier);
      system.appendChild(element);
    }
    const bodyLeaves = document.createDocumentFragment();
    for (const leaf of band.leaves) {
      const element = leaf.tag === "s"
        ? createTextureLeaf(leaf)
        : document.createElement(leaf.tag);
      if (leaf.tag !== "s") element.style.cssText = leaf.style;
      bodyLeaves.appendChild(element);
    }
    carrier.element.appendChild(bodyLeaves);
  }
  const bodyBands = Object.freeze([...bodyBandCarriers.values()]);
  const cutaway = createPreparedInterior(plan);
  system.appendChild(cutaway);
  const fixedMaterialMesh = createMesh(
    "saturn-fixed-material",
    plan.fixedMaterialPlane.transform,
  );
  const fixedMaterialCounter = createMesh(
    "saturn-fixed-material-counter",
    "",
  );
  const fixedMaterialLeaf = createTextureLeaf(plan.fixedMaterialPlane.leaf);
  fixedMaterialLeaf.classList.add("saturn-exterior-material");
  const interiorAtmosphereLeaf = createTextureLeaf(
    plan.interior.atmosphere.leaf,
  );
  interiorAtmosphereLeaf.style.backgroundImage = "none";
  interiorAtmosphereLeaf.classList.add("saturn-interior-material");
  fixedMaterialMesh.append(fixedMaterialLeaf, interiorAtmosphereLeaf);
  const materialSystem = createMesh(
    "saturn-system",
    plan.systemTransform,
  );
  fixedMaterialCounter.appendChild(fixedMaterialMesh);
  materialSystem.appendChild(fixedMaterialCounter);
  scene.appendChild(materialSystem);

  stage.replaceChildren(camera);
  const registration = registerBodyDependentLayers({ objectId: "saturn", sceneElement: scene,
    bodySystem: system, lightingOverlays: [materialSystem] });
  const publishers = [fixedMaterialLeaf, interiorAtmosphereLeaf].map(element => createEllipsoidMaterialPublisher({
    element, bodySystem: system, bodyMesh: bodyBands[0].element, materialSystem,
    materialCounter: fixedMaterialCounter, materialMesh: fixedMaterialMesh,
    projection: plan.fixedMaterialPlane.interactionProjection, width: 1024,
  }));
  for (const name of ["saturn-hide-rings", "saturn-hide-shadows"]) context.own(() => stage.classList.remove(name));
  let materialFrame = 0, transformWrites = 0, materialAddressWrites = 0, interiorAddressWrites = 0;
  return Object.freeze({ cameraElement: camera, sceneElement: scene, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection }) {
      if (selection.interior) stage.dataset.view = "interior"; else { delete stage.dataset.view; interiorAtmosphereLeaf.style.backgroundImage = "none"; }
      if (selection.lensId === PREPARED_SATURN_LENSES.defaultLens) delete stage.dataset.lens; else stage.dataset.lens = selection.lensId;
      stage.classList.toggle("saturn-hide-rings", !selection.rings);
      stage.classList.toggle("saturn-hide-shadows", !selection.shadows);
    },
    publishFrame({ selection, view, resources }) {
      const localCounter = view.counterRotationFor(materialSystem.style.transform);
      if (fixedMaterialCounter.style.transform !== localCounter) { fixedMaterialCounter.style.transform = localCounter; transformWrites++; }
      const state = materialState(selection, view); materialFrame = state.materialFrame;
      const exterior = exteriorAtlas.variants[state.variantId];
      materialAddressWrites += publishAtlas(fixedMaterialLeaf, state.useDefault ? exterior.defaultPresentation : exterior.presentations[state.materialFrame], resources.url(`exterior:${state.variantId}`));
      const azimuth = direction => Math.atan2(direction[1], direction[0]) * 180 / Math.PI;
      const degrees = normalizeDegrees(azimuth(view.sunViewDirection) - azimuth(view.reference.sunViewDirection));
      const pose = { degrees, sceneMatrix: view.sceneMatrix, preserveApprovedDefault: state.useDefault };
      transformWrites += Number(publishers[0](pose));
      if (selection.interior) {
        const interior = interiorAtlas.variants[state.variantId];
        interiorAddressWrites += publishAtlas(interiorAtmosphereLeaf, state.useDefault ? interior.defaultPresentation : interior.presentations[state.interiorFrame], resources.url(`interior-material:${state.variantId}`));
        transformWrites += Number(publishers[1](pose));
      }
    },
    observe() {
      registration.assertRegistered();
      return { material: { materialFrame, materialAddressWrites, interiorAddressWrites },
        camera: { materialFrame, transformWrites, materialAddressWrites, interiorAddressWrites },
        dom: { interiorMounted: true, interiorLeafCount: cutaway.querySelectorAll("b, s, u").length } };
    },
  });
}
function publishAtlas(leaf, prepared, url) {
  if (!url) return 0;
  let writes = 0;
  for (const [property, value] of [["backgroundImage", `url("${url}")`], ["backgroundPosition", prepared.backgroundPosition], ["backgroundSize", prepared.backgroundSize]]) {
    if (leaf.style[property] !== value) { leaf.style[property] = value; writes++; }
  }
  return writes;
}
function normalizeDegrees(value) { return (value % 360 + 540) % 360 - 180; }
function createPreparedInterior(plan) {
  const cutaway = createMesh("saturn-cutaway", "");
  for (const band of plan.interior.outerBodyBands) {
    if (band.leaves.length === 0) continue;
    const polar = band.leaves.some(({ className }) =>
      className?.includes("saturn-cutaway-outer-pole"));
    const bodyMesh = createMesh(
      polar
        ? "saturn-body saturn-cutaway-body saturn-cutaway-polar-band"
        : "saturn-body saturn-cutaway-body",
      plan.meshTransform,
    );
    const leaves = document.createDocumentFragment();
    for (const leaf of band.leaves) leaves.appendChild(createTextureLeaf(leaf));
    bodyMesh.appendChild(leaves);
    cutaway.appendChild(bodyMesh);
  }
  for (const shell of plan.interior.shells) {
    const shellMesh = createMesh(
      `saturn-interior-shell ${shell.className}`,
      plan.meshTransform,
    );
    const leaves = document.createDocumentFragment();
    for (const leaf of shell.leaves) {
      const element = createTextureLeaf(leaf, PREPARED_SATURN_LEAF_LAYOUTS.classes[shell.className]);
      if (leaf.className) element.className = leaf.className;
      leaves.appendChild(element);
    }
    shellMesh.appendChild(leaves);
    cutaway.appendChild(shellMesh);
  }
  const sectionMesh = createMesh(
    "saturn-interior-sections",
    plan.meshTransform,
  );
  const sectionLeaves = document.createDocumentFragment();
  for (const leaf of plan.interior.sectionLeaves) {
    const element = createTextureLeaf(leaf);
    if (leaf.className) element.className = leaf.className;
    sectionLeaves.appendChild(element);
  }
  sectionMesh.appendChild(sectionLeaves);
  cutaway.appendChild(sectionMesh);
  return cutaway;
}

function createMesh(className, style) {
  const mesh = document.createElement("div");
  mesh.className = `polycss-mesh ${className}`;
  if (style) mesh.style.cssText = style;
  return mesh;
}

function createTextureLeaf(leaf, layout = null) {
  return createPreparedProjectiveTextureLeaf(leaf, layout);
}
