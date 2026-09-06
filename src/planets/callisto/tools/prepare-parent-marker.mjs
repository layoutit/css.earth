import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { renderMarker } from "../../../../src/navigation/marker-recipe.mjs";
import { validateCallistoSourceGroup } from "./source-manifest.mjs";
import { parentMarkerOperations } from "./parent-marker.mjs";
import { CALLISTO_PUBLIC_ROOT, CALLISTO_PREPARED_ROOT, CALLISTO_SOURCE_ROOT } from "./preparation-paths.mjs";

const [source] = await validateCallistoSourceGroup("parent-marker");
const png = await renderMarker({schema:"cssearth-navigation-marker@1", planetId:source.bodyId,
  owner:"object", source, operations:parentMarkerOperations},
  {sourcePath:resolve(CALLISTO_SOURCE_ROOT,source.path),tileSize:1024});
const filename = `callisto-parent-${source.bodyId}.webp`;
await sharp(png).webp({lossless:true}).toFile(resolve(CALLISTO_PUBLIC_ROOT,filename));
await writeFile(resolve(CALLISTO_PREPARED_ROOT,"parent-marker.json"),JSON.stringify({
  id:source.bodyId,url:`/scenes/callisto/${filename}`,index:0,count:1,size:512,
}));
