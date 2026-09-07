import { canonicalPreparedAsset, preparedSunResources, preparedResourcePool } from "../../../src/platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../src/platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../prepared-node-tree.mjs";
export async function prepareBandSurfacePresentation({ namespace, plan, lenses, sky, sun }) {
  const celestial = preparedSunResources(sun, "mounted");
  const entries = [...celestial,
    { key: "curvature", url: canonicalPreparedAsset(lenses.material), pool: "mounted" },
    ...lenses.controls.flatMap(lens => [
      { key: `surface:${lens.id}`, url: canonicalPreparedAsset(lens.surfaceUrl, lens.surface2xUrl), pool: "mounted" },
      { key: `poles:${lens.id}`, url: canonicalPreparedAsset(lens.polesUrl, lens.poles2xUrl), pool: "mounted" },
    ]),
  ];
  const required = id => [`surface:${id}`, `poles:${id}`];
  const builder = createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.bands.flatMap(band => band.leaves).map(leaf => leaf.style)) });
  const camera = builder.mesh(`polycss-camera ${namespace}-camera planet-render-root`, plan.camera.style);
  const scene = builder.mesh("polycss-scene", plan.camera.sceneStyle);
  const system = builder.mesh(`${namespace}-system`, plan.body.systemTransform);
  builder.append(null, camera); builder.append(camera, scene); builder.append(scene, system);
  const surface = [], polar = [];
  for (const band of plan.body.bands) {
    const pole = band.latitudeIndex === 0 || band.latitudeIndex === plan.body.latitudeSegments - 1;
    const carrier = builder.mesh(pole ? `${namespace}-body ${namespace}-body-polar` : `${namespace}-body`,
      `${plan.body.meshTransform};animation-duration:${band.visualRotationSeconds}s`);
    (pole ? polar : surface).push(carrier);
    carrier.style.setProperty(`--${namespace}-surface-texture`, `url("${canonicalPreparedAsset(plan.body.assets.surface)}")`);
    carrier.style.setProperty(`--${namespace}-poles-texture`, `url("${canonicalPreparedAsset(plan.body.assets.poles)}")`);
    builder.append(system, carrier);
    for (const leaf of band.leaves) builder.append(carrier, builder.leaf(leaf));
  }
  const materialRoot = builder.mesh(`${namespace}-material-root planet-render-root`);
  const material = builder.element("s", `${namespace}-material`);
  material.style.backgroundImage = `url("${entries.find(entry => entry.key === "curvature").url}")`;
  builder.append(materialRoot, material); builder.append(null, materialRoot);
  const { tree, index } = builder.finish({ camera, scene });
  return { schema: PREPARED_PRESENTATION_SCHEMA, camera: plan.camera, sky: sky, sun: sun,
    assets: { entries, pools: [preparedResourcePool("mounted", entries)],
      startup: [...celestial.map(entry => entry.key), "curvature", ...required(lenses.defaultLens)] }, tree,
    variants: lenses.controls.map(lens => ({ when: { lensId: lens.id }, required: required(lens.id), writes: [
      ...surface.map(carrier => ({ kind: "texture", target: index(carrier), name: `--${namespace}-surface-texture`, resource: `surface:${lens.id}`, quoted: true })),
      ...polar.map(carrier => ({ kind: "texture", target: index(carrier), name: `--${namespace}-poles-texture`, resource: `poles:${lens.id}`, quoted: true })),
      { kind: "attribute", target: -1, name: "data-lens", value: lens.id },
    ], materials: [] })),
    materials: [], viewBindings: [{ kind: "shell-scale", target: index(materialRoot), variable: `--${namespace}-shell-scale`, defaultZoom: plan.camera.defaultZoom }],
    animations: [],
  };
}

export async function prepareEmissiveSurfacePresentation({ namespace, plan, lenses }) {
  const layers=["surface","poles","corona","limb"];
  const celestial=preparedSunResources(null,"warm");
  const entries=[...celestial,...lenses.controls.flatMap(lens=>layers.map(layer=>({
    key:`${layer}:${lens.id}`,url:canonicalPreparedAsset(lens[`${layer}Url`],lens[`${layer}2xUrl`]),pool:"material",
  })))];
  const required=id=>layers.map(layer=>`${layer}:${id}`);
  const b=createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.leaves.map(leaf => leaf.style)) });
  const camera=b.mesh(`polycss-camera ${namespace}-camera planet-render-root`,"perspective:1000000px");
  const scene=b.mesh("polycss-scene","");
  const system=b.mesh(`${namespace}-system`,`transform:rotateY(${-plan.body.axialTiltDegrees}deg)`);
  const body=b.mesh(`${namespace}-body`,"");
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);b.append(system,body);
  for(const leaf of plan.body.leaves)b.append(body,b.leaf(leaf));
  const corona=b.element("div",`${namespace}-corona-layer planet-render-root`,"",{"aria-hidden":"true"});
  corona.style.setProperty(`--${namespace}-corona-image`,`url(${JSON.stringify(canonicalPreparedAsset(plan.offLimbContext.defaultUrl,plan.offLimbContext.defaultUrl2x))})`);
  corona.style.setProperty(`--${namespace}-camera-zoom`,String(plan.camera.defaultZoom));
  const limb=b.element("div",`${namespace}-limb-layer planet-render-root`,"",{"aria-hidden":"true"});
  limb.style.setProperty(`--${namespace}-limb-image`,`url(${JSON.stringify(canonicalPreparedAsset(plan.limbMaterial.defaultUrl,plan.limbMaterial.defaultUrl2x))})`);
  limb.style.setProperty(`--${namespace}-camera-zoom`,String(plan.camera.defaultZoom));
  b.append(null,corona,limb);
  const {tree,index}=b.finish({camera,scene});
  const layerTargets=[body,body,corona,limb];
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:plan.camera,sky:plan.starfield,sun:null,
    assets:{entries,pools:[
      preparedResourcePool("warm",entries,{retention:"warm"}),
      preparedResourcePool("material",entries,{retention:"selection",capacity:8,concurrency:8}),
    ],startup:[...celestial.map(entry=>entry.key),...required(lenses.defaultLens)]},tree,
    variants:lenses.controls.map(lens=>({when:{lensId:lens.id},required:required(lens.id),writes:[
      ...layers.map((layer,i)=>({kind:"texture",target:index(layerTargets[i]),name:`--${namespace}-${layer}-image`,resource:`${layer}:${lens.id}`,quoted:true})),
      {kind:"attribute",target:-1,name:"data-lens",value:lens.id},
    ],materials:[]})),materials:[],
    viewBindings:[corona,limb].map(node=>({kind:"zoom-property",target:index(node),property:`--${namespace}-camera-zoom`})),
    animations:[],
  };
}
