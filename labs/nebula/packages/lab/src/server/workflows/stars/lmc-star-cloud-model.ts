/** Offline verified reconstruction context for cloud-conditioned catalogue depths. */
import { parseLabModelJson } from '../../../resources/model-paths.ts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, posix } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { loadVolumeSource } from '@cssearth/bake/volume/node';
import { createObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import { rectifyObservation } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { decomposeFilledComponents } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';
import { createFilledVolumeSampler } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-volume';
import { createIntegratedSignalSampler } from '@cssearth/bake/volume';

type Pin = { path: string; url?: string };
async function pinned(pin: Pin) {
  let downloaded = false;
  const bytes = await readFile(pin.path).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT' || !pin.url) throw error;
    const response = await fetch(pin.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Cloud source download failed: ${response.status}`);
    downloaded = true; return Buffer.from(await response.arrayBuffer());
  });
  if (downloaded) { await mkdir(dirname(pin.path), { recursive: true }); await writeFile(pin.path, bytes); }
  return bytes;
}
export async function loadStarCloudModel(frame: DensityVolumeFrame) {
  const manifest = parseLabModelJson(await readFile('labs/nebula/models/lmc/stars/source/catalogue.json', 'utf8'));
  const refs = manifest.depthModel;
  const buffers = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, value]) => [key, await pinned(value as Pin)])));
  const recipe = parseLabModelJson(buffers.cloudRecipe.toString()), evidence = parseLabModelJson(buffers.cloudProvenance.toString());
  const analysis = parseLabModelJson(buffers.analysis.toString()), object = parseLabModelJson(buffers.cloudObject.toString());
  // Every file names the next one by path: the cloud object its provenance, the provenance its recipe, the analysis and
  // the recipe the stellar density. A catalogue that points at files from different preparations stops here.
  const beside = (descriptor: string, file: unknown) => typeof file === 'string' ? posix.join(posix.dirname(descriptor), file) : undefined;
  const disagreements = [
    ['cloud object preparation', beside(refs.cloudObject.path, object.properties?.preparation?.source), refs.cloudProvenance.path],
    ['cloud provenance recipe', evidence.recipe?.path, refs.cloudRecipe.path],
    ['observation prior density', analysis.prior?.source?.path, refs.recipe.path],
    ['cloud recipe stellar prior', recipe.stellarPrior?.path, refs.recipe.path],
  ].filter(([, actual, expected]) => actual !== expected);
  if (disagreements.length) throw new Error(`labs/nebula/models/lmc/stars catalogue depth model disagrees: ${JSON.stringify(disagreements)}`);
  const stellarObject = parseLabModelJson(buffers.object.toString());
  if (beside(refs.object.path, stellarObject.properties?.preparation?.source) !== refs.recipe.path)
    throw new Error(`${refs.object.path} does not name ${refs.recipe.path} as its density source.`);
  for (const sourceFrame of [object.properties.volume, stellarObject.properties.volume])
    for (const key of ['referenceFrame', 'epochJdTt', 'originM', 'localToReferenceXyzw', 'metersPerUnit'] as const)
      if (JSON.stringify(sourceFrame[key]) !== JSON.stringify(frame[key])) throw new Error('Star cloud model uses a different physical frame.');
  const mapping = createObservationMapping(recipe.wcs, frame);
  const photo = await rectifyObservation(await pinned(recipe.photo), mapping, recipe.analysis.width);
  const decomposition = decomposeFilledComponents(photo.intensity, photo.width, photo.height, recipe.analysis.decomposition);
  const decoded = gunzipSync(buffers.prior), dimensions = analysis.prior.dimensions as [number, number, number];
  if (decoded.length !== dimensions.reduce((a,b)=>a*b,1)*4) throw new Error('Star cloud prior dimensions disagree.');
  const density = new Float32Array(decoded.length/4);
  for (let i=0;i<density.length;i++) density[i]=decoded.readFloatLE(i*4);
  const prior = { density, dimensions, boundsKpc: analysis.prior.boundsKpc, diagnostics: analysis.prior };
  const cloud = createFilledVolumeSampler({ target: photo, decomposition, boundsKpc: prior.boundsKpc, densityPrior: prior,
    mode: 'coherent', channels: recipe.channels, depth: recipe.depth, diffusePriorWeight: recipe.diffusePriorWeight,
    exposureGain: recipe.exposureGain, maxDisplaySignal: recipe.maxDisplaySignal });
  if (JSON.stringify(cloud.diagnostics.depthPlane) !== JSON.stringify(evidence.volume.depthPlane) ||
      JSON.stringify(cloud.supportBoundsKpc) !== JSON.stringify(evidence.bakeSupport.tangentBoundsKpc))
    throw new Error('Reconstructed star support differs from baked cloud geometry.');
  const parts = parseLabModelJson(buffers.parts.toString()).parts as {id:string}[];
  const declared = parts.map(p=>p.id).sort(), actual=cloud.parts.map(p=>p.id).sort();
  if (JSON.stringify(declared)!==JSON.stringify(actual)) throw new Error('Emitting part IDs differ from prepared cloud catalogue.');
  // Exact target orientation, luminance and normalization used by cloud-density-preparation.ts.
  const target=await sharp(buffers.target).flop().removeAlpha().raw().toBuffer({resolveWithObject:true});
  if(target.info.width!==photo.width || target.info.height!==photo.height || target.info.channels!==3)
    throw new Error('Integrated cloud target dimensions differ.');
  const signal=new Float32Array(target.info.width*target.info.height);
  for(let i=0;i<signal.length;i++) signal[i]=(target.data[3*i]*.2126+target.data[3*i+1]*.7152+target.data[3*i+2]*.0722)/255;
  const sampleSignal=createIntegratedSignalSampler({values:signal,width:target.info.width,height:target.info.height,
    bounds:mapping.boundsUnits,observerDistance:mapping.distanceUnits});
  const source=await loadVolumeSource(dirname(refs.recipe.path),parseLabModelJson(buffers.recipe.toString()));
  return { source, cloud, mapping, sampleSignal, recipe, provenance: { ...refs, photo:recipe.photo,
    grid:source.recipe.grid, stellarProvenance:source.recipe.provenance, channels:recipe.channels,
    integratedSignal:'The catalogue target.png unflopped, Rec.709 encoded RGB luminance, global maximum normalization; identical createIntegratedSignalSampler to cloud-density preparation.' } };
}
export type StarCloudModel = Awaited<ReturnType<typeof loadStarCloudModel>>;
