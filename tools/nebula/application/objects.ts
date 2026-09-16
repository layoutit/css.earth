import { packageImplementationPins } from './package-identity.ts';
import { nebulaBakeBackend } from './backend.ts';
import { verifyReplayReferences } from './references.ts';
import type { CompilerBakeResult } from '@cssearth/volume-core/contracts/compiler-bake';
import type { DensityVolumeFrame } from '@cssearth/volume-core/contracts/volume-frame';
/** Reproducible offline handoff from the two lab methods to the shared application volume capability. */
import { replayCompactCompiler } from '@cssearth/volume-bake/compact-inputs/compiler';
import { replayCompactSymmetry } from '@cssearth/volume-bake/compact-inputs/symmetry';
import { replayCompactSampled } from '@cssearth/volume-bake/compact-inputs/sampled';
import { sha256 } from '../../../src/platform/sha256.mts';
import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { prepareNebulaCatalogueField } from './catalogue-field.ts';
import { parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { validatePreparedCssVolume } from '../../../src/renderers/css/volume/validation.js';
import { validatePreparedVolumeLenses } from '../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { prepareVolumeAtlases } from '../../../src/preparation/volume/atlas.js';
import { prepareVolumeImpostors } from '../../../src/renderers/css/preparation/volume-impostors.js';
import type { PreparedVolumeLens } from '../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { embedNebulaFrame, embedNebulaVolume, reflectNebulaPoint, type NebulaSkyFrame } from './nebula-frame.ts';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected nebula delivery object.'); return v as Record<string, unknown>; };
const text = (v: unknown) => { if (typeof v !== 'string' || !v) throw new TypeError('Expected nebula delivery text.'); return v; };
const finite = (v: unknown) => { if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError('Expected finite nebula delivery value.'); return v; };
// Prepared pixels and their contract must invalidate a previously installed handoff together.
const implementationFiles = [
  'tools/nebula/application/package-identity.ts', 'tools/nebula/application/objects.ts', 'tools/nebula/application/backend.ts',
  'tools/nebula/application/references.ts', 'tools/nebula/application/nebula-frame.ts',
  'tools/nebula/application/star-sprites.ts', 'tools/nebula/application/fits.ts',
  'src/preparation/volume/atlas.ts', 'src/renderers/css/preparation/volume.ts',
  'src/renderers/css/preparation/volume-order.ts', 'src/renderers/css/preparation/volume-impostors.ts',
  'src/renderers/css/volume/types.ts', 'src/renderers/css/volume/validation.ts',
  'src/renderers/css/volume/volume-impostor-validation.ts', 'src/renderers/css/volume/prepared-volume-lenses.ts',
];
export interface NebulaResearchBackend {
  compiler(root: string, recipe: ReturnType<typeof readNebulaDelivery>, progress: (message: string, fraction?: number) => void): Promise<{
    id: string; scene: CompilerBakeResult; sources: {id: string; label: string; credit: string; page: string}[];
  }>;
  symmetry(root: string, recipe: ReturnType<typeof readNebulaDelivery>): Promise<{ path: string; sha256: string; frame: DensityVolumeFrame }>;
}
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
async function pinned(root: string, p: Pin) { const bytes = await readFile(local(root,p.path)); if (sha256(bytes) !== p.sha256) throw new TypeError(`Nebula source hash mismatch: ${p.path}`); return bytes; }
export function readNebulaDelivery(v: unknown) {
  const r = record(v), frame = record(r.sky), center = frame.centerIcrsDegrees;
  if (r.schema !== 'cssearth-nebula-delivery@1' || !/^[a-z][a-z0-9-]*$/.test(text(r.id)) ||
      !['compiler','axial-symmetry'].includes(text(r.method)) || !Array.isArray(center) || center.length !== 2 || !Array.isArray(r.inputPins)) throw new TypeError('Invalid nebula delivery recipe.');
  if (!(finite(r.framingRadiusUnits)>0) || !/^https:\/\//.test(text(r.sourceUrl))) throw new TypeError('Invalid nebula framing/source URL.');
  if (r.compositeRecipe !== undefined && r.method !== 'compiler') throw new TypeError('Optical composite requires compiler delivery.');
  if (r.compactInputs !== undefined && !['compiler','sampled','symmetry'].includes(text(r.compactMethod))) throw new TypeError('Invalid compact bake method.');
  if (r.compactInputs !== undefined && ((r.compactMethod === 'symmetry') !== (r.method === 'axial-symmetry'))) throw new TypeError('Compact method and delivery method differ.');
  const sky: NebulaSkyFrame = { centerIcrsDegrees: [finite(center[0]),finite(center[1])], distancePc: finite(frame.distancePc),
    imageRotationDegrees: finite(frame.imageRotationDegrees), arcsecPerUnit: finite(frame.arcsecPerUnit) };
  return { id: text(r.id), method: text(r.method), request: pin(r.request), inputPins: r.inputPins.map(pin), sky,
    sourceUrl: text(r.sourceUrl), description: text(r.description), defaultLens: text(r.defaultLens),
    framingRadiusUnits: finite(r.framingRadiusUnits), acceptedLabResult: text(r.acceptedLabResult),
    ...(r.compactInputs === undefined ? {} : { compactInputs: pin(r.compactInputs), compactMethod: text(r.compactMethod) }),
    ...(r.compositeRecipe === undefined ? {} : { compositeRecipe: pin(r.compositeRecipe) }),
    ...(r.fieldStars === undefined ? {} : { fieldStars: pin(r.fieldStars) }),
    ...(r.symmetryDirectory === undefined ? {} : { symmetryDirectory: text(r.symmetryDirectory) }) };
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
export async function prepareNebulaObject(root: string, directory: string, ifMissing = false, research?: NebulaResearchBackend) {
  const recipeBytes = await readFile(local(directory,'source/delivery.json')), recipe = readNebulaDelivery(JSON.parse(recipeBytes.toString()));
  const catalogue = parsePreparedNebulaCatalog(await read(directory,'source/nebula.json'));
  if (catalogue.objects.length !== 1 || catalogue.objects[0]!.id !== recipe.id ||
      catalogue.objects[0]!.distance.valuePc !== recipe.sky.distancePc ||
      catalogue.objects[0]!.skyPosition.raDeg !== recipe.sky.centerIcrsDegrees[0] ||
      catalogue.objects[0]!.skyPosition.decDeg !== recipe.sky.centerIcrsDegrees[1]) throw new TypeError('Nebula catalogue and delivery identity/sky frame differ.');
  if (research) {
    for (const input of [recipe.request,...recipe.inputPins,...(recipe.compositeRecipe ? [recipe.compositeRecipe] : [])]) await pinned(root,input);
  } else {
    if (!recipe.compactInputs) throw new TypeError('Default nebula preparation requires compact inputs; use the explicit research workflow to export them.');
    await verifyReplayReferences(root, directory, [recipe.request,...recipe.inputPins,...(recipe.compositeRecipe ? [recipe.compositeRecipe] : [])]);
  }
  for (const input of [...(recipe.fieldStars ? [recipe.fieldStars] : []), ...(recipe.compactInputs ? [recipe.compactInputs] : [])]) await pinned(root,input);
  const owners = [...implementationFiles, ...(recipe.fieldStars ? ['tools/nebula/application/catalogue-field.ts',
    'src/renderers/css/navigation/world-camera-math.ts', 'src/renderers/css/stars/prepared-catalogue-points.ts'] : [])];
  // Package inventories define numerical owners without exposing their installation layout.
  const packagePins = await packageImplementationPins(root, ['@cssearth/volume-core', '@cssearth/volume-bake']);
  const implementationSha256 = sha256(json([...await Promise.all(owners.map(async path => ({path,sha256:sha256(await readFile(local(root,path)))}))), ...packagePins]));
  if (ifMissing && await installed(directory,sha256(recipeBytes),implementationSha256)) return { id:recipe.id,status:'verified' };
  const staging = resolve(directory,`.prepared-${process.pid}`); await mkdir(staging,{recursive:true});
  const lenses: PreparedVolumeLens[] = []; let sourceResult = recipe.acceptedLabResult;
  let fieldStars: Awaited<ReturnType<typeof prepareNebulaCatalogueField>>['receipt'] | undefined;
  try {
    const add = async (id: string,label: string,sourceUrl: string,volumePath: string,volumeSha: string,
      frame: ReturnType<typeof embedNebulaFrame>,stars: PreparedVolumeLens['stars'],anchorPoints?: PreparedVolumeLens['stars']['points']) => {
      const raw = record(JSON.parse((await pinned(root,{path:volumePath,sha256:volumeSha})).toString()));
      const volume = validatePreparedCssVolume(raw.data ?? raw);
      for (const resource of volume.resources) {
        const bytes = await pinned(dirname(local(root,volumePath)),{path:resource.path,sha256:resource.sha256});
        await put(local(staging,`${id}/${resource.path}`),bytes);
      }
      const brightness: PreparedVolumeLens['brightness'] = {overall:1,x:1,y:1,z:1};
      const projected = await prepareVolumeImpostors({
        volume:embedNebulaVolume(volume,frame,`${recipe.id}-${id}`,id),brightness,prefix:`${id}/impostors`,
        readResource:path=>readFile(local(staging,path)),
        writeResource:(path,bytes)=>put(local(staging,path),bytes),
      });
      const prepared = await prepareVolumeAtlases({volume:projected,prefix:`${id}/atlases`,
        readResource:path=>readFile(local(staging,path)),writeResource:(path,bytes)=>put(local(staging,path),bytes)});
      for (const resource of volume.resources) await rm(local(staging,`${id}/${resource.path}`));
      if (recipe.fieldStars) {
        const field = await prepareNebulaCatalogueField(root,recipe.fieldStars,frame,stars.points,anchorPoints);
        if (field.receipt.id !== recipe.id) throw new TypeError('Catalogue field and nebula delivery identities differ.');
        stars = {frame,points:field.points}; fieldStars = field.receipt;
      }
      lenses.push({ id,label,title:label,sourceUrl,description:recipe.description,
        volume:prepared,stars,brightness });
    };
    if (recipe.method === 'compiler') {
      const progress = (message: string, fraction?: number) => {
        if (message !== lastMessage || Date.now()-lastProgress > 5000) {
          console.log(`${recipe.id} ${Math.round((fraction??0)*100)}% ${message}`); lastMessage=message; lastProgress=Date.now();
        }
      };
      let lastMessage = '', lastProgress = 0;
      const prepareResult = async () => {
        if (recipe.compactInputs && !research) {
          const output = resolve(staging, 'compact');
          // Replay selects a saved model method, never an object identity.
          return recipe.compactMethod === 'sampled'
            ? replayCompactSampled(root, recipe.compactInputs, relative(root, output), nebulaBakeBackend)
            : replayCompactCompiler(root, recipe.compactInputs, relative(root, output), nebulaBakeBackend, event => progress(event.message, event.completed / event.total));
        }
        if (!research) throw new TypeError('Research backend is unavailable.');
        return research.compiler(root, recipe, progress);
      };
      const result = await prepareResult();
      if ('objectId' in result && result.objectId !== recipe.id) throw new TypeError('Compact input belongs to another object.');
      sourceResult = result.id;
      const frame = embedNebulaFrame(result.scene.frame,recipe.sky,result.scene.coordinates.localOriginArcsec);
      const anchorPoints = result.scene.stars.map(star => ({id:star.id,positionUnits:reflectNebulaPoint(star.positionUnits),
        colorCss:`#${star.rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`,opacity:star.alpha,sizePx:star.widthPx??1,
        ...(star.diameterUnits === undefined?{}:{diameterUnits:star.diameterUnits})}));
      for (const lens of result.scene.lenses) {
        const source = result.sources.find(source => source.id === lens.id)!;
        const points = result.scene.stars.map(star => {
          const material = star.materials?.[lens.id] ?? star;
          return { id:star.id,positionUnits:reflectNebulaPoint(star.positionUnits),
            colorCss:`#${material.rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`,
            opacity:material.alpha,sizePx:star.widthPx??1,...(material.diameterUnits === undefined?{}:{diameterUnits:material.diameterUnits}) };
        });
        await add(lens.id,lens.label,source.page,lens.volume.path,lens.volume.sha256,frame,{frame,points},anchorPoints);
      }
    } else if (recipe.compactInputs && !research) {
      const result = await replayCompactSymmetry(root, recipe.compactInputs, relative(root, resolve(staging, 'compact')), nebulaBakeBackend);
      const frame = embedNebulaFrame(result.frame, recipe.sky);
      await add(recipe.defaultLens, 'Hubble · optical', recipe.sourceUrl, result.pin.path, result.pin.sha256, frame, { frame, points: [] });
    } else {
      if (!research) throw new TypeError('Research backend is unavailable.');
      const result = await research.symmetry(root, recipe);
      const frame = embedNebulaFrame(result.frame,recipe.sky);
      await add(recipe.defaultLens,'Hubble · optical',recipe.sourceUrl,result.path,result.sha256,frame,{frame,points:[]});
    }
    await rm(resolve(staging, 'compact'), { recursive: true, force: true });
    const data = validatePreparedVolumeLenses({schema:'cssearth-volume-lenses@1',id:recipe.id,defaultLens:recipe.defaultLens,
      framingRadiusUnits:recipe.framingRadiusUnits,contextVisibility:'independent',starsEnabled:lenses[0]!.stars.points.length>0,lenses});
    const envelope = json({schema:'cssearth-prepared-object@1',id:recipe.id,type:'volume-lens-bank',format:'cssearth-volume-lenses@1',data});
    await put(resolve(staging,'lenses.json'),envelope);
    await put(resolve(staging,'delivery.json'),json({schema:'cssearth-nebula-delivery-receipt@1',recipeSha256:sha256(recipeBytes),implementationSha256,sourceResult,
      acceptedLabResult:recipe.acceptedLabResult,...(fieldStars ? {fieldStars} : {}),
      lenses:lenses.map(l=>({id:l.id,stars:l.stars.points.length,leaves:l.volume.resources.length}))}));
    // Install complete generated files only. Authored source inputs stay untouched.
    await mkdir(resolve(directory,'prepared'),{recursive:true});
    for (const entry of await readdir(staging)) { await rm(resolve(directory,'prepared',entry),{recursive:true,force:true}); await rename(resolve(staging,entry),resolve(directory,'prepared',entry)); }
    await put(resolve(directory,'object.json'),json({schema:'cssearth-object@1',id:recipe.id,type:'volume-lens-bank',properties:{frame:lenses[0]!.volume.frame,
      preparation:{source:'source/delivery.json',sha256:sha256(recipeBytes)}},prepared:{format:'cssearth-volume-lenses@1',url:'prepared/lenses.json',sha256:sha256(envelope)}}));
    return { id:recipe.id,status:'prepared',sourceResult,lenses:lenses.map(l=>({id:l.id,stars:l.stars.points.length,leaves:l.volume.resources.length})) };
  } finally { await rm(staging,{recursive:true,force:true}); }
}
