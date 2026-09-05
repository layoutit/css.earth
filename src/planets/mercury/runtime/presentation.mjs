import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { canonicalPreparedAsset as canonicalPreparedUrl } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { materialBank, materialFrameFor } from "./material.mjs";
export function createPresentation(stage, context) {
  const document = stage.ownerDocument;
  const shadowlessPresentation = materialBank.presentations.at(-1);
  const pose = PREPARED_MERCURY_SCENE.interior.presentationOrbit;
    const normal = lensById("normal");
    const cameraRoot = document.createElement("div");
    context.own(() => cameraRoot.remove());
    context.own(() => {
      if (cameraRoot.parentNode !== stage) return;
      delete stage.dataset.lens;
      delete stage.dataset.view;
      stage.classList.remove("mercury-hide-shadows");
    });
    cameraRoot.className = "polycss-camera mercury-camera planet-render-root";
    cameraRoot.style.perspective = "1000000px";

    const sceneRoot = document.createElement("div");
    sceneRoot.className = "polycss-scene mercury-scene";
    sceneRoot.style.transform = PREPARED_MERCURY_SCENE.camera.defaultTransform;

    const system = document.createElement("div");
    system.className = "polycss-mesh mercury-system";
    system.style.transform = PREPARED_MERCURY_SCENE.systemTransform;

    const body = document.createElement("div");
    body.className = "polycss-mesh mercury-body";
    body.style.transform = PREPARED_MERCURY_SCENE.bodyTransform;
    body.style.setProperty(
      "--mercury-surface-image",
      `url("${canonicalPreparedUrl(normal.surfaceUrl, normal.surface2xUrl)}")`,
    );
    body.style.setProperty(
      "--mercury-poles-image",
      `url("${canonicalPreparedUrl(
        PREPARED_MERCURY_ASSETS.poles.url,
        PREPARED_MERCURY_ASSETS.poles.url2x,
      )}")`,
    );
    body.append(...PREPARED_MERCURY_SCENE.bodyLeaves.map(createLeaf));
    system.appendChild(body);
    const interior = createPreparedInterior(system, normal);
    sceneRoot.appendChild(system);
    cameraRoot.appendChild(sceneRoot);

    const materialRoot = document.createElement("div");
    context.own(() => materialRoot.remove());
    materialRoot.className = "mercury-material-root planet-render-root";
    const materialLeaf = document.createElement("s");
    materialLeaf.className = "mercury-material";

    materialRoot.appendChild(materialLeaf);

  stage.append(cameraRoot, materialRoot);
  const registration = registerBodyDependentLayers({ objectId: "mercury", sceneElement: sceneRoot,
    bodySystem: system, lightingOverlays: [materialRoot] });
  let materialFrame = shadowlessPresentation.frameIndex, materialLightRollDegrees = 0, appliedFrame = null, appliedRow = null;
  return Object.freeze({
    cameraElement: cameraRoot, sceneElement: sceneRoot, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection, resources }) {
      const lens = lensById(selection.lensId);
      if (lens.view === "exterior") {
        const surface = resources.url(`surface:${lens.id}`);
        body.style.setProperty("--mercury-surface-image", `url("${surface}")`);
        interior.cutawayBody.style.setProperty("--mercury-surface-image", `url("${surface}")`);
        delete stage.dataset.view;
        if (lens.id === PREPARED_MERCURY_LENSES.defaultLens) delete stage.dataset.lens;
        else stage.dataset.lens = lens.id;
      } else {
        interior.cutawayBody.style.setProperty("--mercury-surface-image", `url("${resources.url("surface:normal")}")`);
        interior.cutawayBody.style.setProperty("--mercury-poles-image", `url("${resources.url("poles")}")`);
        stage.dataset.view = "interior"; delete stage.dataset.lens;
      }
      stage.classList.toggle("mercury-hide-shadows", !selection.shadows);
    },
    publishFrame({ selection, view, resources }) {
      context.seekAnimation(interior.presentationAnimation, Math.max(0, Math.min(pose.durationMilliseconds,
        (view.controlPitch - PREPARED_MERCURY_SCENE.camera.minimumControlPitchDegrees) * pose.millisecondsPerControlDegree)));
      materialRoot.style.scale = "calc(var(--mercury-shell-scale) / (" +
        `var(--planet-viewport-zoom-divisor) / ${view.zoom}))`;
      materialFrame = materialFrameFor(selection, view);
      const prepared = materialBank.presentations[materialFrame];
      const key = selection.shadows ? `lighting:${prepared.rowIndex}` : "shadowless";
      if (resources.has(key)) {
        materialLeaf.style.backgroundImage = `url("${resources.url(key)}")`;
        materialLeaf.style.backgroundPosition = prepared.backgroundPosition;
        materialLeaf.style.backgroundSize = prepared.backgroundSize;
        appliedFrame = prepared.frameIndex; appliedRow = prepared.rowIndex;
        if (selection.shadows) {
          delete materialLeaf.dataset.materialMode;
          materialLeaf.dataset.materialFrame = String(materialFrame);
        } else {
          materialLeaf.dataset.materialMode = "full-phase-curvature";
          delete materialLeaf.dataset.materialFrame;
        }
      }
      if (!selection.shadows || Math.hypot(view.sunViewDirection[0], view.sunViewDirection[1]) >= 1e-9) {
        materialLightRollDegrees = selection.shadows ? normalizeDegrees(
          Math.atan2(view.sunViewDirection[1], view.sunViewDirection[0]) * 180 / Math.PI -
          PREPARED_MERCURY_ASSETS.lighting.baseLightAzimuthDegrees) : 0;
        materialLeaf.style.setProperty("--mercury-light-roll", `${materialLightRollDegrees}deg`);
      }
    },
    observe() {
      registration.assertRegistered();
      return { material: { materialFrame, appliedFrame, appliedRow, materialLightRollDegrees },
        sky: { materialFrame, materialLightRollDegrees,
          shadowsEnabled: !stage.classList.contains("mercury-hide-shadows"),
          materialMode: materialLeaf.dataset.materialMode === "full-phase-curvature" ? "full-phase-curvature" : "directional-terminator" },
        dom: { interiorMounted: true, retainedInteriorNodeCount: 1 + interior.cutaway.querySelectorAll("*").length } };
    },
  });
  function createPreparedInterior(system, normal) {
    const presentation = pose;
        const cutaway = document.createElement("div");
        cutaway.className = "polycss-mesh mercury-cutaway";
        const cutawayBody = document.createElement("div");
        cutawayBody.className = "polycss-mesh mercury-cutaway-body";
        cutawayBody.style.transform =
          PREPARED_MERCURY_SCENE.interior.bodyTransform;
        cutawayBody.style.setProperty(
          "--mercury-surface-image",
          `url("${canonicalPreparedUrl(normal.surfaceUrl, normal.surface2xUrl)}")`,
        );
        cutawayBody.style.setProperty(
          "--mercury-poles-image",
          `url("${canonicalPreparedUrl(
            PREPARED_MERCURY_ASSETS.poles.url,
            PREPARED_MERCURY_ASSETS.poles.url2x,
          )}")`,
        );
        cutawayBody.style.setProperty(
          "--mercury-interior-outer-image",
          `url("${canonicalPreparedUrl(
            PREPARED_MERCURY_ASSETS.interior.outerSurfaceUrl,
            PREPARED_MERCURY_ASSETS.interior.outerSurface2xUrl,
          )}")`,
        );
        cutawayBody.style.setProperty(
          "--mercury-interior-outer-poles-image",
          `url("${canonicalPreparedUrl(
            PREPARED_MERCURY_ASSETS.interior.outerPolesUrl,
            PREPARED_MERCURY_ASSETS.interior.outerPoles2xUrl,
          )}")`,
        );
        cutawayBody.append(
          ...PREPARED_MERCURY_SCENE.interior.outerBodyLeaves.map(createLeaf),
        );
        const core = document.createElement("div");
        core.className = "polycss-mesh mercury-interior-core";
        core.style.transform = PREPARED_MERCURY_SCENE.interior.bodyTransform;
        core.append(
          ...PREPARED_MERCURY_SCENE.interior.coreLeaves.map(createLeaf),
        );
        const sections = document.createElement("div");
        sections.className = "polycss-mesh mercury-interior-sections";
        sections.style.transform = PREPARED_MERCURY_SCENE.interior.bodyTransform;
        sections.append(
          ...PREPARED_MERCURY_SCENE.interior.sectionLeaves.map(createLeaf),
        );
        cutaway.append(cutawayBody, core, sections);
        system.appendChild(cutaway);
        const presentationAnimation = cutaway.animate(presentation.keyframes, {
          duration: presentation.durationMilliseconds,
          easing: "linear",
          fill: "both",
        });
        presentationAnimation.id = "mercury-interior-presentation-orbit";
        context.registerAnimation(presentationAnimation, { mode: "pose" });
        return { cutaway, cutawayBody, core, sections, presentationAnimation };
  }
}
function createLeaf(leaf) { return createPreparedProjectiveTextureLeaf(leaf); }
function lensById(id) { return PREPARED_MERCURY_LENSES.controls.find(lens => lens.id === id); }
function normalizeDegrees(degrees) { return (degrees % 360 + 540) % 360 - 180; }
