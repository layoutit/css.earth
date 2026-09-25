/** Bake a supplied neutral field and material sampler without owning scientific hypotheses. */
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {relative} from 'node:path';
import sharp from 'sharp';
import type {Bounds3,Vector3} from '@cssearth/volume-core/contracts/volume-recipe';
import type {DensityVolumeFrame} from '@cssearth/volume-core/contracts/volume-frame';
import type {VolumeSlices} from '@cssearth/volume-core/contracts/volume-slices';
import {containedPath,sourceBytes} from '../compact-inputs/density-grid.ts';
import { sha256 } from '@cssearth/core/node';
import {bakeMasterVolumeSlices} from './emission.ts';
import {recolorCloudSlices} from './material.ts';
import type {CompilerBakeBackend} from '../compiler/bake.ts';
export interface FieldPin {path:string;sha256:string}
export interface PaintedFieldProgress {phase:'volume'|'texture'|'compile'|'comparison';completed:number;total:number;message:string}
export interface PaintedFieldOptions {signal?:AbortSignal;onProgress?(progress:PaintedFieldProgress):void}
export interface PaintedFieldInput {
 root:string;outputDirectory:string;volumeId:string;frame:DensityVolumeFrame;bounds:Bounds3;
 sampleEmission(x:number,y:number,z:number,out:Vector3):void;
 sampleImageRgb(x:number,y:number,z:number,out:Vector3):boolean;
 exposure:number;sampling:{slices:{x:number;y:number;z:number};samples:number;width:number};provenance:Record<string,unknown>;
}
function cancellation(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Shape cloud preview cancelled.', 'AbortError');
}
async function writePin(root: string, path: string, bytes: Buffer): Promise<FieldPin> {
  await writeFile(containedPath(root, path), bytes);
  return { path, sha256: sha256(bytes) };
}
const json = (value: unknown) => Buffer.from(JSON.stringify(value) + '\n');

/** Raw alpha identity covers every slab, including fully empty slabs omitted from the render graph. */
async function inspectAlpha(directory: string, slices: VolumeSlices, options: PaintedFieldOptions, projection: boolean) {
  const digest = createHash('sha256'), zQuads = slices.quads.filter(quad => quad.axis === 'z');
  const first = zQuads[0]!;
  const transmission = projection ? new Float64Array(first.widthPx * first.heightPx).fill(1) : null;
  for (const quad of slices.quads) {
    cancellation(options.signal);
    const input = await sourceBytes(directory, { path: quad.texturePath });
    const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== quad.widthPx || info.height !== quad.heightPx || info.channels !== 4)
      throw new Error('Shape cloud alpha inspection found changed slice dimensions.');
    const alpha = Buffer.alloc(quad.widthPx * quad.heightPx);
    for (let index = 0; index < alpha.length; index++) {
      alpha[index] = data[4 * index + 3]!;
      if (quad.axis === 'z' && transmission) transmission[index]! *= 1 - alpha[index]! / 255;
    }
    digest.update(alpha);
  }
  let projectionPng: Buffer | undefined;
  if (transmission) {
    const rgba = Buffer.alloc(transmission.length * 4);
    for (let index = 0; index < transmission.length; index++) {
      const at = index * 4;
      rgba[at] = rgba[at + 1] = rgba[at + 2] = 255;
      rgba[at + 3] = Math.round((1 - transmission[index]!) * 255);
    }
    projectionPng = await sharp(rgba, { raw: { width: first.widthPx, height: first.heightPx, channels: 4 } }).png().toBuffer();
  }
  return { alphaSha256: digest.digest('hex'), projectionPng,
    projection: transmission ? { alpha: Float32Array.from(transmission, value => 1 - value), width: first.widthPx, height: first.heightPx } : undefined };
}

export async function bakePaintedField(input:PaintedFieldInput,backend:Pick<CompilerBakeBackend,'compileVolume'>,options:PaintedFieldOptions={}) {
 const {root,outputDirectory,sampling,provenance}=input,output=containedPath(root,outputDirectory);
 const total=sampling.slices.x+sampling.slices.y+sampling.slices.z;
 const result:{neutral?:FieldPin;textured?:FieldPin;projection?:FieldPin}={};
  await mkdir(output, { recursive: true });
  const neutralDirectory = containedPath(output, 'neutral'), texturedDirectory = containedPath(output, 'textured');
  const report = (phase: PaintedFieldProgress['phase'], completed: number, total: number, message: string) => {
    cancellation(options.signal); options.onProgress?.({ phase, completed, total, message });
  };
  report('volume', 0, total, 'Preparing the shared neutral shape cloud');
  let samples = 0;
  const { masters } = await bakeMasterVolumeSlices({ sampleEmission(x, y, z, out) {
    if (++samples % 65536 === 0) cancellation(options.signal);
    input.sampleEmission(x, y, z, out);
  }, boundsKpc: input.bounds, sliceCounts: sampling.slices, samplesPerSlab: sampling.samples,
  exposureGain: input.exposure, masterWidth: sampling.width, masterDirectory: neutralDirectory, deliveryBanks: [],
  unitsPerSourceUnit: 1, provenance, cropTransparent: false, allowEmpty: true,
  onProgress: progress => report('volume', progress.completed, progress.total, `Preparing ${progress.axis.toUpperCase()} cloud slabs`) });
  if (masters.quads.every(quad => quad.alphaCoverage === 0)) return {empty:true as const};
  const neutralAlpha = await inspectAlpha(neutralDirectory, masters, options, true);
  masters.provenance = { ...provenance, alphaSha256: neutralAlpha.alphaSha256 };
  await writeFile(containedPath(neutralDirectory, 'volume-slices.json'), json(masters));
  report('texture', 0, total, 'Painting source colors onto the same cloud');
  const painted = await recolorCloudSlices({ slices: masters, loadResource: path => readFile(containedPath(neutralDirectory, path)),
    sampleImageRgb: input.sampleImageRgb, outputDirectory: texturedDirectory, encoding: { format: 'png' },
    onProgress: progress => report('texture', progress.completed, progress.total, 'Painting source colors; preserving every alpha byte') });
  const texturedAlpha = await inspectAlpha(texturedDirectory, painted.slices, options, false);
  if (texturedAlpha.alphaSha256 !== neutralAlpha.alphaSha256) throw new Error('Textured shape cloud changed the neutral geometry alpha.');
  painted.slices.provenance = { ...provenance, alphaSha256: neutralAlpha.alphaSha256, material: painted.slices.provenance,
    coverage: painted.coverage };
  await writeFile(containedPath(texturedDirectory, 'volume-slices.json'), json(painted.slices));
  report('compile', 0, 2, 'Preparing the retained PolyCSS scene');
  for (const [index, [name, slices]] of ( [['neutral', masters], ['textured', painted.slices]] as const ).entries()) {
    cancellation(options.signal);
    const data = backend.compileVolume({ id: input.volumeId, frame:input.frame, slices });
    const path = relative(root, containedPath(output, `${name}/volume.json`));
    result[name] = await writePin(root, path, json(data));
    report('compile', index + 1, 2, 'Prepared cloud and texture share one geometry');
  }
  if (neutralAlpha.projectionPng) result.projection = await writePin(root, relative(root, containedPath(output, 'projection.png')), neutralAlpha.projectionPng);
  cancellation(options.signal);
 return {...result,empty:false as const,projectedAlpha:neutralAlpha.projection};
}
