/** Reproducible offline handoff from the two lab methods to the shared application volume capability. */
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { readCompilerRequest } from '../reconstruction/compiler/model.js';
import { compileNebula } from '../reconstruction/compiler/compile.js';
import { readCompilerResult } from '../reconstruction/compiler/result.js';
import { parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { validatePreparedCssVolume } from '../../../../src/renderers/css/volume/validation.js';
import { validatePreparedVolumeLenses } from '../../../../src/renderers/css/volume/prepared-volume-lenses.js';
import type { PreparedVolumeLens } from '../../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { embedNebulaFrame, embedNebulaVolume, reflectNebulaPoint, type NebulaSkyFrame } from './nebula-frame.js';
const sha = (v: Uint8Array | string) => createHash('sha256').update(v).digest('hex');
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected nebula delivery object.'); return v as Record<string, unknown>; };
const text = (v: unknown) => { if (typeof v !== 'string' || !v) throw new TypeError('Expected nebula delivery text.'); return v; };
const finite = (v: unknown) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Expected finite nebula delivery value.'); return v; };
function local(root: string, path: string): string {
  const target = resolve(root,path), rel = relative(root,target);
  if (isAbsolute(path) || rel === '..' || rel.startsWith(`..${sep}`) || /[\\\u0000]/.test(path)) throw new TypeError('Nebula resource escapes its owner.');
  return target;
}
async function read(root: string, path: string) { return JSON.parse(await readFile(local(root,path),'utf8')) as unknown; }
async function put(path: string, value: string | Uint8Array) { await mkdir(dirname(path),{ recursive:true }); await writeFile(path,value); }
interface Pin { path: string; sha256: string }
function pin(v: unknown): Pin {
  const p = record(v), path = text(p.path), sha256 = text(p.sha256);
  if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError('Invalid nebula source identity.');
  return { path,sha256 };
}
async function pinned(root: string, p: Pin) { const bytes = await readFile(local(root,p.path)); if (sha(bytes) !== p.sha256) throw new TypeError(`Nebula source hash mismatch: ${p.path}`); return bytes; }
export function readNebulaDelivery(v: unknown) {
  const r = record(v), frame = record(r.sky), center = frame.centerIcrsDegrees;
  if (r.schema !== 'cssearth-nebula-delivery@1' || !/^[a-z][a-z0-9-]*$/.test(text(r.id)) ||
      !['compiler','axial-symmetry'].includes(text(r.method)) || !Array.isArray(center) || center.length !== 2 || !Array.isArray(r.inputPins)) throw new TypeError('Invalid nebula delivery recipe.');
  if (!(finite(r.framingRadiusUnits)>0) || !/^https:\/\//.test(text(r.sourceUrl))) throw new TypeError('Invalid nebula framing/source URL.');
  const sky: NebulaSkyFrame = { centerIcrsDegrees: [finite(center[0]),finite(center[1])], distancePc: finite(frame.distancePc),
    imageRotationDegrees: finite(frame.imageRotationDegrees), arcsecPerUnit: finite(frame.arcsecPerUnit) };
  return { id: text(r.id), method: text(r.method), request: pin(r.request), inputPins: r.inputPins.map(pin), sky,
    sourceUrl: text(r.sourceUrl), description: text(r.description), defaultLens: text(r.defaultLens),
    framingRadiusUnits: finite(r.framingRadiusUnits), acceptedLabResult: text(r.acceptedLabResult),
    ...(r.symmetryDirectory === undefined ? {} : { symmetryDirectory: text(r.symmetryDirectory) }) };
}
async function symmetry(root: string, recipePath: string) {
  await new Promise<void>((accept,reject) => {
    const child = spawn(process.execPath,['--experimental-strip-types','labs/nebula/src/run.ts','prepare-emission',recipePath],{cwd:root,stdio:['ignore','pipe','inherit']});
    let completed = false;
    child.stdout.on('data',(b:Buffer) => { const line = b.toString(); if (line.includes('EMISSION_COMPLETE')) completed = true; process.stdout.write(line); });
    child.on('error',reject); child.on('close',code => code === 0 && completed ? accept() : reject(new Error('Symmetry preparation did not finish.')));
  });
}
/** Validate every installed resource before reusing the bank; missing files rebuild, drift fails. */
async function installed(directory: string, recipeSha256: string, implementationSha256: string): Promise<boolean> {
  try {
    const receipt = record(await read(directory,'prepared/delivery.json'));
    if (receipt.recipeSha256 !== recipeSha256 || receipt.implementationSha256 !== implementationSha256) return false;
    const descriptor = record(await read(directory,'object.json')), prepared = pin({ path:record(descriptor.prepared).url,sha256:record(descriptor.prepared).sha256 });
    const envelope = record(JSON.parse((await pinned(directory,prepared)).toString())), data = validatePreparedVolumeLenses(envelope.data);
    for (const lens of data.lenses) for (const resource of lens.volume.resources) await pinned(directory,{path:`prepared/${resource.path}`,sha256:resource.sha256});
    return true;
  } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
export async function prepareNebulaObject(root: string, directory: string, ifMissing = false) {
  const recipeBytes = await readFile(local(directory,'source/delivery.json')), recipe = readNebulaDelivery(JSON.parse(recipeBytes.toString()));
  const catalogue = parsePreparedNebulaCatalog(await read(directory,'source/nebula.json'));
  if (catalogue.objects.length !== 1 || catalogue.objects[0]!.id !== recipe.id ||
      catalogue.objects[0]!.distance.valuePc !== recipe.sky.distancePc ||
      catalogue.objects[0]!.skyPosition.raDeg !== recipe.sky.centerIcrsDegrees[0] ||
      catalogue.objects[0]!.skyPosition.decDeg !== recipe.sky.centerIcrsDegrees[1]) throw new TypeError('Nebula catalogue and delivery identity/sky frame differ.');
  for (const input of [recipe.request,...recipe.inputPins]) await pinned(root,input);
  const implementationSha256 = sha(Buffer.concat(await Promise.all(['nebula-objects.ts','nebula-frame.ts'].map(name=>readFile(local(root,`labs/nebula/src/delivery/${name}`))))));
  if (ifMissing && await installed(directory,sha(recipeBytes),implementationSha256)) return { id:recipe.id,status:'verified' };
  const staging = resolve(directory,`.prepared-${process.pid}`); await mkdir(staging,{recursive:true});
  const lenses: PreparedVolumeLens[] = []; let sourceResult = recipe.acceptedLabResult;
  try {
    const add = async (id: string,label: string,sourceUrl: string,volumePath: string,volumeSha: string,
      frame: ReturnType<typeof embedNebulaFrame>,stars: PreparedVolumeLens['stars']) => {
      const raw = record(JSON.parse((await pinned(root,{path:volumePath,sha256:volumeSha})).toString()));
      const volume = validatePreparedCssVolume(raw.data ?? raw);
      for (const resource of volume.resources) {
        const bytes = await pinned(dirname(local(root,volumePath)),{path:resource.path,sha256:resource.sha256});
        await put(resolve(staging,id,resource.path),bytes);
      }
      lenses.push({ id,label,title:label,sourceUrl,description:recipe.description,
        volume:embedNebulaVolume(volume,frame,`${recipe.id}-${id}`,id),stars,brightness:{overall:1,x:1,y:1,z:1} });
    };
    if (recipe.method === 'compiler') {
      const request = readCompilerRequest(JSON.parse((await pinned(root,recipe.request)).toString()));
      let lastMessage = '', lastProgress = 0;
      const result = readCompilerResult(await compileNebula(root,request,new AbortController().signal,(message,fraction) => {
        if (message !== lastMessage || Date.now()-lastProgress > 5000) {
          console.log(`${recipe.id} ${Math.round((fraction??0)*100)}% ${message}`); lastMessage=message; lastProgress=Date.now();
        }
      }));
      sourceResult = result.id;
      const frame = embedNebulaFrame(result.scene.frame,recipe.sky,result.scene.coordinates.localOriginArcsec);
      for (const lens of result.scene.lenses) {
        const source = result.sources.find(source => source.id === lens.id)!;
        const points = result.scene.stars.map(star => {
          const material = star.materials?.[lens.id] ?? star;
          return { id:star.id,positionUnits:reflectNebulaPoint(star.positionUnits),
            colorCss:`#${material.rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`,
            opacity:material.alpha,sizePx:star.widthPx??1,...(material.diameterUnits === undefined?{}:{diameterUnits:material.diameterUnits}) };
        });
        await add(lens.id,lens.label,source.page,lens.volume.path,lens.volume.sha256,frame,{frame,points});
      }
    } else {
      if (!recipe.symmetryDirectory) throw new TypeError('Missing symmetry output owner.');
      const target = local(root,recipe.symmetryDirectory);
      try {
        const existing = record(await read(target,'prepared/volume.json')), prepared = validatePreparedCssVolume(existing.data);
        for (const resource of prepared.resources) await pinned(target,{path:`prepared/${resource.path}`,sha256:resource.sha256});
      } catch(error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
        await symmetry(root,recipe.request.path);
      }
      const descriptor = record(await read(target,'object.json')), identity = record(descriptor.properties), sourcePin = record(identity.preparation);
      const preparedPin = pin({path:record(descriptor.prepared).url,sha256:record(descriptor.prepared).sha256});
      const prepared = record(JSON.parse((await pinned(target,preparedPin)).toString())), volume = validatePreparedCssVolume(prepared.data);
      if (sourcePin.sha256 !== recipe.request.sha256) throw new TypeError('Symmetry output belongs to another recipe.');
      const frame = embedNebulaFrame(volume.frame,recipe.sky);
      // The accepted symmetry baseline has no measured point catalogue; do not fabricate one.
      await add(recipe.defaultLens,'Hubble · optical',recipe.sourceUrl,`${recipe.symmetryDirectory}/${preparedPin.path}`,preparedPin.sha256,frame,{frame,points:[]});
    }
    const data = validatePreparedVolumeLenses({schema:'cssearth-volume-lenses@1',id:recipe.id,defaultLens:recipe.defaultLens,
      framingRadiusUnits:recipe.framingRadiusUnits,contextVisibility:'independent',starsEnabled:lenses[0]!.stars.points.length>0,lenses});
    const envelope = json({schema:'cssearth-prepared-object@1',id:recipe.id,type:'volume-lens-bank',format:'cssearth-volume-lenses@1',data});
    await put(resolve(staging,'lenses.json'),envelope);
    await put(resolve(staging,'delivery.json'),json({schema:'cssearth-nebula-delivery-receipt@1',recipeSha256:sha(recipeBytes),implementationSha256,sourceResult,
      acceptedLabResult:recipe.acceptedLabResult,lenses:lenses.map(l=>({id:l.id,stars:l.stars.points.length,leaves:l.volume.resources.length}))}));
    // Install complete generated files only. Authored source inputs stay untouched.
    await mkdir(resolve(directory,'prepared'),{recursive:true});
    for (const entry of await readdir(staging)) { await rm(resolve(directory,'prepared',entry),{recursive:true,force:true}); await rename(resolve(staging,entry),resolve(directory,'prepared',entry)); }
    await put(resolve(directory,'object.json'),json({schema:'cssearth-object@1',id:recipe.id,type:'volume-lens-bank',properties:{frame:lenses[0]!.volume.frame,
      preparation:{source:'source/delivery.json',sha256:sha(recipeBytes)}},prepared:{format:'cssearth-volume-lenses@1',url:'prepared/lenses.json',sha256:sha(envelope)}}));
    return { id:recipe.id,status:'prepared',sourceResult,lenses:lenses.map(l=>({id:l.id,stars:l.stars.points.length,leaves:l.volume.resources.length})) };
  } finally { await rm(staging,{recursive:true,force:true}); }
}
