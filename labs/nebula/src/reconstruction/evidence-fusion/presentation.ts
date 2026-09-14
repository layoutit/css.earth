/** Node-only evidence presentation: the browser receives decoded prepared rasters. */
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { prepareEvidenceInputs } from './provider';
import { combineEvidence } from './combine';
import { geometrySha, readGeometryPin } from '../geometry/registered-source';
import { FUSION_VERSION, readFusionResult, type FusionAsset, type FusionRequest, type FusionResult } from './jobs-model';
const palette = ['#69d4a5','#ba97f2','#f3b669','#66b8ec','#ee9cac','#e0d282','#83d9d7','#b7c783'];
export async function validateFusionResult(root: string, value: unknown) {
  const result = readFusionResult(value);
  for (const asset of [result.union,result.colors,result.agreement,result.samples,...result.sources.flatMap(s => [s.source,s.evidence])]) await readGeometryPin(root, asset);
  return result;
}
export async function prepareFusionPresentation(root: string, request: FusionRequest, signal: AbortSignal, progress: (message: string) => void): Promise<FusionResult> {
  signal.throwIfAborted(); progress('Loading aligned multiscale evidence…');
  const inputs = await prepareEvidenceInputs(root, request.cataloguePath, { imageToFrame: request.imageToFrame });
  const owner = geometrySha(await readFile(resolve(root,'labs/nebula/src/reconstruction/evidence-fusion/presentation.ts')));
  const id = geometrySha(JSON.stringify({ input: inputs.identity, version: FUSION_VERSION, owner, settings: request.settings }));
  const directory = `.local/nebula-lab/evidence-fusion/results/${id}`, receipt = resolve(root,directory,'result.json');
  try { return await validateFusionResult(root, JSON.parse(await readFile(receipt,'utf8'))); }
  catch (error) { if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT')) throw error; }
  signal.throwIfAborted(); progress('Combining features across observations…');
  const combined = combineEvidence(inputs, request.settings), { width, height } = combined, pixels = width * height;
  await mkdir(resolve(root,directory), { recursive: true });
  async function save(name: string, bytes: Uint8Array): Promise<FusionAsset> {
    signal.throwIfAborted(); const path = `${directory}/${name}`, target = resolve(root,path);
    await writeFile(`${target}.pending`,bytes); await rename(`${target}.pending`,target); return { path, sha256: geometrySha(bytes) };
  }
  async function rgba(name: string, bytes: Uint8Array) {
    return save(name, await sharp(bytes,{ raw: { width,height,channels: 4 } }).png().toBuffer());
  }
  function layer(values: Float32Array, color = '#eeeeee') {
    const rgb = [1,3,5].map(offset => parseInt(color.slice(offset,offset+2),16)), out = new Uint8Array(pixels*4);
    for(let p=0;p<pixels;p++) { out[p*4]=rgb[0]!;out[p*4+1]=rgb[1]!;out[p*4+2]=rgb[2]!;out[p*4+3]=Math.round(values[p]! *255); }
    return out;
  }
  const sources: FusionResult['sources'] = [];
  for(let i=0;i<inputs.sources.length;i++) {
    const source = inputs.sources[i]!, color = palette[i%palette.length]!;
    sources.push({ id: source.id, label: source.label, color, source: await rgba(`source-${i}.png`,source.registeredRgba), evidence: await rgba(`evidence-${i}.png`,layer(combined.planes[i]!,color)) });
  }
  const colors = new Uint8Array(pixels*4), sampleBytes = new Uint8Array(pixels*(sources.length*2+2));
  const colorsRgb = sources.map(s=>[1,3,5].map(offset=>parseInt(s.color.slice(offset,offset+2),16)));
  for(let p=0;p<pixels;p++) {
    let sum=0;const rgb=[0,0,0];const offset=p*(sources.length*2+2);
    for(let i=0;i<sources.length;i++) {
      const value=combined.planes[i]![p]!;sum+=value;
      for(let c=0;c<3;c++) rgb[c]!+=colorsRgb[i]![c]!*value;
      sampleBytes[offset+i*2]=combined.coverage[i]![p]!;sampleBytes[offset+i*2+1]=Math.round(value*255);
    }
    for(let c=0;c<3;c++) colors[p*4+c]=sum>0?Math.round(rgb[c]!/sum):0;
    colors[p*4+3]=Math.round(combined.union[p]!*255);
    sampleBytes[offset+sources.length*2]=Math.round(combined.union[p]!*255);
    sampleBytes[offset+sources.length*2+1]=Math.round(combined.agreement[p]!*255);
  }
  progress('Saving registered comparison layers…');
  const result: FusionResult = { schema:'cssearth-joint-evidence@1',id,preparationVersion:FUSION_VERSION,inputIdentity:inputs.identity,width,height,settings:request.settings,sources,
    union:await rgba('union.png',layer(combined.union)),agreement:await rgba('agreement.png',layer(combined.agreement)),colors:await rgba('colors.png',colors),samples:await save('samples.bin',sampleBytes) };
  await save('method.json',Buffer.from(JSON.stringify({ inputIdentity:inputs.identity,grid:inputs.grid,method:inputs.method,sources:inputs.sources.map(s=>({id:s.id,sourceSha256:s.sourceSha256,mapSha256:s.mapSha256,sourcePanelSha256:s.sourcePanelSha256,imageToFrame:s.imageToFrame})) },null,2)));
  signal.throwIfAborted(); await save('result.json',Buffer.from(JSON.stringify(result,null,2)+'\n')); return result;
}
