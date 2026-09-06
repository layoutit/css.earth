import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { renderMarker } from "../../../../src/navigation/marker-recipe.mjs";
import { validateEuropaSourceGroup } from "./source-manifest.mjs";
import { parentMarkerOperations } from "./parent-marker.mjs";
import { EUROPA_PUBLIC_ROOT, EUROPA_PREPARED_ROOT, EUROPA_SOURCE_ROOT } from "./preparation-paths.mjs";

const [source] = await validateEuropaSourceGroup("parent-marker");
const png = await renderMarker({schema:"cssearth-navigation-marker@1", planetId:source.bodyId,
  owner:"object", source, operations:parentMarkerOperations},
  {sourcePath:resolve(EUROPA_SOURCE_ROOT,source.path),tileSize:1024});
const filename = `europa-parent-${source.bodyId}.webp`;
await sharp(png).webp({lossless:true}).toFile(resolve(EUROPA_PUBLIC_ROOT,filename));
await writeFile(resolve(EUROPA_PREPARED_ROOT,"parent-marker.json"),JSON.stringify({
  id:source.bodyId,url:`/scenes/europa/${filename}`,index:0,count:1,size:512,
}));
