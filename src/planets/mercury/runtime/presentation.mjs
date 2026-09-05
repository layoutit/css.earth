import { createPreparedProjectiveTextureLeaf } from "../../../platform/prepared-projective-texture-leaf.mjs";
import { registerBodyDependentLayers } from "../../../platform/body-layer-registration.mjs";
import { canonicalPreparedAsset as canonicalPreparedUrl } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_NAVIGATION_MARKERS } from "../../../../site/prepared-navigation-markers.mjs";
import { PREPARED_MERCURY_SCENE } from "./preparedScene.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES } from "./preparedLenses.mjs";
import { BILLBOARD_LIGHTING_KEY, billboardLighting, materialBank, materialFrameFor, materialSourceFor } from "./material.mjs";
const GEOMETRY_LEVEL_OF_DETAIL = Object.freeze({ stage: "geometry", silhouetteDiameter: null, billboardOpacity: 0, markerOpacity: 0 });
// The lighting overlay never shrinks below the marker it lights at the far
// stage: the sprite is a size floor, and the overlay's phase must cover it.
const MARKER_RADIUS = PREPARED_NAVIGATION_MARKERS.mercury.presentation.size / 2;
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
      delete stage.dataset.lod;
      stage.classList.remove("mercury-hide-shadows");
      stage.classList.remove("mercury-hide-orbit");
    });
    // A true perspective camera (the shared orbit writes its perspective and
    // eye from the prepared plan): the body is placed by dolly on the scene
    // root, the roots are never scaled.
    cameraRoot.className = "polycss-camera mercury-camera planet-render-root";

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
    // The billboard: a flat disc of the surface's mean colour fitted to the
    // same silhouette as the overlay above it, which lights it.
    const billboard = document.createElement("s");
    billboard.className = "mercury-billboard";
    materialRoot.style.setProperty("--mercury-billboard-color", normal.billboardColor);
    const materialLeaf = document.createElement("s");
    materialLeaf.className = "mercury-material";

    materialRoot.append(billboard, materialLeaf);

  stage.append(cameraRoot, materialRoot);
  const registration = registerBodyDependentLayers({ objectId: "mercury", sceneElement: sceneRoot,
    bodySystem: system, lightingOverlays: [materialRoot] });
  let materialFrame = shadowlessPresentation.frameIndex, materialLightRollDegrees = 0, appliedFrame = null, appliedRow = null;
  let materialSource = "rows", levelOfDetail = GEOMETRY_LEVEL_OF_DETAIL, publishedBillboardOpacity = null, orbitEnabled = true;
  return Object.freeze({
    cameraElement: cameraRoot, sceneElement: sceneRoot, bodyLayers: Object.freeze([registration]),
    commitSelection({ selection, resources }) {
      const lens = lensById(selection.lensId);
      materialRoot.style.setProperty("--mercury-billboard-color", lens.billboardColor);
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
      // The orbit line is retained either way; the class only hides it, so
      // toggling neither re-lays-out nor republishes the scene.
      orbitEnabled = selection.orbit;
      stage.classList.toggle("mercury-hide-orbit", !selection.orbit);
    },
    publishFrame({ selection, view, resources }) {
      context.seekAnimation(interior.presentationAnimation, Math.max(0, Math.min(pose.durationMilliseconds,
        (view.controlPitch - PREPARED_MERCURY_SCENE.camera.minimumControlPitchDegrees) * pose.millisecondsPerControlDegree)));
      // The terminator overlay is fitted to the projected silhouette: an
      // ellipse, slightly elongated and shifted outward when off-axis, exactly
      // the mathematical silhouette the prepared lighting frames are
      // registered to (at a thin crescent a pixel of inflation moves the
      // overlay's crescent off the painted one).
      const silhouette = view.body?.silhouette;
      if (silhouette) {
        const unitScale = 2 * PREPARED_MERCURY_SCENE.camera.defaultZoom / PREPARED_MERCURY_SCENE.camera.logicalBodyDiameter;
        const radialAngle = Math.atan2(silhouette.radial[1], silhouette.radial[0]) * 180 / Math.PI;
        const radial = Math.max(silhouette.radialSemiAxis, MARKER_RADIUS);
        const tangential = Math.max(silhouette.tangentialSemiAxis, MARKER_RADIUS);
        materialRoot.style.transform =
          `translate(${formatNumber(silhouette.centre[0])}px, ${formatNumber(silhouette.centre[1])}px) ` +
          `rotate(${formatNumber(radialAngle)}deg) ` +
          `scale(${formatNumber(radial * unitScale)}, ${formatNumber(tangential * unitScale)}) ` +
          `rotate(${formatNumber(-radialAngle)}deg)`;
      }
      // Level of detail from the camera's published stage: the coarser stage
      // fades in over the finer one (see styles.css); only changed values are
      // written. From the crossfade on the overlay draws the same phase from
      // the billboard atlas, and the row shards stop streaming.
      levelOfDetail = view.levelOfDetail ?? GEOMETRY_LEVEL_OF_DETAIL;
      if (stage.dataset.lod !== levelOfDetail.stage) stage.dataset.lod = levelOfDetail.stage;
      const billboardOpacity = formatNumber(levelOfDetail.billboardOpacity);
      if (billboardOpacity !== publishedBillboardOpacity) {
        materialRoot.style.setProperty("--mercury-billboard-opacity", billboardOpacity);
        publishedBillboardOpacity = billboardOpacity;
      }
      materialSource = materialSourceFor(view);
      materialFrame = materialFrameFor(selection, view);
      const prepared = materialSource === "billboard" ? billboardLighting.presentations[materialFrame]
        : materialBank.presentations[materialFrame];
      const key = materialSource === "billboard" ? BILLBOARD_LIGHTING_KEY
        : selection.shadows ? `lighting:${prepared.rowIndex}` : "shadowless";
      if (resources.has(key)) {
        materialLeaf.style.backgroundImage = `url("${resources.url(key)}")`;
        materialLeaf.style.backgroundPosition = prepared.backgroundPosition;
        materialLeaf.style.backgroundSize = prepared.backgroundSize;
        appliedFrame = prepared.frameIndex; appliedRow = prepared.rowIndex ?? null;
        materialLeaf.dataset.materialSource = materialSource;
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
      const shadowsEnabled = !stage.classList.contains("mercury-hide-shadows");
      return { material: { materialFrame, appliedFrame, appliedRow, materialLightRollDegrees, materialSource },
        sky: { materialFrame, materialLightRollDegrees,
          shadowsEnabled,
          materialMode: materialLeaf.dataset.materialMode === "full-phase-curvature" ? "full-phase-curvature" : "directional-terminator",
          orbitEnabled,
          // Rows stream only while the overlay draws a lit frame from them.
          lod: { ...levelOfDetail, materialSource, rowStreaming: materialSource === "rows" && shadowsEnabled } },
        dom: { interiorMounted: true, retainedInteriorNodeCount: 1 + interior.cutaway.querySelectorAll("*").length,
          retainedBillboardCount: 1 } };
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
function lensById(id) {
  const lens = PREPARED_MERCURY_LENSES.controls.find(lens => lens.id === id);
  if (!lens) throw new RangeError(`Unknown Mercury lens: ${id}.`);
  if (!/^#[0-9a-f]{6}$/u.test(lens.billboardColor ?? "")) {
    throw new Error(`Mercury lens ${id} has no prepared billboard colour.`);
  }
  return lens;
}
function normalizeDegrees(degrees) { return (degrees % 360 + 540) % 360 - 180; }
function formatNumber(value) { return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString(); }
