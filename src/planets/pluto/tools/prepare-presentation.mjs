import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_PLUTO_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_PLUTO_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_PLUTO_STARFIELD } from "../runtime/preparedStarfield.mjs";
import { PREPARED_PLUTO_SKY_SUN } from "../runtime/preparedSkySun.mjs";

export async function preparePlutoPresentation() {
  const plan = PREPARED_PLUTO_SCENE, lenses = PREPARED_PLUTO_LENSES;
  const celestial = preparedSkyResources(PREPARED_PLUTO_STARFIELD, PREPARED_PLUTO_SKY_SUN, "mounted");
  const entries = [...celestial,
    { key: "curvature", url: canonicalPreparedAsset(lenses.material), pool: "mounted" },
    ...lenses.controls.flatMap(lens => [
      { key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: "mounted" },
      { key: `poles:${lens.id}`, url: canonicalPreparedAsset(lens.polesUrl, lens.poles2xUrl), pool: "mounted" },
    ]),
  ];
  const required = id => [`surface:${id}`, `poles:${id}`];
  const builder = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.bands.flatMap(band => band.leaves).map(leaf => leaf.style)) });
  const camera = builder.mesh("polycss-camera pluto-camera planet-render-root", plan.camera.style);
  const scene = builder.mesh("polycss-scene", plan.camera.sceneStyle);
  const system = builder.mesh("pluto-system", plan.body.systemTransform);
  builder.append(null, camera); builder.append(camera, scene); builder.append(scene, system);
  const surface = [], polar = [];
  for (const band of plan.body.bands) {
    const pole = band.latitudeIndex === 0 || band.latitudeIndex === plan.body.latitudeSegments - 1;
    const carrier = builder.mesh(pole ? "pluto-body pluto-body-polar" : "pluto-body",
      `${plan.body.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
    (pole ? polar : surface).push(carrier);
    carrier.style.setProperty("--pluto-surface-texture", `url("${canonicalPreparedAsset(plan.body.assets.surface)}")`);
    carrier.style.setProperty("--pluto-poles-texture", `url("${canonicalPreparedAsset(plan.body.assets.poles)}")`);
    builder.append(system, carrier);
    for (const leaf of band.leaves) builder.append(carrier, builder.leaf(leaf));
  }
  const materialRoot = builder.mesh("pluto-material-root planet-render-root");
  const material = builder.element("s", "pluto-material");
  material.style.backgroundImage = `url("${entries.find(entry => entry.key === "curvature").url}")`;
  builder.append(materialRoot, material); builder.append(null, materialRoot);
  const { tree, index } = builder.finish({ camera, scene, registrations: [{ bodySystem: system, lightingOverlays: [materialRoot] }] });
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: PREPARED_PLUTO_STARFIELD, sun: PREPARED_PLUTO_SKY_SUN,
    inputSelector: ".pluto-input-surface", assets: { entries, pools: [preparedResourcePool("mounted", entries)],
      startup: [...celestial.map(entry => entry.key), "curvature", ...required(lenses.defaultLens)] }, tree,
    variants: lenses.controls.map(lens => ({ when: { lensId: lens.id }, required: required(lens.id), writes: [
      ...surface.map(carrier => ({ kind: "texture", target: index(carrier), name: "--pluto-surface-texture", resource: `surface:${lens.id}`, quoted: true })),
      ...polar.map(carrier => ({ kind: "texture", target: index(carrier), name: "--pluto-poles-texture", resource: `poles:${lens.id}`, quoted: true })),
      { kind: "attribute", target: -1, name: "data-lens", value: lens.id },
    ], materials: [] })),
    materials: [], viewBindings: [{ kind: "shell-scale", target: index(materialRoot), variable: "--pluto-shell-scale", defaultZoom: plan.camera.defaultZoom }],
    animations: [], observations: { constants: { dom: { mode: "prepared-projective-sphere-with-retained-cubic-sky", maximumRetainedLeafCount: plan.counts.retainedLeafCount } }, materials: [], counts: [] },
  };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs", import.meta.url), await preparePlutoPresentation(), objectControls);
}
