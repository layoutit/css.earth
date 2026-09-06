import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { renderMarker } from "../../../../src/navigation/marker-recipe.mjs";
import { validateGanymedeSourceGroup } from "./source-manifest.mjs";
import { parentMarkerOperations } from "./parent-marker.mjs";
import { GANYMEDE_PUBLIC_ROOT, GANYMEDE_PREPARED_ROOT, GANYMEDE_SOURCE_ROOT } from "./preparation-paths.mjs";

const [source] = await validateGanymedeSourceGroup("parent-marker");
const png = await renderMarker({schema:"cssearth-navigation-marker@1", planetId:source.bodyId,
  owner:"object", source, operations:parentMarkerOperations},
  {sourcePath:resolve(GANYMEDE_SOURCE_ROOT,source.path),tileSize:1024});
const filename = `ganymede-parent-${source.bodyId}.webp`;
await sharp(png).webp({lossless:true}).toFile(resolve(GANYMEDE_PUBLIC_ROOT,filename));
await writeFile(resolve(GANYMEDE_PREPARED_ROOT,"parent-marker.json"),JSON.stringify({
  id:source.bodyId,url:`/scenes/ganymede/${filename}`,index:0,count:1,size:512,
}));
