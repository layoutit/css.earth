import { implementationPins } from '@cssearth/nebula-lab/server/implementation';
import { parseLabModelJson } from '../../../resources/model-paths.ts';
/** Offline verified reconstruction context for cloud-conditioned catalogue depths. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import type { DensityVolumeFrame } from '@cssearth/objects';
import { loadVolumeSource } from '@cssearth/volume-bake/compact-inputs/density-grid';
import { createObservationMapping } from '../../../adapters/preparation/observation-prior.ts';
import { rectifyObservation } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-products';
import { decomposeFilledComponents } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-components';
import { createFilledVolumeSampler } from '@cssearth/nebula-reconstruction/methods/density-prior/filled-volume';
import { createIntegratedSignalSampler } from '@cssearth/bake/volume';

const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex');
type Pin = { path: string; sha256: string; url?: string };
async function pinned(pin: Pin) {
  let downloaded = false;
  const bytes = await readFile(pin.path).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT' || !pin.url) throw error;
    const response = await fetch(pin.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok) throw new Error(`Cloud source download failed: ${response.status}`);
    downloaded = true; return Buffer.from(await response.arrayBuffer());
  });
  if (sha256(bytes) !== pin.sha256) throw new Error(`Star cloud-model input pin changed: ${pin.path}`);
  if (downloaded) { await mkdir(dirname(pin.path), { recursive: true }); await writeFile(pin.path, bytes); }
  return bytes;
}
export async function loadStarCloudModel(frame: DensityVolumeFrame) {
  const manifest = parseLabModelJson(await readFile('labs/nebula/models/lmc/stars/source/catalogue.json', 'utf8'));
  const refs = manifest.depthModel;
  const buffers = Object.fromEntries(await Promise.all(Object.entries(refs).map(async ([key, value]) => [key, await pinned(value as Pin)])));
  const recipe = parseLabModelJson(buffers.cloudRecipe.toString()), evidence = parseLabModelJson(buffers.cloudProvenance.toString());
  const analysis = parseLabModelJson(buffers.analysis.toString()), object = parseLabModelJson(buffers.cloudObject.toString());
  if (object.properties.preparation.sha256 !== refs.cloudProvenance.sha256 || evidence.recipe.sha256 !== refs.cloudRecipe.sha256 ||
      analysis.prior.sha256 !== refs.prior.sha256 || recipe.stellarPrior.sha256 !== refs.recipe.sha256 ||
      recipe.stellarPrior.path !== refs.recipe.path) throw new Error('Cloud star model dependency pins disagree.');
  const stellarObject = parseLabModelJson(buffers.object.toString());
  if (stellarObject.properties.preparation.sha256 !== refs.recipe.sha256) throw new Error('Stellar object does not attest source density.');
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
  const implementation = Object.fromEntries((await implementationPins(process.cwd(), ['labs/nebula/packages/lab/src/server/workflows/stars/lmc-star-cloud-model.ts', 'labs/nebula/packages/lab/src/cli/commands/prepare-lmc-stars.ts'])).map(pin => [pin.path, pin.sha256]));
  return { source, cloud, mapping, sampleSignal, recipe, provenance: { ...refs, photo:recipe.photo, implementation,
    grid:source.recipe.grid, stellarProvenance:source.recipe.provenance, channels:recipe.channels,
    integratedSignal:'Pinned target.png unflopped, Rec.709 encoded RGB luminance, global maximum normalization; identical createIntegratedSignalSampler to cloud-density preparation.' } };
}
export type StarCloudModel = Awaited<ReturnType<typeof loadStarCloudModel>>;
