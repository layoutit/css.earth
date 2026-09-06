import { pathToFileURL } from "node:url";
import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../platform/prepared-object-assets.mjs";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_MERCURY_SCENE as plan } from "../runtime/preparedScene.mjs";
import { PREPARED_MERCURY_ASSETS as assets } from "../runtime/preparedAssets.mjs";
import { PREPARED_MERCURY_LENSES as lenses } from "../runtime/preparedLenses.mjs";
import { PREPARED_MERCURY_SKY_SUN as sun } from "../runtime/preparedSkySun.mjs";

export async function prepareMercuryPresentation() {
  const bank = assets.lighting.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)], normal = lenses.controls.find(lens => lens.id === "normal");
  const interiorKeys = ["outerSurface", "outerPoles", "core", "corePoles", "section"];
  const entries = [...preparedSkyResources(plan.starfield, sun, "warm"),
    { key: "poles", url: canonicalPreparedAsset(assets.poles), pool: "warm" },
    { key: "shadowless", url: bank.presentations.at(-1).url, pool: "warm" },
    ...lenses.controls.filter(lens => lens.view === "exterior").map(lens => ({ key: `surface:${lens.id}`,
      url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: lens.id === "normal" ? "warm" : "lenses" })),
    ...interiorKeys.map(name => ({ key: `interior:${name}`, pool: "lenses", url: canonicalPreparedAsset(assets.interior[`${name}Url`], assets.interior[`${name}2xUrl`]) })),
    ...bank.rows.map((row, index) => ({ key: `lighting:${index}`, url: row.url, pool: "lighting" })),
  ];
  const b = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads([
    ...plan.bodyLeaves, ...plan.interior.outerBodyLeaves, ...plan.interior.coreLeaves, ...plan.interior.sectionLeaves].map(leaf => leaf.style)) });
  const camera = b.element("div", "polycss-camera mercury-camera planet-render-root"); camera.style.perspective = "1000000px";
  const scene = b.element("div", "polycss-scene mercury-scene"); scene.style.transform = plan.camera.defaultTransform;
  const system = b.mesh("mercury-system"); system.style.transform = plan.systemTransform;
  const body = b.mesh("mercury-body"); body.style.transform = plan.bodyTransform;
  const surfaceUrl = canonicalPreparedAsset(normal.surfaceUrl, normal.surface2xUrl), polesUrl = canonicalPreparedAsset(assets.poles.url, assets.poles.url2x);
  const texture = (node, name, url) => node.style.setProperty(name, `url("${url}")`);
  texture(body, "--mercury-surface-image", surfaceUrl); texture(body, "--mercury-poles-image", polesUrl);
  b.append(null, camera); b.append(camera, scene); b.append(scene, system); b.append(system, body);
  for (const leaf of plan.bodyLeaves) b.append(body, b.leaf(leaf));
  const cutaway = b.mesh("mercury-cutaway"), cutawayBody = b.mesh("mercury-cutaway-body"); cutawayBody.style.transform = plan.interior.bodyTransform;
  texture(cutawayBody, "--mercury-surface-image", surfaceUrl); texture(cutawayBody, "--mercury-poles-image", polesUrl);
  texture(cutawayBody, "--mercury-interior-outer-image", canonicalPreparedAsset(assets.interior.outerSurfaceUrl, assets.interior.outerSurface2xUrl));
  texture(cutawayBody, "--mercury-interior-outer-poles-image", canonicalPreparedAsset(assets.interior.outerPolesUrl, assets.interior.outerPoles2xUrl));
  b.append(system, cutaway); b.append(cutaway, cutawayBody);
  for (const leaf of plan.interior.outerBodyLeaves) b.append(cutawayBody, b.leaf(leaf));
  const core = b.mesh("mercury-interior-core"); core.style.transform = plan.interior.bodyTransform; b.append(cutaway, core);
  for (const leaf of plan.interior.coreLeaves) b.append(core, b.leaf(leaf));
  const sections = b.mesh("mercury-interior-sections"); sections.style.transform = plan.interior.bodyTransform; b.append(cutaway, sections);
  for (const leaf of plan.interior.sectionLeaves) b.append(sections, b.leaf(leaf));
  const materialRoot = b.element("div", "mercury-material-root planet-render-root"), materialLeaf = b.element("s", "mercury-material");
  b.append(null, materialRoot); b.append(materialRoot, materialLeaf);
  const { tree, index } = b.finish({ camera, scene });
  const address = (p, resource = `lighting:${p.rowIndex}`) => ({ resource, frame: p.frameIndex, row: p.rowIndex,
    backgroundPosition: p.backgroundPosition, backgroundSize: p.backgroundSize });
  const track = { id: "lighting", target: index(materialLeaf), frame: { source: "sun-z", minimum: assets.lighting.minimumLightViewZ,
      maximum: assets.lighting.maximumLightViewZ, count: assets.lighting.frameCount, baseFrame: 0, remap: null },
    banks: [{ id: "lighting", frames: bank.presentations.map(p => address(p)), default: null, fixed: address(bank.presentations.at(-1), "shadowless"),
      rows: bank.rows.map((_, row) => ({ row, resource: `lighting:${row}`, firstFrame: row * bank.transport.framesPerRow,
        lastFrame: Math.min(bank.presentations.length - 1, (row + 1) * bank.transport.framesPerRow - 1) })) }],
    demand: { capacity: bank.transport.maximumRetainedRowCount, defaultFrame: bank.transport.defaultFrame },
    rotation: { kind: "angle", source: "view-sun", reference: "prepared", baseDegrees: assets.lighting.baseLightAzimuthDegrees,
      zeroAtPole: false, property: "--mercury-light-roll" }, frameAttribute: null, modeAttribute: null, quoted: true };
  const variants = lenses.controls.flatMap(lens => [false, true].map(shadows => {
    const interior = lens.view === "interior", writeTexture = (target, name, resource) => ({ kind: "texture", target: index(target), name, resource, quoted: true });
    return { when: { lensId: lens.id, shadows }, required: interior
      ? ["surface:normal", "poles", ...interiorKeys.map(name => `interior:${name}`)] : [`surface:${lens.id}`, "poles"],
      writes: [
        ...(interior ? [writeTexture(cutawayBody, "--mercury-surface-image", "surface:normal"), writeTexture(cutawayBody, "--mercury-poles-image", "poles")]
          : [writeTexture(body, "--mercury-surface-image", `surface:${lens.id}`), writeTexture(cutawayBody, "--mercury-surface-image", `surface:${lens.id}`)]),
        { kind: "attribute", target: -1, name: "data-view", value: interior ? "interior" : null },
        { kind: "attribute", target: -1, name: "data-lens", value: interior || lens.id === lenses.defaultLens ? null : lens.id },
        { kind: "class", target: -1, name: "mercury-hide-shadows", value: !shadows },
      ], materials: [{ track: "lighting", bank: "lighting", mode: shadows ? "frames" : "fixed", enabled: true, rotationEnabled: shadows,
        frameOverride: shadows ? null : assets.lighting.frameCount - 1, clearWhenHidden: false, fixedMode: "full-phase-curvature",
        modeLabel: shadows ? "directional-terminator" : "full-phase-curvature",
        addressAttributes: [{ name: "data-material-frame", source: shadows ? "frame" : "literal", value: null },
          { name: "data-material-mode", source: "literal", value: shadows ? null : "full-phase-curvature" }],
      }] };
  }));
  const pose = plan.interior.presentationOrbit;
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: plan.starfield, sun, inputSelector: ".mercury-input-surface",
    assets: { entries, pools: [preparedResourcePool("warm", entries, { retention: "warm", decoding: "sync" }),
      preparedResourcePool("lenses", entries, { retention: "selection", decoding: "sync", capacity: interiorKeys.length + 1, concurrency: interiorKeys.length + 1 }),
      preparedResourcePool("lighting", entries, { retention: "selection", decoding: "sync", capacity: bank.transport.maximumRetainedRowCount,
        concurrency: bank.transport.maximumRetainedRowCount, eviction: "capacity", reuse: true })],
      startup: [...entries.filter(entry => entry.pool === "warm").map(entry => entry.key), ...bank.transport.initialWarmRows.map(row => `lighting:${row}`)] },
    tree, variants, resourceOrder: "materials-first", materials: [track], viewBindings: [{ kind: "shell-scale", target: index(materialRoot), variable: "--mercury-shell-scale", defaultZoom: 1 }],
    animations: [{ target: index(cutaway), id: "mercury-interior-presentation-orbit", mode: "pose", duration: pose.durationMilliseconds,
      sourceMinimum: plan.camera.minimumControlPitchDegrees, millisecondsPerDegree: pose.millisecondsPerControlDegree, keyframes: pose.keyframes }] };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await prepareMercuryPresentation(), objectControls);
}
