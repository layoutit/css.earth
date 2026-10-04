/** Reproducible offline handoff from the two lab methods to the shared application volume capability. */
import { OBJECT_SCHEMA, PREPARED_OBJECT_SCHEMA, DENSITY_VOLUME_FORMAT, PREPARED_VOLUME_DATASETS_SCHEMA, parseVolumeRecipe, type CompilerBakeResult, type DensityVolumeFrame, validatePreparedCssVolume, validatePreparedVolumeDatasets, type PreparedVolumeDataset, parsePreparedNebulaCatalog, readNebulaDelivery, type NebulaSkyFrame } from '@cssearth/objects';
import { nebulaBakeBackend } from './backend.ts';
import { verifyReplayReferences } from './references.ts';

import { replayCompactCompiler, replayCompactSymmetry, replayCompactSampled, prepareVolumeSlices } from '../volume/node/index.ts';
import { compileCssVolume, prepareVolumeImpostors } from '../volume-leaves/index.ts';
import { readFile, writeFile, mkdir, readdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { prepareNebulaCatalogueField } from './catalogue-field.ts';

import { prepareVolumeAtlases } from '../density/index.ts';

import { embedNebulaFrame, embedNebulaVolume, reflectNebulaPoint } from './nebula-frame.ts';
import { sanitizeVolumeProvenance } from './volume-provenance.ts';
import { assertCompilerDeliveryElementBudget } from './element-budget.ts';
const json = (v: unknown) => JSON.stringify(v, null, 2) + '\n';
const record = (v: unknown): Record<string, unknown> => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new TypeError('Expected nebula delivery object.'); return v as Record<string, unknown>; };
const text = (v: unknown) => { if (typeof v !== 'string' || !v) throw new TypeError('Expected nebula delivery text.'); return v; };
export interface NebulaResearchBackend {
  compiler(root: string, recipe: ReturnType<typeof readNebulaDelivery>, progress: (message: string, fraction?: number) => void): Promise<{
    id: string; scene: CompilerBakeResult; sources: {id: string; label: string; credit: string; page: string}[];
  }>;
  symmetry(root: string, recipe: ReturnType<typeof readNebulaDelivery>): Promise<{ path: string; frame: DensityVolumeFrame }>;
}
function local(root: string, path: string): string {
  const target = resolve(root,path), rel = relative(root,target);
  if (isAbsolute(path) || rel === '..' || rel.startsWith(`..${sep}`) || /[\\\u0000]/.test(path)) throw new TypeError('Nebula resource escapes its owner.');
  return target;
}
async function read(root: string, path: string) { return JSON.parse(await readFile(local(root,path),'utf8')) as unknown; }
async function put(path: string, value: string | Uint8Array) { await mkdir(dirname(path),{ recursive:true }); await writeFile(path,value); }
interface CompilerPin { path: string }
function pin(v: unknown): CompilerPin {
  const p = record(v), path = text(p.path);
  return { path };
}
async function pinned(root: string, p: CompilerPin) { const bytes = await readFile(local(root,p.path)); return bytes; }
/** Reuse an installed bank only when its receipt records the current recipe and its descriptor and every resource it
 * names are present. The receipt keeps the whole recipe, so a changed recipe is compared, not trusted. */
