import { parseGeographicScene, parseRuntimePages, parsePreparationRecipe, parseWmtsRelease, parseGlobalManifest, shape, text } from '../source-records.mts';
import {commandContext} from './context.mts';
const context=commandContext();
const existing=await context.readPrepared('pages',parseRuntimePages);
const scene=await context.readPrepared('scene',parseGeographicScene);
import { readFile,writeFile } from "node:fs/promises";


import {prepareWmtsPagePresentation} from '../pinned-hierarchy.mts';
const pages=(await context.readSource('preparation/paged-ellipsoid.json',parsePreparationRecipe)).geographic.pages;
const release=parseWmtsRelease(JSON.parse(await readFile(context.sourceUrl("city/wmts-release.json"),"utf8")));
const latest=context.args[0]==="--latest"?shape({version:text})(JSON.parse(await readFile(context.projectUrl(".local/wmts-global/latest.json"),"utf8"))):release;
if(!/^[a-f0-9]{16}$/.test(latest.version))throw new Error("Invalid completed preparation version.");
const directory=context.args[0]&&context.args[0]!=="--latest"?context.args[0]:context.projectUrl(`.local/wmts-global/${latest.version}/`).pathname;
const manifest=parseGlobalManifest(JSON.parse(await readFile(`${directory}/manifest.json`,"utf8")));
if(!manifest.complete||!manifest.packHashesVerified||manifest.tiles!==manifest.expectedTiles)throw new Error("The worldwide prepared pack closure is incomplete.");
const plan={schema:pages.schema,dataset:manifest.dataset,qualification:manifest.qualification,credit:existing.credit,sourcePage:existing.sourcePage,
  canonicalDprIndependent:true,assetOrigin:existing.assetOrigin,geometryOrigin:existing.assetOrigin,topology:"wmts-quadtree@1",geometryVersion:manifest.version,
  roots:manifest.roots,...prepareWmtsPagePresentation(scene,pages)};
await context.writePrepared('pages',plan);
const pin={schema:"cssearth-global-wmts-release@1",version:manifest.version,dataset:manifest.dataset,sourceSha256:manifest.sourceSha256,
  regions:manifest.regions,tiles:manifest.tiles,leaves:manifest.leaves,bytes:manifest.bytes,files:manifest.files,qualification:manifest.qualification};
await writeFile(context.sourceUrl("city/wmts-release.json"),JSON.stringify(pin)+"\n");
console.log(JSON.stringify({version:manifest.version,roots:plan.roots.length,tiles:manifest.tiles,bytes:manifest.bytes}));
