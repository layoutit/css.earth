import { readFile,writeFile } from "node:fs/promises";
import { PREPARED_EARTH_CITY_PAGES as existing } from "../runtime/preparedCityPages.mjs";
import { PREPARED_EARTH_SCENE as scene } from "../runtime/preparedScene.mjs";
import { prepareWmtsTile,wmtsAddress } from "./city/wmts-page-geometry.mjs";
const release=JSON.parse(await readFile(new URL("../source/city/wmts-release.json",import.meta.url),"utf8"));
const latest=process.argv[2]==="--latest"?JSON.parse(await readFile(new URL("../../../../.local/wmts-global/latest.json",import.meta.url),"utf8")):release;
if(!/^[a-f0-9]{16}$/.test(latest.version))throw new Error("Invalid completed preparation version.");
const directory=process.argv[2]&&process.argv[2]!=="--latest"?process.argv[2]:new URL(`../../../../.local/wmts-global/${latest.version}/`,import.meta.url).pathname;
const manifest=JSON.parse(await readFile(`${directory}/manifest.json`,"utf8"));
if(!manifest.complete||!manifest.packHashesVerified||manifest.tiles!==manifest.expectedTiles)throw new Error("The worldwide prepared pack closure is incomplete.");
const plan={schema:existing.schema,dataset:manifest.dataset,qualification:manifest.qualification,credit:existing.credit,sourcePage:existing.sourcePage,
  canonicalDprIndependent:true,assetOrigin:existing.assetOrigin,geometryOrigin:existing.assetOrigin,topology:"wmts-quadtree@1",geometryVersion:manifest.version,
  roots:manifest.roots,initialLayer:prepareWmtsTile(wmtsAddress(-58.38,-34.6,14),scene)[0],rasterScale:8,pageTemplate:"clipped-projective",
  poolSize:512,decodedPageBytes:256*256*4,maximumDecodedBytes:512*256*256*4,maximumConcurrentLoads:4,minimumZoom:8,maximumZoom:4096,targetCssPixels:384,
  index:{maximumDirectories:96,maximumBytes:12*1024*1024,maximumDirectoryBytes:2*1024*1024,maximumConcurrentLoads:3}};
await writeFile(new URL("../runtime/preparedCityPages.mjs",import.meta.url),`// Generated from the complete pinned WorldCover geometry hierarchy.\nexport const PREPARED_EARTH_CITY_PAGES=Object.freeze(${JSON.stringify(plan)});\n`);
const pin={schema:"cssearth-global-wmts-release@1",version:manifest.version,dataset:manifest.dataset,sourceSha256:manifest.sourceSha256,
  regions:manifest.regions,tiles:manifest.tiles,leaves:manifest.leaves,bytes:manifest.bytes,files:manifest.files,qualification:manifest.qualification};
await writeFile(new URL("../source/city/wmts-release.json",import.meta.url),JSON.stringify(pin)+"\n");
console.log(JSON.stringify({version:manifest.version,roots:plan.roots.length,tiles:manifest.tiles,bytes:manifest.bytes}));