async function installed(directory: string, recipe: unknown): Promise<boolean> {
  try {
    if (!isDeepStrictEqual(record(await read(directory,'prepared/delivery.json')).recipe, recipe)) return false;
    const descriptor = record(await read(directory,'object.json')), prepared = pin({ path:record(descriptor.prepared).url });
    const envelope = record(JSON.parse((await pinned(directory,prepared)).toString())), data = validatePreparedVolumeDatasets(envelope.data);
    for (const dataset of data.datasets) for (const resource of dataset.volume.resources) await pinned(directory,{path:`prepared/${resource.path}`});
    return true;
  } catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return false; throw error; }
}
export async function prepareNebulaObject(root: string, directory: string, ifMissing = false, research?: NebulaResearchBackend, allowMissing = false) {
  const recipeBytes = await readFile(local(directory,'source/delivery.json')), recipe = readNebulaDelivery(JSON.parse(recipeBytes.toString()));
  // A volume that belongs to a body it surrounds is not a place of its own: it has no catalogue entry, so it never
  // becomes a map marker, a search result or a destination. Only a free-standing cloud registers itself.
  const catalogueBytes = await readFile(local(directory,'source/nebula.json')).catch((error: unknown) => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
    throw error;
  });
  if (catalogueBytes === null && recipe.attachedTo === undefined) throw new TypeError('A nebula delivery without a catalogue entry names the body it attaches to.');
  if (catalogueBytes !== null) {
    const catalogue = parsePreparedNebulaCatalog(JSON.parse(catalogueBytes.toString()) as unknown);
    // The catalogue row names the nebula; the package it details to is this delivery's bank.
    if (catalogue.objects.length !== 1 || catalogue.objects[0]!.detailedObjectId !== recipe.id ||
        catalogue.objects[0]!.distance.valuePc !== recipe.sky.distancePc ||
        catalogue.objects[0]!.skyPosition.raDeg !== recipe.sky.centerIcrsDegrees[0] ||
        catalogue.objects[0]!.skyPosition.decDeg !== recipe.sky.centerIcrsDegrees[1]) throw new TypeError('Nebula catalogue and delivery identity/sky frame differ.');
  }
  if (research) {
    for (const input of [recipe.request,...recipe.inputPins,...(recipe.compositeRecipe ? [recipe.compositeRecipe] : [])]) await pinned(root,input);
  } else {
    if (!recipe.compactInputs) throw new TypeError('Default nebula preparation requires compact inputs; use the explicit research workflow to export them.');
    await verifyReplayReferences(root, directory, [recipe.request,...recipe.inputPins,...(recipe.compositeRecipe ? [recipe.compositeRecipe] : [])]);
  }
  for (const input of [...(recipe.fieldStars ? [recipe.fieldStars] : []), ...(recipe.compactInputs ? [recipe.compactInputs] : [])]) await pinned(root,input);
  if (ifMissing && await installed(directory, JSON.parse(recipeBytes.toString()))) return { id:recipe.id,status:'verified' };
  // Deploy builds may tolerate a package missing from R2 instead of baking one from scratch here (no source
  // acquisition service runs at build time): report it unavailable and move on, loudly.
  if (allowMissing) {
    console.warn(`Prepared package unavailable for ${recipe.id}; not baking a replacement (allow-missing). It will report unavailable.`);
    return { id: recipe.id, status: 'unavailable' };
  }
  const staging = resolve(directory,`.prepared-${process.pid}`); await mkdir(staging,{recursive:true});
  const datasets: PreparedVolumeDataset[] = []; let sourceResult = recipe.acceptedLabResult;
  let compilerSampling: CompilerBakeResult['sampling'] | undefined;
  let fieldStars: Awaited<ReturnType<typeof prepareNebulaCatalogueField>>['receipt'] | undefined;
  try {
    const add = async (id: string,label: string,sourceUrl: string,volumePath: string,
      frame: ReturnType<typeof embedNebulaFrame>,stars: PreparedVolumeDataset['stars'],anchorPoints?: PreparedVolumeDataset['stars']['points'],
      occultingCentreUnits?: readonly [number,number,number]) => {
      const raw = record(JSON.parse((await pinned(root,{path:volumePath})).toString()));
      const volume = sanitizeVolumeProvenance(validatePreparedCssVolume(raw.data ?? raw));
      for (const resource of volume.resources) {
        const bytes = await pinned(dirname(local(root,volumePath)),{path:resource.path});
        await put(local(staging,`${id}/${resource.path}`),bytes);
      }
      const brightness: PreparedVolumeDataset['brightness'] = {overall:1,x:1,y:1,z:1};
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
      datasets.push({ id,label,title:label,sourceUrl,description:recipe.description,
        volume:prepared,stars,brightness,
        // The source grid is in the lab's west/north/away frame; the embedded volume reflects it into east/north/away.
        ...(occultingCentreUnits === undefined ? {} : { occultingCentreUnits: reflectNebulaPoint(occultingCentreUnits) }) });
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
      compilerSampling = result.scene.sampling;
      if ('objectId' in result && result.objectId !== recipe.id) throw new TypeError('Compact input belongs to another object.');
      sourceResult = result.id;
      const frame = embedNebulaFrame(result.scene.frame,recipe.sky,result.scene.coordinates.localOriginArcsec);
      const anchorPoints = result.scene.stars.map(star => ({id:star.id,positionUnits:reflectNebulaPoint(star.positionUnits,result.scene.frame),
        colorCss:`#${star.rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`,opacity:star.alpha,sizePx:star.widthPx??1,
        ...(star.diameterUnits === undefined?{}:{diameterUnits:star.diameterUnits})}));
      for (const dataset of result.scene.datasets) {
        const source = result.sources.find(source => source.id === dataset.id)!;
        const points = result.scene.stars.map(star => {
          const material = star.materials?.[dataset.id] ?? star;
          return { id:star.id,positionUnits:reflectNebulaPoint(star.positionUnits,result.scene.frame),
            colorCss:`#${material.rgb.map(n=>n.toString(16).padStart(2,'0')).join('')}`,
            opacity:material.alpha,sizePx:star.widthPx??1,...(material.diameterUnits === undefined?{}:{diameterUnits:material.diameterUnits}) };
        });
        await add(dataset.id,dataset.label,source.page,dataset.volume.path,frame,{frame,points},anchorPoints);
      }
    } else if (recipe.method === 'density-grid') {
      // The Milky Way's slab baker on checked-in recipes and grids, one per dataset. The baker works in the
      // lab's west/north/away image frame; the sky frame embeds and reflects it like every other method.
      let shared: DensityVolumeFrame | undefined;
      for (const grid of recipe.grids!) {
        const output = resolve(staging, 'compact', grid.id), recipeDirectory = dirname(local(root, grid.recipe.path));
        const volumeRecipe = parseVolumeRecipe(JSON.parse((await pinned(root, grid.recipe)).toString()));
        const slices = await prepareVolumeSlices({ sourceDirectory: recipeDirectory, outputDirectory: output, recipe: volumeRecipe });
        const source: DensityVolumeFrame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
          localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: slices.boundsUnits };
        // Every dataset of one bank shares a frame, so navigation and framing do not change with the dataset.
        if (shared && JSON.stringify(shared.boundsUnits) !== JSON.stringify(source.boundsUnits)) throw new TypeError('Density-grid datasets must share their bounds.');
        shared ??= source;
        const compiled = json({ schema: PREPARED_OBJECT_SCHEMA, id: `${recipe.id}-${grid.id}`, type: 'density-volume', format: DENSITY_VOLUME_FORMAT,
          data: compileCssVolume({ id: `${recipe.id}-${grid.id}`, frame: source, slices, recipe: volumeRecipe }) });
        const volumePath = resolve(output, 'volume.json');
        await put(volumePath, compiled);
        const frame = embedNebulaFrame(source, recipe.sky);
        await add(grid.id, grid.label, grid.sourceUrl ?? recipe.sourceUrl, relative(root, volumePath), frame, { frame, points: [] },
          undefined, grid.occultingCentreUnits);
      }
    } else if (recipe.compactInputs && !research) {
      const result = await replayCompactSymmetry(root, recipe.compactInputs, relative(root, resolve(staging, 'compact')), nebulaBakeBackend);
      const frame = embedNebulaFrame(result.frame, recipe.sky);
      await add(recipe.defaultDataset, 'Hubble · optical', recipe.sourceUrl, result.pin.path, frame, { frame, points: [] });
    } else {
      if (!research) throw new TypeError('Research backend is unavailable.');
      const result = await research.symmetry(root, recipe);
      const frame = embedNebulaFrame(result.frame,recipe.sky);
      await add(recipe.defaultDataset,'Hubble · optical',recipe.sourceUrl,result.path,frame,{frame,points:[]});
    }
    await rm(resolve(staging, 'compact'), { recursive: true, force: true });
    const data = validatePreparedVolumeDatasets({schema:PREPARED_VOLUME_DATASETS_SCHEMA,id:recipe.id,defaultDataset:recipe.defaultDataset,
      framingRadiusUnits:recipe.framingRadiusUnits,contextVisibility:'independent',starsEnabled:datasets[0]!.stars.points.length>0,
      ...(recipe.attachedTo === undefined ? {} : {attachedTo:recipe.attachedTo}),datasets});
    const renderElements = assertCompilerDeliveryElementBudget(compilerSampling, data);
    const envelope = json({schema:PREPARED_OBJECT_SCHEMA,id:recipe.id,type:'volume-dataset-bank',format:PREPARED_VOLUME_DATASETS_SCHEMA,data});
    await put(resolve(staging,'datasets.json'),envelope);
    await put(resolve(staging,'delivery.json'),json({schema:'cssearth-nebula-delivery-receipt@2',recipe:JSON.parse(recipeBytes.toString()),sourceResult,
      acceptedLabResult:recipe.acceptedLabResult,...(fieldStars ? {fieldStars} : {}), ...(renderElements ? { renderElements } : {}),
      datasets:datasets.map(l=>({id:l.id,stars:l.stars.points.length,leaves:l.volume.resources.length}))}));
    // Install complete generated files only. Authored source inputs stay untouched.
    await mkdir(resolve(directory,'prepared'),{recursive:true});
    for (const entry of await readdir(staging)) { await rm(resolve(directory,'prepared',entry),{recursive:true,force:true}); await rename(resolve(staging,entry),resolve(directory,'prepared',entry)); }
    // The descriptor names the object that hosts the bank (`properties.host`) and the catalogues drawn with it
    // (`properties.cataloguePoints`); a rebake keeps both.
    const authored = await read(directory,'object.json').then(value => record(record(value).properties), (error: unknown) => {
      if (error instanceof SyntaxError || error instanceof Error && 'code' in error && error.code === 'ENOENT') return {} as Record<string, unknown>; throw error; });
    const host = authored.host, cataloguePoints = authored.cataloguePoints;
    await put(resolve(directory,'object.json'),json({schema:OBJECT_SCHEMA,id:recipe.id,type:'volume-dataset-bank',properties:{frame:datasets[0]!.volume.frame,
      preparation:{source:'source/delivery.json'},...(host === undefined ? {} : {host:text(host)}),...(cataloguePoints === undefined ? {} : {cataloguePoints})},prepared:{format:PREPARED_VOLUME_DATASETS_SCHEMA,url:'prepared/datasets.json'}}));
    return { id:recipe.id,status:'prepared',sourceResult,datasets:datasets.map(l=>({id:l.id,stars:l.stars.points.length,leaves:l.volume.resources.length})) };
  } finally { await rm(staging,{recursive:true,force:true}); }
}
