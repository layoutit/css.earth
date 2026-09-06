import { pathToFileURL } from "node:url";
import { canonicalPreparedAsset, preparedSkyResources, preparedResourcePool } from "../../../platform/prepared-object-assets.mjs";
import { PREPARED_PRESENTATION_SCHEMA } from "../../../platform/prepared-presentation-contract.mjs";
import { prepareCssomDeclarationReads } from "../../../../tools/prepared-cssom.mjs";
import { createPreparedNodeTree } from "../../../../tools/prepared-node-tree.mjs";
import { writePreparedPresentation } from "../../../../tools/prepare-presentation.mjs";
import { objectControls } from "../site/control-content.mjs";
import { PREPARED_SUN_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_SUN_LENSES } from "../runtime/preparedLenses.mjs";

export async function prepareSunPresentation() {
  const plan=PREPARED_SUN_SCENE,lenses=PREPARED_SUN_LENSES,layers=["surface","poles","corona","limb"];
  const celestial=preparedSkyResources(plan.starfield,null,"warm");
  const entries=[...celestial,...lenses.controls.flatMap(lens=>layers.map(layer=>({
    key:`${layer}:${lens.id}`,url:canonicalPreparedAsset(lens[`${layer}Url`],lens[`${layer}2xUrl`]),pool:"material",
  })))];
  const required=id=>layers.map(layer=>`${layer}:${id}`);
  const b=createPreparedNodeTree({ cssomReads: await prepareCssomDeclarationReads(plan.body.leaves.map(leaf => leaf.style)) });
  const camera=b.mesh("polycss-camera sun-camera planet-render-root","perspective:1000000px");
  const scene=b.mesh("polycss-scene","");
  const system=b.mesh("sun-system",`transform:rotateY(${-plan.body.axialTiltDegrees}deg)`);
  const body=b.mesh("sun-body","");
  b.append(null,camera);b.append(camera,scene);b.append(scene,system);b.append(system,body);
  for(const leaf of plan.body.leaves)b.append(body,b.leaf(leaf));
  const corona=b.element("div","sun-corona-layer planet-render-root","",{"aria-hidden":"true"});
  corona.style.setProperty("--sun-corona-image",`url(${JSON.stringify(canonicalPreparedAsset(plan.offLimbContext.defaultUrl,plan.offLimbContext.defaultUrl2x))})`);
  corona.style.setProperty("--sun-camera-zoom",String(plan.camera.defaultZoom));
  const limb=b.element("div","sun-limb-layer planet-render-root","",{"aria-hidden":"true"});
  limb.style.setProperty("--sun-limb-image",`url(${JSON.stringify(canonicalPreparedAsset(plan.limbMaterial.defaultUrl,plan.limbMaterial.defaultUrl2x))})`);
  limb.style.setProperty("--sun-camera-zoom",String(plan.camera.defaultZoom));
  b.append(null,corona,limb);
  const {tree,index}=b.finish({camera,scene});
  const layerTargets=[body,body,corona,limb];
  return {schema:PREPARED_PRESENTATION_SCHEMA,camera:plan.camera,sky:plan.starfield,sun:null,
    inputSelector:".sun-input-surface",assets:{entries,pools:[
      preparedResourcePool("warm",entries,{retention:"warm"}),
      preparedResourcePool("material",entries,{retention:"selection",capacity:8,concurrency:8}),
    ],startup:[...celestial.map(entry=>entry.key),...required(lenses.defaultLens)]},tree,
    variants:lenses.controls.map(lens=>({when:{lensId:lens.id},required:required(lens.id),writes:[
      ...layers.map((layer,i)=>({kind:"texture",target:index(layerTargets[i]),name:`--sun-${layer}-image`,resource:`${layer}:${lens.id}`,quoted:true})),
      {kind:"attribute",target:-1,name:"data-lens",value:lens.id},
    ],materials:[]})),materials:[],
    viewBindings:[corona,limb].map(node=>({kind:"zoom-property",target:index(node),property:"--sun-camera-zoom"})),
    animations:[],
  };
}
if(import.meta.url===pathToFileURL(process.argv[1]??"").href){
  await writePreparedPresentation(new URL("../runtime/preparedPresentation.mjs",import.meta.url),await prepareSunPresentation(),objectControls);
}
